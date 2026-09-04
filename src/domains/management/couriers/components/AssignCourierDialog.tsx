import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Alert,
    CircularProgress,
} from '@mui/material';
import type { CourierBoardRow, CourierStats, DispatchableOrder } from '../types';
import { CourierAvailabilityList } from './CourierAvailabilityList';
import { BRAND_RED as brandRed, MUTED, PANEL_CARD_SX, PanelNotice, SECTION_TITLE_SX } from './dispatcherStyles';

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
    couriers: CourierStats[];
    onClose: () => void;
    onAssign: (courierId: string) => void;
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
    couriers,
    onClose,
    onAssign,
    availability,
    availabilityLoading = false,
    assignable = true,
}: AssignCourierDialogProps): JSX.Element {
    const [selected, setSelected] = useState<string | null>(null);

    function isAvailable(courier: CourierStats): boolean {
        return !UNAVAILABLE_STATUSES.includes(courier.status);
    }

    const selectable = couriers.filter(isAvailable);
    const orderLabel = `#${order?.orderNo ?? order?.orderId ?? ''}`;

    return (
        <Dialog
            open={order !== null}
            onClose={onClose}
            fullWidth
            // Wider only when it carries the roster: a picker of four names in a `sm` dialog is a
            // lot of empty paper, and the availability rows in an `xs` one wrap to shreds.
            maxWidth={availability === undefined ? 'xs' : 'sm'}
            TransitionProps={{ onExited: () => setSelected(null) }}
        >
            <DialogTitle>
                {assignable ? `Assign order ${orderLabel}` : `Order ${orderLabel}`}
            </DialogTitle>

            <DialogContent dividers>
                {order !== null && (
                    <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                        {order.addressLine ?? 'No address on file'}
                        {order.branchName !== null && ` — from ${order.branchName}`}
                    </Typography>
                )}

                {availability !== undefined && (
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
                        {availability !== undefined && (
                            <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 1 }}>
                                Hand it to a rider
                            </Typography>
                        )}
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
                                        onClick={() => setSelected(courier.courierId)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                setSelected(courier.courierId);
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
                                            <Typography variant="caption" sx={{ color: '#666' }}>
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

            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform: 'none', color: '#666' }}>
                    {assignable ? 'Cancel' : 'Close'}
                </Button>
                {assignable && (
                    <Button
                        variant="contained"
                        disabled={selected === null}
                        onClick={() => { if (selected !== null) onAssign(selected); }}
                        sx={{ backgroundColor: brandRed, textTransform: 'none', '&:hover': { backgroundColor: brandRed } }}
                    >
                        Assign
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
