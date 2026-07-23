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
import {useNavigate} from "react-router-dom";
import {useEffect, useMemo, useState} from "react";
import PrintIcon from "@mui/icons-material/Print";

import DeleteIcon from "@mui/icons-material/Delete";
import {CircularTimer} from "../../../../shared/components/CircularTimer";
import BluetoothPrinterService from "../../../../services/BluetoothPrinterService";
import {usePreciseCountdown} from "../../../../shared/hooks/usePreciseCountdown";
import {toEpochMsBahrain} from "../../../../shared/utils/timeUtils";
import type {Order, OrderItem, ComboItemTO} from '../../../order/types';
import { buildTicketLines, resolveKitchenNote } from '../../../menu/utils/orderLines';

const colorRed = '#E44B4C';
const colorBeige = '#FCF4DD';

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
                    <Typography variant="body2" sx={{color: colorRed, ml: 1, fontStyle: "italic"}}>
                        Note: {note}
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
                <Typography variant="body2" sx={{color: colorRed, fontStyle: "italic"}}>
                    Note: {note}
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
                   }: OrderCardProps): JSX.Element {
    const formattedTime = formatTime(order.order_created);
    const navigate = useNavigate();
    const [extraSec] = useState(0);

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
            backgroundColor: order.order_type === "Jahez" ? "#fff5f5" : order.order_type === "Keeta" ? '#CDBA2E' : order.order_type === "Talabat" ? '#fbaa66' : "#fff",
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
                                cursor: "pointer"
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
                                "&:hover": {
                                    backgroundColor: "rgba(228, 75, 76, 0.08)"
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
                    {order.order_type !== "Jahez" && order.order_type !== "Talabat" && (
                        <Typography variant="body2">
                            <strong>Customer Info:</strong> {order.customer_name || "Rabotyaga"} ({order.phone_number})
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
                            {order.status === "Ready" && (
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
                    {order.order_type !== "Jahez" && order.order_type !== "Keeta" && order.order_type !== "Talabat" && (

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
        </Card>
    );
}

export default OrderCard;
