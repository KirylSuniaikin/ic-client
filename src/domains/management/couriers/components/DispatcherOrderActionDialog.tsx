import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
} from '@mui/material';
import type { CourierOrderSummary } from '../types';
import { BRAND_RED as brandRed } from './dispatcherStyles';

/** Which of the two destructive dispatcher actions the manager is about to fire. */
export type DispatcherOrderAction = 'release' | 'cancel';

/**
 * Confirms the two destructive actions on a courier's order (release / cancel).
 *
 * Built as a MUI `Dialog` to match `AssignCourierDialog` and `DeleteOrderDialog` — the same
 * management surface and the same kind of decision.
 *
 * The cancel copy names the refund situation out loud. There is no refund code anywhere in this
 * system (see DispatcherService.cancel: "No money semantics anywhere in this method"), so a
 * manager who reads a bare "Cancel this order?" would reasonably assume the customer is paid back
 * automatically. They are not — somebody has to do it by hand in the EazyPay console.
 */
export interface DispatcherOrderActionDialogProps {
    /** The action being confirmed; null closes the dialog. */
    action: DispatcherOrderAction | null;
    order: CourierOrderSummary | null;
    /** Who currently holds the order — named in the release copy so the manager sees the effect. */
    courierName: string;
    onClose: () => void;
    onConfirm: () => void;
}

export function DispatcherOrderActionDialog({
    action,
    order,
    courierName,
    onClose,
    onConfirm,
}: DispatcherOrderActionDialogProps): JSX.Element {
    const orderLabel = order === null ? '' : `#${order.orderNo ?? order.orderId}`;
    const isCancel = action === 'cancel';
    // Courier-capacity Phase 5 (D6/task-spec.md §11 P5): release is per-part when the order is
    // genuinely split; cancel stays wired to the whole order and its copy is UNCHANGED regardless
    // of which part's row it was pressed from.
    const isSplitPart = order !== null && (order.partsTotal ?? 1) > 1;

    return (
        <Dialog open={action !== null && order !== null} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>
                {isCancel ? `Cancel order ${orderLabel}` : `Release order ${orderLabel}`}
            </DialogTitle>

            <DialogContent dividers>
                {isCancel ? (
                    <>
                        <Typography variant="body2" sx={{ color: '#3b352c', mb: 1.5 }}>
                            This stops the delivery for order {orderLabel} and takes it off {courierName}.
                            The order itself is kept — nothing is deleted.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#b3261e', fontWeight: 700 }}>
                            No money is returned to the customer. This system does not issue refunds:
                            if the customer has already paid, you must refund them by hand in the
                            EazyPay console.
                        </Typography>
                    </>
                ) : isSplitPart && order !== null ? (
                    <Typography variant="body2" sx={{ color: '#3b352c' }}>
                        This takes part {order.partIndex} of {order.partsTotal} of order {orderLabel} off{' '}
                        {courierName} and leaves that part unassigned. It is not offered to anyone
                        automatically — it goes back to the waiting list for you to assign. The rest of
                        the order is unaffected.
                    </Typography>
                ) : (
                    <Typography variant="body2" sx={{ color: '#3b352c' }}>
                        This takes order {orderLabel} off {courierName} and leaves it unassigned.
                        It is not offered to anyone automatically — it goes back to the waiting list
                        for you to assign.
                    </Typography>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform: 'none', color: '#666' }}>
                    Keep it
                </Button>
                <Button
                    variant="contained"
                    onClick={onConfirm}
                    sx={{ backgroundColor: brandRed, textTransform: 'none',
                          '&:hover': { backgroundColor: brandRed } }}
                >
                    {isCancel ? 'Cancel order' : 'Release order'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
