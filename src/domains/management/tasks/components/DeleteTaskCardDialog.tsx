import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Typography } from "@mui/material";
import type { TaskCard } from "../types";

export interface DeleteTaskCardDialogProps {
    open: boolean;
    card: TaskCard | null;
    submitting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function DeleteTaskCardDialog({ open, card, submitting, onConfirm, onCancel }: DeleteTaskCardDialogProps): JSX.Element {
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
                Delete Task
            </DialogTitle>
            <DialogContent sx={{ textAlign: "center", pb: 1.5 }}>
                <Typography fontSize="13px" color="text.secondary">
                    Are you sure you want to delete "{card?.title}"? This action cannot be undone.
                </Typography>
            </DialogContent>
            <Divider />
            <DialogActions sx={{ p: 0 }}>
                <Button
                    fullWidth
                    onClick={onCancel}
                    disabled={submitting}
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
                    disabled={submitting}
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
