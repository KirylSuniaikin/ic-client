import { Alert } from "@mui/material";
import * as React from "react";

interface ApplePayNoticeProps {
    message: string | null;
}

// Deliberately not a Snackbar: no auto-hide or click-away, because the Apple Pay button stays
// blocked for as long as this is shown and the customer must not pay again.
export default function ApplePayNotice({ message }: ApplePayNoticeProps): React.JSX.Element | null {
    if (!message) return null;
    return (
        <Alert
            severity="warning"
            variant="filled"
            role="status"
            sx={{
                position: "fixed", top: { xs: 24, sm: 32 }, left: "50%", transform: "translateX(-50%)",
                width: { xs: "90%", sm: "auto" }, minWidth: { sm: 400 }, zIndex: 2500,
                fontSize: "1rem", borderRadius: 3, boxShadow: 6, fontWeight: 500,
            }}
        >
            {message}
        </Alert>
    );
}
