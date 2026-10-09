import React, { useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useMyViolationActions } from "../hooks/useMyViolationActions";

export type DisputeButtonProps = {
    violationId: number;
    onDone: () => void;
};

const DisputeButton: React.FC<DisputeButtonProps> = ({ violationId, onDone }) => {
    const [open, setOpen] = useState<boolean>(false);
    const [reason, setReason] = useState<string>("");
    const { dispute, busyIds, error } = useMyViolationActions(onDone);
    const busy = busyIds.has(violationId);
    const trimmed = reason.trim();

    if (!open) {
        return (
            <Button size="small" onClick={() => setOpen(true)} sx={{ mt: 0.5 }}>
                Dispute
            </Button>
        );
    }
    return (
        <Box sx={{ mt: 1 }}>
            <TextField
                label="Reason for dispute"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                size="small"
                inputProps={{ maxLength: 1000 }}
            />
            {error !== null && (
                <Typography role="alert" variant="body2" color="error" sx={{ mt: 0.5 }}>
                    {error}
                </Typography>
            )}
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <Button
                    variant="contained"
                    size="small"
                    disabled={trimmed === "" || busy}
                    onClick={() => void dispute(violationId, trimmed)}
                >
                    Send dispute
                </Button>
                <Button size="small" disabled={busy} onClick={() => setOpen(false)}>
                    Cancel
                </Button>
            </Box>
        </Box>
    );
};

export default DisputeButton;
