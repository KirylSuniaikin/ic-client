import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider } from "@mui/material";
import React from "react";
import Typography from "@mui/material/Typography";
import { Order } from "../../../order/types";

/**
 * Confirms the kitchen's hand-over to the rider.
 *
 * There IS a confirm here, unlike OVEN/READY, because this is the tap the whole change was made
 * to protect: it is one-way from this board — the card leaves the screen and the customer is told
 * their order is on its way — and the defect being fixed is precisely an accidental tap doing
 * that. Moving the button from the courier app to the kitchen tablet without a confirm would
 * simply reproduce the accident on a new screen.
 *
 * A `Dialog`, not the repo-wide `Drawer anchor="bottom"` convention for new popups: the admin
 * board's confirms are all dialogs (`DeleteOrderDialog` here, `AssignCourierDialog` and
 * `DispatcherOrderActionDialog` next door), and a confirm that answers a tap on a card should
 * look like the other confirms staff already answer on the same screen.
 */
interface Props {
    open: boolean;
    order: Order;
    onConfirm: () => void;
    onCancel: () => void;
}

export function HandedToCourierDialog({ open, order, onConfirm, onCancel }: Props): JSX.Element {
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            PaperProps={{
                sx: {
                    borderRadius: "14px",
                    width: 270,
                    m: 2,
                }
            }}
        >
            <DialogTitle sx={{
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "center",
                pb: 0.5,
                pt: 2.5,
            }}>
                Hand over to courier
            </DialogTitle>
            <DialogContent sx={{ textAlign: "center", pb: 1.5 }}>
                <Typography fontSize="13px" color="text.secondary">
                    Confirm order #{order?.order_no} has been handed to the courier. It leaves this
                    board and the customer is told it is on the way.
                </Typography>
            </DialogContent>
            <Divider />
            <DialogActions sx={{ p: 0 }}>
                <Button
                    fullWidth
                    onClick={onCancel}
                    sx={{
                        borderRadius: 0,
                        py: 1.4,
                        fontSize: "13px",
                        color: "text.secondary",
                        fontWeight: 400,
                        borderRight: "0.5px solid",
                        borderColor: "divider",
                    }}
                >
                    Cancel
                </Button>
                <Button
                    fullWidth
                    onClick={onConfirm}
                    sx={{
                        borderRadius: 0,
                        py: 1.4,
                        fontSize: "13px",
                        color: "#E44B4C",
                        fontWeight: 600,
                    }}
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
}
