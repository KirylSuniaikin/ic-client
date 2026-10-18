import { logger } from "../../../../shared/utils/logger";
import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Divider, IconButton
} from "@mui/material";
import {updateOrderStatus} from "../../../../shared/api/public";
import {markHandedOverToCourier, markPartHandedOverToCourier} from "../../../../shared/api/dispatcher";
import {DeliveryApiError} from "../../../delivery/types";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import {HandedToCourierDialog} from "./HandedToCourierDialog";
import {useNavigate} from "react-router-dom";
import {useEffect, useMemo, useState} from "react";
import PrintIcon from "@mui/icons-material/Print";

import DeleteIcon from "@mui/icons-material/Delete";
import {CircularTimer} from "../../../../shared/components/CircularTimer";
import BluetoothPrinterService from "../../../../services/BluetoothPrinterService";
import {usePreciseCountdown} from "../../../../shared/hooks/usePreciseCountdown";
import {toEpochMsBahrain} from "../../../../shared/utils/timeUtils";
import type {Order, OrderItem, ComboItemTO, KitchenPartStatus} from '../../../order/types';
import { buildTicketLines, resolveKitchenNote } from '../../../menu/utils/orderLines';

const colorRed = '#E44B4C';
const colorBeige = '#FCF4DD';
// Talabat's orange (#FF5A00) at about 30% over white: recognisable without shouting on the board.
const colorTalabat = '#FFCEB3';

// OrderMapper sends this in place of a phone when the order has no customer. On a Talabat order
// that means the rider photo has not been linked yet, so there is no number to show.
const NO_CUSTOMER_PHONE = "Failed to fetch number";

/** The Talabat import writes the type in lower case ("talabat"); a hand-typed order says "Talabat". */
function isTalabatOrder(order: Order): boolean {
    return String(order.order_type).toLowerCase() === "talabat";
}

function hasLinkedPhone(order: Order): boolean {
    return Boolean(order.phone_number) && order.phone_number !== NO_CUSTOMER_PHONE;
}

/** Extracted from an inline four-deep ternary that was already at its readability limit. */
function cardBackgroundColor(order: Order): string {
    if (order.order_type === "Jahez") return "#fff5f5";
    if (order.order_type === "Keeta") return '#CDBA2E';
    if (isTalabatOrder(order)) return colorTalabat;
    return "#fff";
}

function formatTime(isoString: string): string {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

const CATEGORY_ORDER = [
    "Combo Deals",
    "Pizzas",
    "Brick Pizzas",
    "Baguette Pizzas",
    "Sides",
    "Sauces",
    "Beverages",
];

export function formatExternalId(id: string | number | null | undefined): string {
    if (!id) return "—";

    const strId = String(id);

    if (strId.length <= 4) {
        return strId;
    }

    return `${strId.substring(strId.length - 4)}`;
}

export function sortItemsByCategory(items: OrderItem[]): OrderItem[] {
    if (!items || !items.length) return [];

    return [...items].sort((a, b) => {
        const aIndex = CATEGORY_ORDER.indexOf(a.category);
        const bIndex = CATEGORY_ORDER.indexOf(b.category);

        const safeA = aIndex === -1 ? CATEGORY_ORDER.length : aIndex;
        const safeB = bIndex === -1 ? CATEGORY_ORDER.length : bIndex;

        return safeA - safeB;
    });
}

function renderComboDescription(comboItems: ComboItemTO[]): JSX.Element[] {
    return comboItems.map((item, idx) => {
        const lines = buildTicketLines(item);
        const note = resolveKitchenNote(item);

        return (
            <Box key={idx} sx={{mt: 1, ml: 1}}>
                <Typography variant="body2" fontWeight="bold">
                    {item.name} {item.size ? "(" + item.size + ")" : ""}
                </Typography>

                {lines.map((line, i) => (
                    <Typography
                        key={i}
                        variant="body2"
                        sx={{color: colorRed, ml: 1}}
                    >
                        {line}
                    </Typography>
                ))}
                {note && (
                    <Typography variant="body2" sx={{color: colorRed, ml: 1}}>
                        + {note}
                    </Typography>
                )}
            </Box>
        );
    });
}

export function renderItemDetails(item: OrderItem): JSX.Element | null {
    if (item.category === "Combo Deals" && Array.isArray(item.comboItemTO)) {
        return <>{renderComboDescription(item.comboItemTO)}</>;
    }

    const lines = buildTicketLines(item);
    const note = resolveKitchenNote(item);

    return lines.length > 0 || note ? (
        <Box sx={{mt: 1, ml: 1}}>
            {lines.map((line, idx) => (
                <Typography
                    key={idx}
                    variant="body2"
                    sx={{color: colorRed}}
                >
                    {line}
                </Typography>
            ))}
            {note && (
                <Typography variant="body2" sx={{color: colorRed}}>
                    + {note}
                </Typography>
            )}
        </Box>
    ) : null;
}

interface OrderCardProps {
    order: Order;
    onReadyClick?: (order: Order) => void;
    isHistory?: boolean;
    onDeleteClick: (order: Order) => void;
    onPayClick?: (order: Order) => void;
    onPickedUpClick?: (order: Order) => void;
    onOvenClick?: (order: Order) => void;
    // Asked when a per-part hand-over is refused because the shown rider is stale: the board
    // re-reads this order's parts so the button names the current rider.
    onPartHandOverConflict?: (orderId: string) => void;
}

/**
 * The 409 is a named state, not a fault — the rider can be released or reassigned between the
 * board being drawn and the button being pressed — so it gets words a cook can act on. Everything
 * else falls back to the API layer's own message, as the dispatcher panel does.
 */
function handOverErrorMessage(err: unknown): string {
    if (err instanceof DeliveryApiError && err.status === 409) {
        return "No courier is assigned to this order yet — hand it over once a rider has been assigned.";
    }
    return `Hand-over failed. ${err instanceof Error ? err.message : String(err)}`;
}

/** Split-part 409: a reassigned rider or a still-unassigned sibling — distinct from the single-path copy. */
const SPLIT_PART_CONFLICT_MESSAGE =
    "This part's rider has changed or another part is still unassigned. The board is refreshing — check the name and try again.";

/**
 * The hand-over button's own label carries the only rider state the kitchen can act on.
 *
 * `courier_assigned` is the gate (it mirrors exactly the condition the endpoint 409s on), so it
 * becomes the label. `courier_at_kitchen` is deliberately NOT shown: it never gated the button —
 * a rider whose app never registered "arrived" has still arrived, and the server back-fills that
 * timestamp on hand-over — so on a card this dense, and one shared with pick-up orders, it was
 * paying for a line of text with nothing to do.
 */
function handOverLabel(order: Order): string {
    return order.courier_assigned === true ? "HANDED TO COURIER" : "NO COURIER YET";
}

/**
 * Courier-capacity Phase 5 (task-spec.md §5.5/§7.2 step 4, D2/D3): a genuinely split order
 * — `partsTotal > 1` with its own `parts` list populated — gets one hand-over button PER PART
 * instead of the single order-level one above. `order.partsTotal` is undefined/1 for every order
 * this phase does not touch, so this is false there and the block below never renders.
 */
function isGenuinelySplit(order: Order): boolean {
    return (order.partsTotal ?? 1) > 1 && Array.isArray(order.parts) && order.parts.length > 1;
}

/**
 * Review iteration 1, Issue 1: the per-part hand-over block used to render whenever the order was
 * split and had an open part, with no status check at all — so a split order that ended in
 * `Cancelled` (`DispatcherService.cancel` only releases part 1) or `Returned Undelivered`
 * (`markReturnedUndeliveredForPart` leaves sibling parts untouched) could be pinned to the board
 * (see `findActiveOrders`'s own narrowed rescue) AND still present an enabled hand-over control on
 * a terminal order. `Ready` and `Out for delivery` are the only two statuses a live delivery order
 * ever carries while a part can still legitimately need a hand-over (task-spec.md §7.2 steps 2-5) —
 * mirrors the single-button path's own `order.status === "Ready"` liveness check.
 */
function isOrderStillLiveForSplitHandOver(order: Order): boolean {
    return order.status === "Ready" || order.status === "Out for delivery";
}

/** D3's fixed notice, shown once, above every part's own button, while any part still lacks a courier. */
const ALL_PARTS_NEED_A_COURIER_NOTICE =
    "Every part needs its own courier before any of them can be handed over.";

function splitPartButtonLabel(part: KitchenPartStatus, partsTotal: number): string {
    const label = part.handedOver
        ? `PART ${part.partIndex}/${partsTotal} HANDED OVER`
        : `HAND OVER PART ${part.partIndex}/${partsTotal}`;
    return part.courierName ? `${label} · ${part.courierName}` : label;
}

function isNotKeetaDefaultNotes(notes: string) {
    return !(notes === "Need cutlery"
        || notes === "Need cutlery; Please contact me when the item is out of stock"
        || notes === "Need cutlery; Please cancel the order if the item is out of stock"
    );
}

function OrderCard({
                       order,
                       onReadyClick = () => {
                       },
                       isHistory = false,
                       onDeleteClick,
                       onPayClick = () => {
                       },
                       onPickedUpClick = () => {
                       },
                       onOvenClick = () => {
                       },
                       onPartHandOverConflict = () => {
                       },
                   }: OrderCardProps): JSX.Element {
    const formattedTime = formatTime(order.order_created);
    const navigate = useNavigate();
    const [extraSec] = useState(0);
    const [handOverConfirmOpen, setHandOverConfirmOpen] = useState(false);
    const [handingOver, setHandingOver] = useState(false);
    const [handOverError, setHandOverError] = useState<string | null>(null);

    // Courier-capacity Phase 5: a split order's own, independent hand-over state — never engaged
    // by a non-split order, which keeps the block above byte-identical to before this phase.
    const [splitHandOverTarget, setSplitHandOverTarget] = useState<KitchenPartStatus | null>(null);
    const [handingOverPartIds, setHandingOverPartIds] = useState<ReadonlySet<number>>(new Set());
    // Review iteration 1, Issue 2: `parts[k].handedOver` only ever arrives via the REST snapshot
    // (no live frame carries it — `DeliveryAlertPublisher.handedOver` only pushes `signalBoard` and
    // a courier-topic frame). Without this, a successfully handed-over part's own button reverts to
    // its enabled label the instant `handingOverPartIds`'s `finally` clears it, for the entire rest
    // of the card's now-extended lifetime (D8). Only ever grows — once a part is truly handed over
    // server-side that never reverses, so a stale entry here is never wrong, only redundant once the
    // next REST refresh/reconnect confirms it via `part.handedOver` itself.
    const [locallyHandedOverPartIds, setLocallyHandedOverPartIds] = useState<ReadonlySet<number>>(new Set());

    async function confirmHandOver(): Promise<void> {
        setHandOverConfirmOpen(false);
        setHandingOver(true);
        try {
            await markHandedOverToCourier(Number(order.id));
            // Deliberately no local removal: the backend answers this transition with a
            // `pushDeleted` frame that clears the card on every tablet. Dropping it here as well
            // would be a second, competing mechanism — and the two would disagree exactly when it
            // matters, with the request succeeding but the frame lost.
        } catch (err) {
            logger.error("Courier hand-over confirmation failed:", err);
            setHandOverError(handOverErrorMessage(err));
        } finally {
            setHandingOver(false);
        }
    }

    /**
     * Part-primary sibling of {@link confirmHandOver}. Same no-local-removal reasoning: the last
     * open part's hand-over fires `KitchenCardShouldClose` server-side, which is what actually
     * takes the card off every tablet (task-spec.md §5.6).
     */
    async function confirmSplitPartHandOver(): Promise<void> {
        const target = splitHandOverTarget;
        setSplitHandOverTarget(null);
        if (!target) return;
        setHandingOverPartIds(prev => new Set(prev).add(target.partId));
        try {
            // No name argument at all for an unnamed part, so the request carries no body.
            await (target.courierName
                ? markPartHandedOverToCourier(target.partId, target.courierName)
                : markPartHandedOverToCourier(target.partId));
            setLocallyHandedOverPartIds(prev => new Set(prev).add(target.partId));
        } catch (err) {
            logger.error("Courier hand-over confirmation failed for part:", target.partId, err);
            if (err instanceof DeliveryApiError && err.status === 409) {
                setHandOverError(SPLIT_PART_CONFLICT_MESSAGE);
                onPartHandOverConflict(order.id);
            } else {
                setHandOverError(handOverErrorMessage(err));
            }
        } finally {
            setHandingOverPartIds(prev => {
                const next = new Set(prev);
                next.delete(target.partId);
                return next;
            });
        }
    }

    const createdMs = useMemo(
        () => toEpochMsBahrain(order.order_created),
        [order.order_created]
    );

    const TOTAL_SEC = useMemo(
        () => (order.estimation ? order.estimation * 60 : 15 * 60),
        [order.estimation]
    );

    const endTs = useMemo(
        () => createdMs + (TOTAL_SEC + extraSec) * 1000,
        [createdMs, TOTAL_SEC, extraSec]
    );

    const msLeft = usePreciseCountdown(endTs, 250);
    const timeLeft = Math.ceil(msLeft / 1000);

    useEffect(() => {
        let lock: WakeLockSentinel | undefined;

        async function req(): Promise<void> {
            try {
                lock = await navigator.wakeLock?.request("screen");
                document.addEventListener("visibilitychange", () => {
                    if (document.visibilityState === "visible") req();
                }, {once: true});
            } catch {
            }
        }

        req();
        return () => {
            try {
                lock?.release?.();
            } catch {
            }
        };
    }, []);

    const isCritical = timeLeft < 60;
    const isDelivery = order.order_type === "Delivery";


    const cardBorderColor = !isHistory
        ? (isCritical ? colorRed : 'transparent')
        : 'transparent';

    return (
        <Card sx={{
            mb: 2,
            border: '2px solid',
            borderRadius: 3,
            borderColor: cardBorderColor,
            alignSelf: 'flex-start',
            backgroundColor: cardBackgroundColor(order),
            boxShadow: 3
        }}>
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1
                    }}
                >
                    <Box sx={{display: "flex", alignItems: "center", gap: 0.8}}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                border: "1px solid #E44B4C",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mr: 0.8,
                                cursor: "pointer",
                                // White under the red icon so it still reads on a coloured
                                // (Keeta, Talabat) card.
                                backgroundColor: "white"
                            }}
                            onClick={() => BluetoothPrinterService.printOrder(order)}
                        >
                            <PrintIcon sx={{fontSize: 26, color: "#E44B4C"}}/>
                        </Box>

                        <Typography component="span" fontWeight={600}>
                            <Typography variant="h3" component="div" fontWeight={900}>
                                #{order.order_type === "Jahez" || order.order_type === "Keeta" || order.order_type === "Talabat" ? formatExternalId(order.external_id) : order.order_no}{" "}
                            </Typography>
                        </Typography>

                        <IconButton
                            size="small"
                            sx={{
                                width: 36,
                                height: 36,
                                border: `1px solid ${colorRed}`,
                                color: colorRed,
                                borderRadius: "50%",
                                p: 0.5,
                                ml: 0.5,
                                backgroundColor: "white",
                                // The old 8% red tint, made opaque so a coloured card can't show through.
                                "&:hover": {
                                    backgroundColor: "#FDF1F1"
                                }
                            }}
                            onClick={() => onDeleteClick(order)}
                        >
                            <DeleteIcon sx={{fontSize: 26}}/>
                        </IconButton>
                    </Box>

                    {!isHistory &&
                        <CircularTimer timeLeft={timeLeft} totalSec={(order.estimation ?? 15) * 60}/>
                    }
                </Box>

                <Divider sx={{mb: 2}}/>

                <Box sx={{mb: 1}}>
                    {isHistory && (
                        <Typography variant="body2">
                            <strong>Time:</strong> {formattedTime}
                        </Typography>
                    )}
                    {isHistory && order.order_created_formatted && (
                        <Typography variant="body2">
                            <strong>Date:</strong> {order.order_created_formatted}
                        </Typography>
                    )}
                    {order.order_type !== "Jahez" && (!isTalabatOrder(order) || hasLinkedPhone(order)) && (
                        <Typography variant="body2">
                            <strong>Customer Info:</strong> {order.customer_name || "Rabotyaga"} ({order.phone_number})
                        </Typography>
                    )}
                    {/* The kitchen is told HOW the order leaves, not where it goes: the
                        address is the courier's business, and this card lives on a wall where a
                        customer's address has no business being. Delivery is the one fulfilment
                        fact the kitchen acts on — it changes who the food is handed to — so it is
                        printed only on a delivery order; a pick-up card gains nothing from a line
                        saying it is a pick-up. */}
                    {isDelivery && (
                        <Typography variant="body2">
                            <strong>Type:</strong> Delivery
                        </Typography>
                    )}
                    {order.notes.length > 0 && isNotKeetaDefaultNotes(order.notes) && (
                        <Typography variant="body2" color={colorRed}>
                            <strong>Notes:</strong> {order.notes}
                        </Typography>
                    )}
                    {isHistory && (
                        <Typography variant="body2">
                            <strong>Payment type:</strong> {order.payment_type}
                        </Typography>
                    )}
                </Box>

                <Divider sx={{my: 2}}/>

                <Box>
                    {sortItemsByCategory(order.items).map((item, idx) => (
                        <Box
                            key={idx}
                            sx={{
                                mb: 1.5,
                                pl: 1,
                                borderLeft: "2px solid #e0e0e0"
                            }}
                        >
                            <Typography variant="body2">
                                {item.quantity}x <strong>{item.name}</strong>
                                {item.size && (
                                    <Typography
                                        component="span"
                                        variant="body2"
                                        sx={{ml: 1, fontStyle: "italic"}}
                                    >
                                        ({item.size})
                                    </Typography>
                                )}
                                {/* Courier-capacity Phase 5: "Part k/N" only when the order is
                                    genuinely split — undefined partIndex/partsTotal on every other
                                    order leaves this byte-identical to before the phase. */}
                                {(order.partsTotal ?? 1) > 1 && (item.partShares?.length ?? 0) > 1
                                    // t6: a line cut across parts reads "Part 1/2: 3 of 5", one label per share.
                                    ? item.partShares?.map((share) => (
                                        <Typography
                                            key={share.partIndex}
                                            component="span"
                                            variant="body2"
                                            sx={{ml: 1, fontWeight: 600, color: colorRed}}
                                        >
                                            Part {share.partIndex}/{order.partsTotal}: {share.quantity} of {item.quantity}
                                        </Typography>
                                    ))
                                    : (order.partsTotal ?? 1) > 1 && item.partIndex != null && (
                                        <Typography
                                            component="span"
                                            variant="body2"
                                            sx={{ml: 1, fontWeight: 600, color: colorRed}}
                                        >
                                            Part {item.partIndex}/{order.partsTotal}
                                        </Typography>
                                    )}
                            </Typography>

                            {renderItemDetails(item)}
                        </Box>
                    ))}
                </Box>
            </CardContent>

            <CardActions
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    px: 2,
                    pb: 2
                }}
            >
                <Typography variant="h5" fontWeight="bold">
                    {order.amount_paid}
                </Typography>
                <Box>
                    {!isHistory && (
                        <>
                            {order.status === "Kitchen Phase" && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={false}
                                    sx=
                                        {{
                                            borderColor: colorBeige,
                                            color: colorRed,
                                            backgroundColor: "white",
                                            mr: 1,
                                            borderRadius: 4
                                        }}
                                    onClick={() => {
                                        onOvenClick?.(order);
                                        updateOrderStatus({
                                            orderId: order.id,
                                            jahezOrderId: order.external_id ? order.external_id : null,
                                            orderStatus: "Oven",
                                            reason: null
                                        }).catch(logger.error);
                                    }}
                                >
                                    OVEN
                                </Button>
                            )}
                            {order.status === "Oven" && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={false}
                                    sx=
                                        {{
                                            borderColor: colorBeige,
                                            color: colorRed,
                                            backgroundColor: "white",
                                            mr: 1,
                                            borderRadius: 4
                                        }}
                                    onClick={() => {
                                        onReadyClick?.(order);
                                        updateOrderStatus({
                                            orderId: order.id,
                                            jahezOrderId: order.external_id ? order.external_id : null,
                                            orderStatus: "Ready",
                                            reason: null
                                        }).catch(logger.error);
                                    }}
                                >
                                    READY
                                </Button>
                            )}
                            {/* Not on a delivery order: "Picked Up" means the CUSTOMER collected
                                it, and a delivery is collected by the courier. That hand-over is
                                confirmed by the kitchen through its own endpoint — see the
                                delivery branch below — because a rider tapping their own button by
                                accident took live orders off this board; the courier app's button
                                is disabled server-side now. */}
                            {order.status === "Ready" && order.order_type !== "Delivery" && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    sx=
                                        {{
                                            borderColor: colorBeige,
                                            color: colorRed,
                                            backgroundColor: "white",
                                            mr: 1,
                                            borderRadius: 4
                                        }}
                                    onClick={() => {
                                        onPickedUpClick?.(order);
                                        updateOrderStatus({
                                            orderId: order.id,
                                            jahezOrderId: order.external_id ? order.external_id : null,
                                            orderStatus: "Picked Up",
                                            reason: null
                                        }).catch(logger.error);
                                    }}
                                >
                                    PICKED UP
                                </Button>
                            )}
                            {/* The delivery counterpart of PICKED UP, at the same status. One
                                control for both rider states rather than a caption plus a
                                sometimes-button: with no rider assigned it is the same button,
                                disabled and relabelled, so the row keeps its height and the
                                kitchen still sees there is nobody to hand to — which is exactly
                                the condition the endpoint 409s on — without spending a line of
                                caption on it. */}
                            {order.status === "Ready" && order.order_type === "Delivery" && !isGenuinelySplit(order) && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={order.courier_assigned !== true || handingOver}
                                    sx=
                                        {{
                                            borderColor: colorBeige,
                                            color: colorRed,
                                            backgroundColor: "white",
                                            mr: 1,
                                            borderRadius: 4,
                                            // Without this the disabled state inherits the white
                                            // background rule above and reads as an active button.
                                            "&.Mui-disabled": {backgroundColor: "#f0ece4", color: "#9a9188"}
                                        }}
                                    onClick={() => setHandOverConfirmOpen(true)}
                                >
                                    {handOverLabel(order)}
                                </Button>
                            )}
                            {/* Courier-capacity Phase 5 (D2): a genuinely split order gets one
                                hand-over button PER PART, side by side, instead of a single
                                cycling button — visible whenever the order is split and at least
                                one part is still open (task-spec.md §7.2 step 4): a split order's
                                card stays on the board past the FIRST part's own departure, so this
                                stays visible through both "Ready" and "Out for delivery". Review
                                iteration 1, Issue 1: gated on `isOrderStillLiveForSplitHandOver` so
                                a `Cancelled`/`Returned Undelivered` split order — which the board's
                                own `findActiveOrders` rescue clause never returns anyway once its
                                status guard is in place, but which this block must not blindly
                                trust — can never present a hand-over control. */}
                            {isDelivery && isGenuinelySplit(order) && isOrderStillLiveForSplitHandOver(order)
                                && order.parts?.some(p => !p.handedOver && !locallyHandedOverPartIds.has(p.partId)) && (
                                <Box sx={{display: "flex", flexWrap: "wrap", gap: 1, mr: 1}}>
                                    {order.courier_assigned !== true && (
                                        <Typography
                                            variant="body2"
                                            sx={{color: colorRed, width: "100%"}}
                                        >
                                            {ALL_PARTS_NEED_A_COURIER_NOTICE}
                                        </Typography>
                                    )}
                                    {order.parts!.map(part => {
                                        const handedOver = part.handedOver || locallyHandedOverPartIds.has(part.partId);
                                        return (
                                            <Button
                                                key={part.partId}
                                                variant="contained"
                                                size="small"
                                                disabled={
                                                    handedOver
                                                    || order.courier_assigned !== true
                                                    || handingOverPartIds.has(part.partId)
                                                }
                                                sx={{
                                                    borderColor: colorBeige,
                                                    color: colorRed,
                                                    backgroundColor: "white",
                                                    borderRadius: 4,
                                                    "&.Mui-disabled": {backgroundColor: "#f0ece4", color: "#9a9188"}
                                                }}
                                                onClick={() => setSplitHandOverTarget(part)}
                                            >
                                                {splitPartButtonLabel({...part, handedOver}, order.partsTotal ?? part.partIndex)}
                                            </Button>
                                        );
                                    })}
                                </Box>
                            )}
                            {order.order_type !== "Jahez" && order.order_type !== "Keeta" && (order.order_type as string) !== "TalabaT" && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={order.isPaid}
                                    sx=
                                        {{
                                            borderColor: colorBeige,
                                            color: colorRed,
                                            backgroundColor: "white",
                                            mr: 1,
                                            borderRadius: 4
                                        }}
                                    onClick={() =>
                                        onPayClick(order)
                                    }
                                >
                                    PAY
                                </Button>
                            )}
                        </>
                    )}
                    {order.order_type !== "Jahez" && order.order_type !== "Keeta" && !isTalabatOrder(order) && (

                        <Button
                            variant="outlined"
                            size="small"
                            sx={{
                                borderColor: colorRed,
                                color: colorRed,
                                borderRadius: 4
                            }}
                            onClick={() => {
                                const safeCopy = JSON.parse(JSON.stringify(order));
                                localStorage.setItem("orderToEdit", JSON.stringify(safeCopy));
                                navigate("/menu?isAdmin=true&isEditMode=true");
                            }}>
                            EDIT
                        </Button>
                    )}
                </Box>
            </CardActions>

            <HandedToCourierDialog
                open={handOverConfirmOpen}
                order={order}
                onConfirm={() => { void confirmHandOver(); }}
                onCancel={() => setHandOverConfirmOpen(false)}
            />
            {/* Courier-capacity Phase 5: the split order's own per-part confirm — same dialog,
                scoped by the `part` prop, never opened by the non-split path above. */}
            <HandedToCourierDialog
                open={splitHandOverTarget !== null}
                order={order}
                onConfirm={() => { void confirmSplitPartHandOver(); }}
                onCancel={() => setSplitHandOverTarget(null)}
                part={splitHandOverTarget
                    ? {partIndex: splitHandOverTarget.partIndex, partsTotal: order.partsTotal ?? splitHandOverTarget.partIndex,
                        courierName: splitHandOverTarget.courierName}
                    : undefined}
            />
            {/* Same failure surface the rest of the admin board uses (AdminHomePage's dough
                alert, TaskBoardPanel's failed mutations) — never a silent no-op. */}
            <ErrorSnackbar
                open={handOverError !== null}
                message={handOverError ?? ""}
                severity="error"
                handleClose={() => setHandOverError(null)}
            />
        </Card>
    );
}

export default OrderCard;
