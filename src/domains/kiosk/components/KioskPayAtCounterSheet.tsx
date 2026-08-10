import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Typography } from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { KioskSheet, KIOSK_BRAND_RED } from "./KioskSheet";
import { APPROVED_AUTO_RETURN_MS } from "../config";

interface KioskPayAtCounterSheetProps {
    open: boolean;
    orderId: string | null;
    onDone: () => void;
}

/**
 * The card failed and the customer chose to pay at the front desk. The order has already been
 * published to the kitchen as unpaid/Cash by the backend's defer-to-counter endpoint, so all that
 * is left is telling the customer which number to quote.
 */
export function KioskPayAtCounterSheet({ open, orderId, onDone }: KioskPayAtCounterSheetProps): JSX.Element {
    const { t } = useTranslation("kiosk");
    const [secondsRemaining, setSecondsRemaining] = useState(Math.floor(APPROVED_AUTO_RETURN_MS / 1000));

    useEffect(() => {
        if (!open) return;
        setSecondsRemaining(Math.floor(APPROVED_AUTO_RETURN_MS / 1000));
        const interval = setInterval(() => {
            setSecondsRemaining((seconds) => Math.max(seconds - 1, 0));
        }, 1000);
        const timeout = setTimeout(onDone, APPROVED_AUTO_RETURN_MS);
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [open, onDone]);

    return (
        <KioskSheet open={open}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <StorefrontIcon sx={{ fontSize: 56, color: KIOSK_BRAND_RED, mb: 1.5 }} />
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {t("counter.title")}
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 2 }}>
                    {t("counter.subtitle")}
                </Typography>

                {orderId && (
                    <>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {t("counter.orderNumberLabel")}
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: KIOSK_BRAND_RED, mb: 3 }}>
                            {orderId}
                        </Typography>
                    </>
                )}

                <Button
                    fullWidth
                    variant="contained"
                    onClick={onDone}
                    sx={{
                        borderRadius: 3,
                        py: 1.5,
                        bgcolor: KIOSK_BRAND_RED,
                        color: "white",
                        fontSize: "1rem",
                        fontWeight: "bold",
                        textTransform: "none",
                        boxShadow: "none",
                        "&:hover": { bgcolor: "#c73c3d", boxShadow: "none" },
                    }}
                >
                    {t("counter.done")}
                </Button>

                <Typography variant="caption" sx={{ color: "text.secondary", mt: 1.5 }}>
                    {t("approved.countdown", { count: secondsRemaining })}
                </Typography>
            </Box>
        </KioskSheet>
    );
}

export default KioskPayAtCounterSheet;
