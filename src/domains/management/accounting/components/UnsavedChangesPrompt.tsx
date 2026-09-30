import * as React from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import ResponsiveSheet from "../../_shared/components/ResponsiveSheet";
import { BRAND_RED } from "../../../../shared/utils/theme";

interface Props {
    open: boolean;
    saving: boolean;
    onRevert: () => void;
    onSave: () => void;
    /** Backdrop, Escape and the close button: cancel, nothing is applied. */
    onDismiss: () => void;
}

export function UnsavedChangesPrompt({ open, saving, onRevert, onSave, onDismiss }: Props): React.JSX.Element {
    // The table stays editable behind the sheet, so dismissing mid-save would let later edits be overwritten by the save's result.
    const handleClose = (): void => {
        if (!saving) onDismiss();
    };

    return (
        <ResponsiveSheet open={open} onClose={handleClose} title="Unsaved changes" testId="unsaved-prompt">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                You have unsaved edits. Save or revert them before changing the sort or filters.
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5 }}>
                <Button
                    fullWidth
                    variant="outlined"
                    data-testid="unsaved-revert"
                    disabled={saving}
                    onClick={onRevert}
                    sx={{
                        borderRadius: 999,
                        textTransform: "none",
                        fontWeight: 700,
                        color: BRAND_RED,
                        borderColor: BRAND_RED,
                    }}
                >
                    Revert
                </Button>
                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    data-testid="unsaved-save"
                    disabled={saving}
                    onClick={onSave}
                    sx={{
                        borderRadius: 999,
                        textTransform: "none",
                        fontWeight: 700,
                        bgcolor: BRAND_RED,
                        "&:hover": { bgcolor: BRAND_RED },
                    }}
                >
                    {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
                </Button>
            </Box>
        </ResponsiveSheet>
    );
}
