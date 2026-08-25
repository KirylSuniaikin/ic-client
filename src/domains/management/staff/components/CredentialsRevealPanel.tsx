import * as React from "react";
import { useEffect, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { logger } from "../../../../shared/utils/logger";
import { BRAND_BUTTON_SX, NEUTRAL_BUTTON_SX } from "../../_shared/components/roundedSelect";
import { copyToClipboard } from "../utils/copyToClipboard";


export interface CredentialsRevealPanelProps {
    /** Heading above the credentials, e.g. "Successfully added" or "Password reset". */
    title: string;
    username: string;
    password: string;
    onDone: () => void;
    /** Prefix for this panel's data-testids, so each host keeps its own stable selectors. */
    testIdPrefix: string;
}

// The one-time reveal of a plaintext password. Extracted from HireStaffDrawer so the reset flow
// shows the identical thing rather than a second, subtly different copy -- the clipboard failure
// path in particular carries a real invariant: copyToClipboard THROWS on a failed execCommand,
// and a password the user believes was copied but wasn't is unrecoverable, because this is the
// only time it is ever displayed.
export default function CredentialsRevealPanel({
    title,
    username,
    password,
    onDone,
    testIdPrefix,
}: CredentialsRevealPanelProps): React.JSX.Element {
    const [copied, setCopied] = useState(false);
    const [autoCopied, setAutoCopied] = useState(false);
    const [copyError, setCopyError] = useState<string | null>(null);

    // Copy the moment the credentials appear: this is the only time the password is ever shown,
    // and the copy is what the manager is here for.
    //
    // A refusal is NOT surfaced as an error. Some WebViews reject a clipboard write outside a
    // user gesture, and this one runs after an await, so refusal is expected rather than
    // exceptional -- the button below is still there and unchanged. The only unrecoverable
    // outcome would be claiming a copy that did not happen, which is why success is set from the
    // resolved promise and nowhere else.
    useEffect(() => {
        let cancelled = false;
        void (async (): Promise<void> => {
            try {
                await copyToClipboard(`${username} / ${password}`);
                if (cancelled) return;
                setCopied(true);
                setAutoCopied(true);
            } catch (err) {
                logger.warn("Automatic clipboard copy was refused; the copy button still works:", err);
            }
        })();
        return () => { cancelled = true; };
    }, [username, password]);

    const handleCopy = async (): Promise<void> => {
        try {
            await copyToClipboard(`${username} / ${password}`);
            setCopyError(null);
            setCopied(true);
        } catch (err) {
            logger.error("Failed to copy credentials to clipboard:", err);
            setCopied(false);
            setCopyError(err instanceof Error ? err.message : "Failed to copy to clipboard");
        }
    };

    return (
        <Box data-testid={`${testIdPrefix}-credentials`}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, mb: 2, textAlign: "center", color: "#1f2430" }}>
                {title}
            </Typography>
            <TextField
                label="Login"
                fullWidth
                value={username}
                InputProps={{ readOnly: true }}
                sx={{ mb: 2 }}
                data-testid={`${testIdPrefix}-credentials-username`}
            />
            <TextField
                label="Password"
                fullWidth
                value={password}
                InputProps={{ readOnly: true }}
                sx={{ mb: 2 }}
                data-testid={`${testIdPrefix}-credentials-password`}
            />
            {autoCopied && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 2,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: "12px",
                        backgroundColor: "#eefaf3",
                        color: "#1f6f4a",
                    }}
                    data-testid={`${testIdPrefix}-auto-copied`}
                >
                    <CheckCircleRoundedIcon sx={{ fontSize: "1.1rem" }} />
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                        Copied to your clipboard.
                    </Typography>
                </Box>
            )}

            <Alert severity="warning" sx={{ mb: 2, borderRadius: "12px" }}>
                This password will not be shown again.
            </Alert>
            {copyError && (
                <Alert severity="error" sx={{ mb: 2 }} data-testid={`${testIdPrefix}-copy-error`}>
                    {copyError}
                </Alert>
            )}
            <Button
                fullWidth
                variant="contained"
                onClick={handleCopy}
                disableElevation
                sx={{ ...BRAND_BUTTON_SX, mb: 1 }}
                data-testid={`${testIdPrefix}-copy-button`}
            >
                {copied ? "Copied!" : "Copy login + password"}
            </Button>
            <Button fullWidth variant="outlined" onClick={onDone} sx={NEUTRAL_BUTTON_SX}>
                Done
            </Button>
        </Box>
    );
}
