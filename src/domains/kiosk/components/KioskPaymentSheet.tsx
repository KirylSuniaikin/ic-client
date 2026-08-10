import { useTranslation } from "react-i18next";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { KioskSheet, KIOSK_BRAND_RED } from "./KioskSheet";

interface KioskPaymentSheetProps {
    open: boolean;
    secondsRemaining: number;
    /** Transient poll failure — shown as "reconnecting", never as a failed payment. */
    pollError: string | null;
    onCancel: () => void;
}

/**
 * "Tap your card" — shown while the customer is at the terminal.
 *
 * Not dismissible by backdrop tap or Escape while the payment is live: backing out mid-transaction
 * would strand a charge with no order attached to it. Cancelling has to go through the explicit
 * button, which releases the terminal properly.
 */
export function KioskPaymentSheet({
    open,
    secondsRemaining,
    pollError,
    onCancel,
}: KioskPaymentSheetProps): JSX.Element {
    const { t } = useTranslation("kiosk");

    return (
        <KioskSheet open={open}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <Box sx={{ position: "relative", display: "inline-flex", mb: 3 }}>
                    <CircularProgress size={96} thickness={2.5} sx={{ color: KIOSK_BRAND_RED }} />
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <CreditCardIcon sx={{ fontSize: 40, color: KIOSK_BRAND_RED }} />
                    </Box>
                </Box>

                <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                    {t("payment.title")}
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
                    {t("payment.subtitle")}
                </Typography>

                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                    {t("payment.secondsRemaining", { count: secondsRemaining })}
                </Typography>

                {/* A network blip is worth showing, but it must not read as a declined card — the
                    charge may still be completing at the terminal. */}
                <Box sx={{ minHeight: 24, mb: 1 }}>
                    {pollError && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {t("payment.reconnecting")}
                        </Typography>
                    )}
                </Box>

                <Button
                    variant="outlined"
                    onClick={onCancel}
                    sx={{
                        borderRadius: 3,
                        py: 1.25,
                        px: 5,
                        color: "text.secondary",
                        borderColor: "grey.400",
                        textTransform: "none",
                        fontWeight: 600,
                        "&:hover": { borderColor: "grey.600", bgcolor: "transparent" },
                    }}
                >
                    {t("payment.cancel")}
                </Button>
            </Box>
        </KioskSheet>
    );
}

export default KioskPaymentSheet;
