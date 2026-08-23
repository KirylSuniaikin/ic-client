import * as React from "react";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Drawer, Stack, TextField, Typography } from "@mui/material";
import { logger } from "../../../../shared/utils/logger";
import { generatePassword } from "../utils/generatePassword";
import type { StaffAdminTO } from "../types";
import CredentialsRevealPanel from "./CredentialsRevealPanel";

const colorRed = "#E44B4C";

export interface ResetPasswordDrawerProps {
    open: boolean;
    target: StaffAdminTO | null;
    onClose: () => void;
    resetPassword: (id: number, password: string) => Promise<void>;
}

export default function ResetPasswordDrawer({
    open,
    target,
    onClose,
    resetPassword,
}: ResetPasswordDrawerProps): React.JSX.Element {
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [revealed, setRevealed] = useState(false);

    // Seeded on open: unlike hire, where the manager is filling five fields anyway, a reset has
    // exactly one input and the generated value is the answer almost every time.
    useEffect(() => {
        if (open) setPassword(generatePassword());
    }, [open]);

    // One-time reveal: once dismissed, nothing here still holds the plaintext.
    useEffect(() => {
        if (open) return;
        setPassword("");
        setSubmitting(false);
        setFormError(null);
        setRevealed(false);
    }, [open]);

    const handleSubmit = async (): Promise<void> => {
        if (!target || password.trim() === "") return;
        setSubmitting(true);
        setFormError(null);
        try {
            await resetPassword(target.id, password);
            setRevealed(true);
        } catch (err) {
            logger.error("Failed to reset staff password:", err);
            // The field is deliberately not cleared: the manager may want to retry the same value.
            setFormError(err instanceof Error ? err.message : "Failed to reset the password");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{ zIndex: 1350 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    maxHeight: "90vh",
                    overflowY: "auto",
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }} data-testid="reset-password-drawer">
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                {revealed && target ? (
                    <CredentialsRevealPanel
                        title="Password reset"
                        username={target.username}
                        password={password}
                        onDone={onClose}
                        testIdPrefix="reset-password"
                    />
                ) : (
                    <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, textAlign: "center" }}>
                            Reset password
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: "center" }}>
                            {target?.fullName ?? target?.username} ({target?.username})
                        </Typography>

                        {formError && (
                            <Alert severity="error" sx={{ mb: 2 }} data-testid="reset-password-error">
                                {formError}
                            </Alert>
                        )}

                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                            <TextField
                                label="New password"
                                fullWidth
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                data-testid="reset-password-field"
                            />
                            <Button
                                variant="outlined"
                                onClick={() => setPassword(generatePassword())}
                                sx={{ whiteSpace: "nowrap" }}
                                data-testid="reset-password-generate"
                            >
                                Generate
                            </Button>
                        </Stack>

                        {/* Says the true thing: there is no passwordChangedAt and no revocation
                            list, so a token issued before this reset keeps working until it
                            expires. Deactivation is the action that cuts access immediately. */}
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Resetting does not sign this person out. To end their current session,
                            deactivate the account.
                        </Alert>

                        <Button
                            fullWidth
                            variant="contained"
                            disabled={submitting || password.trim() === ""}
                            onClick={() => { void handleSubmit(); }}
                            sx={{ borderRadius: 3, py: 1.5, bgcolor: colorRed, mb: 1, "&:hover": { bgcolor: "#c73c3d" } }}
                            data-testid="reset-password-submit"
                        >
                            Reset password
                        </Button>
                        <Button fullWidth variant="outlined" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
}
