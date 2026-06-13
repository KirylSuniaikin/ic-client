import {Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider} from "@mui/material";
import React from "react";
import Typography from "@mui/material/Typography";
import {Order} from "../../../order/types";

interface Props {
    open: boolean,
    order: Order,
    onConfirm: () => void,
    onCancel: () => void,
}

export function DeleteOrderDialog({ open, order, onConfirm, onCancel }: Props) {
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
                Delete Order
            </DialogTitle>
            <DialogContent sx={{ textAlign: "center", pb: 1.5 }}>
                <Typography fontSize="13px" color="text.secondary">
                    Are you sure you want to delete order #{order?.order_no}? This action cannot be undone.
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
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}