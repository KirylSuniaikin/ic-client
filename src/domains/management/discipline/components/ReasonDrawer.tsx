import React, { useEffect, useState } from "react";
import { Box, Button, Drawer, TextField, Typography } from "@mui/material";
import { BRAND_BUTTON_SX, NEUTRAL_BUTTON_SX, ROUNDED_FIELD_SX } from "../../_shared/components/roundedSelect";
import { SHEET_Z_INDEX } from "../../_shared/components/ResponsiveSheet";

export type ReasonDrawerProps = {
    open: boolean;
    title: string;
    fieldLabel: string;
    submitLabel: string;
    onSubmit: (text: string) => Promise<void>;
    onClose: () => void;
};

const ReasonDrawer: React.FC<ReasonDrawerProps> = ({
    open, title, fieldLabel, submitLabel, onSubmit, onClose,
}) => {
    const [text, setText] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const trimmed = text.trim();

    useEffect(() => {
        if (open) {
            setText("");
            setError(null);
        }
    }, [open]);

    const submit = async (): Promise<void> => {
        setBusy(true);
        setError(null);
        try {
            await onSubmit(trimmed);
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={busy ? undefined : onClose}
            sx={{ zIndex: SHEET_Z_INDEX }}
            PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxWidth: { sm: 500 }, mx: { sm: "auto" } } }}
        >
            <Box data-testid="reason-drawer" sx={{ p: 3, pb: 4 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 2 }}>{title}</Typography>
                <TextField
                    label={fieldLabel}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    multiline
                    minRows={3}
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 1000 }}
                    sx={ROUNDED_FIELD_SX}
                />
                {error !== null && (
                    <Typography role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
                        {error}
                    </Typography>
                )}
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    <Button
                        variant="contained"
                        sx={BRAND_BUTTON_SX}
                        disabled={trimmed === "" || busy}
                        onClick={() => void submit()}
                    >
                        {submitLabel}
                    </Button>
                    <Button sx={NEUTRAL_BUTTON_SX} disabled={busy} onClick={onClose}>Close</Button>
                </Box>
            </Box>
        </Drawer>
    );
};

export default ReasonDrawer;
