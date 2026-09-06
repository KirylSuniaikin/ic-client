import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Typography } from "@mui/material";
import { shortStaffName, staffDisplayName } from "../../../../shared/utils/staffName";
import type { StaffAdminTO } from "../types";

export interface DeactivateStaffDialogProps {
    open: boolean;
    target: StaffAdminTO | null;
    submitting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

// Follows DeleteTaskCardDialog exactly -- there is no generic ConfirmDialog in this codebase and
// this is not the task to introduce one. Only deactivation is confirmed; reactivating is not
// destructive and fires straight from the row.
export default function DeactivateStaffDialog({
    open,
    target,
    submitting,
    onConfirm,
    onCancel,
}: DeactivateStaffDialogProps): React.JSX.Element {
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            PaperProps={{ sx: { borderRadius: "14px", width: 270, m: 2 } }}
        >
            <DialogTitle sx={{ fontSize: "13px", fontWeight: 600, textAlign: "center", pb: 0.5, pt: 2.5 }}>
                Deactivate account
            </DialogTitle>
            <DialogContent sx={{ textAlign: "center", pb: 1.5 }} data-testid="deactivate-staff-dialog">
                {/* Literally true since TokenFilter began checking Staff.enabled: an open session
                    stops working on its next request, it does not run until the token expires. */}
                <Typography fontSize="13px" color="text.secondary">
                    Deactivate {target?.fullName ?? target?.username}? They will be signed out
                    immediately and will not be able to log in.
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
                    sx={{ borderRadius: 0, py: 1.4, fontSize: "13px", color: "#E44B4C", fontWeight: 600 }}
                    data-testid="deactivate-staff-confirm"
                >
                    Deactivate
                </Button>
            </DialogActions>
        </Dialog>
    );
}
