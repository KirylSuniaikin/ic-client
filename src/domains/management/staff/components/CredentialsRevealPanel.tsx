import * as React from "react";
import { useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { logger } from "../../../../shared/utils/logger";
import { copyToClipboard } from "../utils/copyToClipboard";

const colorRed = "#E44B4C";

export interface CredentialsRevealPanelProps {
    /** Heading above the credentials, e.g. "Staff hired" or "Password reset". */
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
    const [copyError, setCopyError] = useState<string | null>(null);

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
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, textAlign: "center" }}>
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
            <Alert severity="warning" sx={{ mb: 2 }}>
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
                sx={{ borderRadius: 3, py: 1.5, bgcolor: colorRed, mb: 1, "&:hover": { bgcolor: "#c73c3d" } }}
                data-testid={`${testIdPrefix}-copy-button`}
            >
                {copied ? "Copied!" : "Copy login + password"}
            </Button>
            <Button fullWidth variant="outlined" onClick={onDone}>
                Done
            </Button>
        </Box>
    );
}
