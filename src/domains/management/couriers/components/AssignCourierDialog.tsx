import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Drawer, Button, Box, Typography, Chip, Alert,
    CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import type {
    CourierBoardRow, CourierStats, DeliveryCard, DispatchableOrder, ManualAssignResult,
    OverCapacityWarning,
} from '../types';
import { CourierAvailabilityList } from './CourierAvailabilityList';
import { DeliveryOrderDetails } from './DeliveryOrderDetails';
import { DeliveryAssignmentTimeline } from './DeliveryAssignmentTimeline';
import {
    INK, SHEET_GROUND, BRAND_RED as brandRed, MUTED, PANEL_CARD_SX, PanelNotice, SECTION_TITLE_SX,
} from './dispatcherStyles';

/**
 * Statuses the server refuses to assign to (DispatcherService.manualAssign returns 409 for both).
 * Listed here so an offline rider is visibly unavailable rather than a button that fails.
 */
const UNAVAILABLE_STATUSES = ['OFFLINE', 'BLACKLISTED'];

/**
 * One order, opened (DELIVERY_SPEC.md §2.3, manual §02 "Manual assignment").
 *
 * It started as the manual-assignment picker: the escape hatch for when the assignment engine has
 * run out of options — every courier refused, or none was free. The order is not cancelled and
 * does not fall back to Keeta (the customer has already paid), so a human puts it on a rider.
 *
 * It is now also what a live delivery on the board opens, carrying {@link CourierAvailabilityList}
 * as a section: "why this order is with this rider and not another". That content used to be a
 * third panel sitting permanently beside the board, saying nothing until an order was picked. One
 * dialog rather than two, because both places are asking about one order, and a second dialog
 * would drift from this one.
 *
 * BUSY couriers are shown and selectable on purpose. §2.3 is the case where the automatic queue
 * has already failed, and a manager who can see the board may well decide the rider two streets
 * away should take a second drop. Only the two states the server rejects are blocked here.
 */
export interface AssignCourierDialogProps {
    /** The order being opened; null closes the dialog. */
    order: DispatchableOrder | null;
    /**
     * The full board card for {@link order}, when the caller has one.
     *
     * Present from the live-deliveries board and absent from the waiting-for-a-courier queue,
     * which is the difference this prop exists to express: a queued order has no rider, no
     * hand-over and no arrival estimate, so a details block there would be four dashes and a
     * phone number. Given one, the popup leads with the order rather than with the engine.
     */
    card?: DeliveryCard | null;
    /** The board's fallback freshness budget; only used for a card predating its own field. */
    freshnessBudgetMinutes?: number | null;
    couriers: CourierStats[];
    onClose: () => void;
    /**
     * Server-authoritative two-step (courier-capacity, task-spec.md §5 "Resolved design
     * decision"): the dialog always awaits this and never closes itself. `assigned: false` means
     * nothing changed server-side — the dialog shows `warning` and relabels its own button so the
     * next press re-sends with `acknowledgeOverCapacity: true`. `assigned: true` is the caller's
     * cue to close/refetch, exactly as the old fire-and-forget `onAssign` did.
     *
     * Contract: this must never reject. A failed request (network/5xx, a 409 race) is the
     * caller's own error state (see `CourierDispatcherPanel.handleAssign` / §7's edge-case row) —
     * the caller catches it, closes the dialog from its own side (the `order`/`card` prop this
     * dialog is rendered with becomes `null`), and resolves here with a harmless fallback. That
     * is what lets this dialog have no failure branch of its own to get wrong.
     */
    onAssign: (courierId: string, acknowledgeOverCapacity: boolean) => Promise<ManualAssignResult>;
    /**
     * The engine's verdict per rider for THIS order. Omit it — as the waiting-for-a-courier queue
     * does — and the section is not rendered at all; an empty array is a real answer ("nobody on
     * the roster") and renders as one.
     */
    availability?: CourierBoardRow[];
    /** Suppresses the availability empty state while its annotated fetch is still in flight. */
    availabilityLoading?: boolean;
    /**
     * False once a rider holds the order. `OrderRepository.claimForCourier` only matches a row
     * whose `assigned_courier_id is null`, so manual assignment on an order already in someone's
     * hands can do nothing but 409 — and a button that can only fail is worse than no button.
     * The manager releases it from the courier's own list first.
     */
    assignable?: boolean;
}

export function AssignCourierDialog({
    order,
    card = null,
    freshnessBudgetMinutes = null,
    couriers,
    onClose,
    onAssign,
    availability,
    availabilityLoading = false,
    assignable = true,
}: AssignCourierDialogProps): JSX.Element {
    const [selected, setSelected] = useState<string | null>(null);
    /**
     * Non-null exactly once the server has refused an unacknowledged over-capacity assignment.
     * Its presence, not a separate flag, is what drives the button's relabel to "Assign anyway"
     * and what the next press acknowledges — one source of truth for "have we already tried and
     * been told no".
     */
    const [warning, setWarning] = useState<OverCapacityWarning | null>(null);
    const [pending, setPending] = useState(false);

    function isAvailable(courier: CourierStats): boolean {
        return !UNAVAILABLE_STATUSES.includes(courier.status);
    }

    /**
     * Never disabled, never blocking: this always resolves to either a warning to show or a
     * result the caller uses to close/refetch. `onAssign` is contractually guaranteed not to
     * reject (see its doc comment) — a real failure is the caller's own error state, surfaced by
     * closing this dialog from the outside, not by this function catching anything.
     */
    async function handlePress(): Promise<void> {
        if (selected === null) return;
        setPending(true);
        try {
            const result = await onAssign(selected, warning !== null);
            setWarning(result.assigned ? null : result.warning);
        } finally {
            setPending(false);
        }
    }

    /**
     * A rider is a different request (Issue 3, review iteration 1): `warning` describes the last
     * rider's numbers, and "Assign anyway" is only allowed to re-send THAT same request. Switching
     * riders clears it, which puts the button back to plain "Assign" — an unacknowledged first
     * press for whoever is newly selected. Re-clicking the already-selected rider is a no-op here
     * on purpose, so it does not wipe a warning that still describes them.
     */
    function selectCourier(courierId: string): void {
        if (courierId !== selected) setWarning(null);
        setSelected(courierId);
    }

    function resetOnExit(): void {
        setSelected(null);
        setWarning(null);
    }

    const theme = useTheme();
    // `noSsr` because this app has no server render: without it the first paint is always the
    // desktop branch and a phone visibly swaps shells a frame later.
    const compact = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

    const selectable = couriers.filter(isAvailable);
    const orderLabel = `#${order?.orderNo ?? order?.orderId ?? ''}`;
    // Courier-capacity Phase 5 (task-spec.md §11 P5): the queue's own per-part target carries
    // partIndex/partsTotal (UnassignedOrder), so the title says which part this is, the same way
    // HandedToCourierDialog's copy does. Absent/1 on every non-split target, unchanged title.
    const isSplitTarget = (order?.partsTotal ?? 1) > 1;

    const paperSx = {
        backgroundColor: SHEET_GROUND,
        border: '1px solid #f1eae4',
    };

    const body = (
        <>
            <DialogTitle sx={{ pb: 0.5, fontWeight: 700, fontSize: 18, color: INK }}>
                {assignable
                    ? (isSplitTarget
                        ? `Assign order ${orderLabel} — part ${order?.partIndex} of ${order?.partsTotal}`
                        : `Assign order ${orderLabel}`)
                    : `Order ${orderLabel}`}
            </DialogTitle>

            <DialogContent sx={{ pt: 2 }}>
                {card !== null ? (
                    <Box sx={{ mb: 3 }}>
                        <DeliveryOrderDetails
                            card={card}
                            freshnessBudgetMinutes={freshnessBudgetMinutes}
                        />
                    </Box>
                ) : order !== null && (
                    <Typography variant="body2" sx={{ color: MUTED, mb: 2 }}>
                        {order.addressLine ?? 'No address on file'}
                        {order.branchName !== null && ` — from ${order.branchName}`}
                    </Typography>
                )}

                {/* From both entry points: the queue is where a reassignment loop shows up first,
                    and the board is where a customer's "who has my order" gets asked. */}
                {order !== null && (
                    <Box sx={{ mb: assignable ? 3 : 0 }}>
                        <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 1 }}>
                            Assignment history
                        </Typography>
                        <DeliveryAssignmentTimeline orderId={order.orderId} />
                    </Box>
                )}

                {/* The engine's verdict belongs to the decision it explains. On an order still
                    waiting for a rider it is the whole point of the screen; on one already in
                    flight it answers a question nobody asked, and it was crowding out the order
                    details the dispatcher opened the card for. */}
                {availability !== undefined && assignable && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 0.5 }}>
                            Why this order is with this rider and not another
                        </Typography>
                        <Typography variant="caption" sx={{ color: MUTED, display: 'block', mb: 1.5 }}>
                            The engine's own ranking, and why the rest got no offer.
                        </Typography>
                        {availabilityLoading && (
                            <CircularProgress size={18} sx={{ mb: 1.5, color: brandRed }} />
                        )}
                        <Box sx={PANEL_CARD_SX}>
                            <CourierAvailabilityList rows={availability} loading={availabilityLoading} />
                        </Box>
                    </Box>
                )}

                {!assignable ? (
                    // Not a failure — it is the ordinary state of an order that is already on its
                    // way. Saying what to do instead beats a button that answers 409.
                    <PanelNotice tone="info">
                        A courier already holds this order, so it cannot be handed to someone else from
                        here. Release it from that courier's own list first.
                    </PanelNotice>
                ) : selectable.length === 0 ? (
                    // Not an error state: it means nobody is on shift, which is exactly why the
                    // order is sitting here. Saying so beats an empty box.
                    <Alert severity="info">
                        No courier is on shift right now. The order stays in the queue until one goes online.
                    </Alert>
                ) : (
                    <>
                        {/* Non-blocking: the manager can always press "Assign anyway" below. This
                            is the server's own capacity math, not a client guess — see
                            DispatcherService.manualAssign. */}
                        {warning !== null && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                {`This rider is already carrying ${warning.riderPizzas} `
                                    + `pizza${warning.riderPizzas === 1 ? '' : 's'}. This order adds `
                                    + `${warning.orderPizzas} more, for ${warning.totalPizzas} total — `
                                    + `over the ${warning.capacity}-pizza limit for one courier.`}
                            </Alert>
                        )}
                        <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 1 }}>
                            Hand it to a rider
                        </Typography>
                        <Box role="radiogroup" aria-label="Courier">
                            {selectable.map((courier) => {
                                const isSelected = selected === courier.courierId;
                                return (
                                    <Box
                                        key={courier.courierId}
                                        role="radio"
                                        aria-checked={isSelected}
                                        aria-label={courier.name ?? courier.courierId}
                                        tabIndex={0}
                                        onClick={() => selectCourier(courier.courierId)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                selectCourier(courier.courierId);
                                            }
                                        }}
                                        sx={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            gap: 1, p: 1.5, mb: 1, cursor: 'pointer', borderRadius: 2,
                                            border: `1px solid ${isSelected ? brandRed : '#e0e0e0'}`,
                                            backgroundColor: isSelected ? 'rgba(228,75,76,0.06)' : 'transparent',
                                        }}
                                    >
                                        <Typography>{courier.name ?? courier.courierId}</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Chip size="small" label={courier.status} />
                                            <Typography variant="caption" sx={{ color: MUTED }}>
                                                {courier.nearestBranchName ?? 'location unknown'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
                <Button
                    onClick={onClose}
                    sx={{ textTransform: 'none', color: MUTED, borderRadius: 999, px: 2.5 }}
                >
                    {assignable ? 'Cancel' : 'Close'}
                </Button>
                {assignable && (
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={selected === null || pending}
                        onClick={() => { void handlePress(); }}
                        sx={{
                            textTransform: 'none', backgroundColor: brandRed, borderRadius: 999,
                            px: 3, fontWeight: 700,
                            boxShadow: '0 6px 16px rgba(228,75,76,0.24)',
                            '&:hover': {
                                backgroundColor: brandRed, filter: 'brightness(0.94)',
                                boxShadow: '0 8px 20px rgba(228,75,76,0.28)',
                            },
                        }}
                    >
                        {pending
                            ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                            : (warning !== null ? 'Assign anyway' : 'Assign')}
                    </Button>
                )}
            </DialogActions>
        </>
    );

    /**
     * A centred modal is the wrong shape on a phone: it lands mid-screen, its actions sit far from
     * the thumb, and the roster inside it scrolls in a box inside a box. Below `sm` this is a
     * bottom sheet, which is what every other sheet in the app is (DESIGN.md, "Shape").
     *
     * One body, two shells -- deliberately not two components. The two would drift, and this one
     * carries the assignment action.
     */
    if (compact) {
        return (
            <Drawer
                anchor="bottom"
                open={order !== null}
                onClose={onClose}
                // The whole dispatcher panel is itself a fullScreen `Dialog` (AdminPageModals), and
                // MUI gives a temporary Drawer `zIndex.drawer` (1200) while a Dialog gets
                // `zIndex.modal` (1300). Nested, the sheet therefore rendered BEHIND the panel that
                // opened it -- on a phone the card simply did nothing when tapped, with no error and
                // nothing in the console. The desktop branch never showed it because a Dialog inside
                // a Dialog shares 1300 and wins on DOM order.
                sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
                SlideProps={{ onExited: resetOnExit }}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        ...paperSx,
                        // Corner-specific props are literal px, NOT multiplied by the theme's
                        // shape.borderRadius the way `borderRadius` is (DESIGN.md, the radius trap).
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        maxHeight: '90vh',
                    },
                }}
            >
                <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2, mx: 'auto', mt: 1.5 }} />
                {body}
            </Drawer>
        );
    }

    return (
        <Dialog
            open={order !== null}
            onClose={onClose}
            fullWidth
            // Wider only when it carries the roster: a picker of four names in a `sm` dialog is a
            // lot of empty paper, and the availability rows in an `xs` one wrap to shreds.
            maxWidth={availability === undefined ? 'xs' : 'sm'}
            TransitionProps={{ onExited: resetOnExit }}
            PaperProps={{
                elevation: 0,
                sx: { ...paperSx, borderRadius: 3, boxShadow: '0 12px 40px rgba(59,53,44,0.16)' },
            }}
        >
            {body}
        </Dialog>
    );
}
