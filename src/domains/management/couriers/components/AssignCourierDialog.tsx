import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Alert,
} from '@mui/material';
import type { CourierStats, UnassignedOrder } from '../types';

const brandRed = '#E44B4C';

/**
 * Statuses the server refuses to assign to (DispatcherService.manualAssign returns 409 for both).
 * Listed here so an offline rider is visibly unavailable rather than a button that fails.
 */
const UNAVAILABLE_STATUSES = ['OFFLINE', 'BLACKLISTED'];

/**
 * Picks the courier for a manual assignment (DELIVERY_SPEC.md §2.3).
 *
 * The escape hatch for when the assignment engine has run out of options: every courier refused,
 * or none was free. The order is not cancelled and does not fall back to Keeta — the customer has
 * already paid — so a human puts it on a specific rider.
 *
 * BUSY couriers are shown and selectable on purpose. §2.3 is the case where the automatic queue
 * has already failed, and a manager who can see the board may well decide the rider two streets
 * away should take a second drop. Only the two states the server rejects are blocked here.
 */
export interface AssignCourierDialogProps {
    /** The order being assigned; null closes the dialog. */
    order: UnassignedOrder | null;
    couriers: CourierStats[];
    onClose: () => void;
    onAssign: (courierId: string) => void;
}

export function AssignCourierDialog({
    order,
    couriers,
    onClose,
    onAssign,
}: AssignCourierDialogProps): JSX.Element {
    const [selected, setSelected] = useState<string | null>(null);

    function isAvailable(courier: CourierStats): boolean {
        return !UNAVAILABLE_STATUSES.includes(courier.status);
    }

    const selectable = couriers.filter(isAvailable);

    return (
        <Dialog
            open={order !== null}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            TransitionProps={{ onExited: () => setSelected(null) }}
        >
            <DialogTitle>
                Assign order #{order?.orderNo ?? order?.orderId ?? ''}
            </DialogTitle>

            <DialogContent dividers>
                {order !== null && (
                    <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                        {order.addressLine ?? 'No address on file'}
                        {order.branchName !== null && ` — from ${order.branchName}`}
                    </Typography>
                )}

                {selectable.length === 0 ? (
                    // Not an error state: it means nobody is on shift, which is exactly why the
                    // order is sitting here. Saying so beats an empty box.
                    <Alert severity="info">
                        No courier is on shift right now. The order stays in the queue until one goes online.
                    </Alert>
                ) : (
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
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform: 'none', color: '#666' }}>Cancel</Button>
                <Button
                    variant="contained"
                    disabled={selected === null}
                    onClick={() => { if (selected !== null) onAssign(selected); }}
                    sx={{ backgroundColor: brandRed, textTransform: 'none', '&:hover': { backgroundColor: brandRed } }}
                >
                    Assign
                </Button>
            </DialogActions>
        </Dialog>
    );
}
