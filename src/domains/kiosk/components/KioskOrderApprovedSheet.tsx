import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Divider, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { KioskSheet, KIOSK_BRAND_RED } from "./KioskSheet";
import { APPROVED_AUTO_RETURN_MS } from "../config";
import type { PaymentResultResponse } from "../../../shared/api/kiosk";

interface KioskOrderApprovedSheetProps {
    open: boolean;
    result: PaymentResultResponse | null;
    onDone: () => void;
}

/** One label/value row of the transaction summary. Rendered only when the value is present. */
function DetailRow({ label, value }: { label: string; value: string | null }): JSX.Element | null {
    if (!value) return null;
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.5 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{label}</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ textAlign: "end" }}>{value}</Typography>
        </Box>
    );
}

/**
 * Payment approved. By the time this renders the backend has already settled the transaction and
 * pushed the ticket to the kitchen — there is nothing left for the client to send.
 *
 * Auto-returns to the menu so a customer who walks off doesn't leave their receipt details on
 * screen for the next person.
 */
export function KioskOrderApprovedSheet({ open, result, onDone }: KioskOrderApprovedSheetProps): JSX.Element {
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

    // The DCC fields are a regulatory disclosure supplied by EazyPay, not decoration. A normal BHD
    // transaction returns none of them, so the whole block is hidden rather than showing blanks.
    const hasDcc = Boolean(result?.dccMsg ?? result?.dccRate ?? result?.dccAmount);

    return (
        <KioskSheet open={open} scrollable>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <CheckCircleIcon sx={{ fontSize: 64, color: "#32a852", mb: 1.5 }} />
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                    {t("approved.title")}
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 2 }}>
                    {t("approved.subtitle")}
                </Typography>

                {result?.orderId != null && (
                    <>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {t("approved.orderNumberLabel")}
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" sx={{ color: KIOSK_BRAND_RED, mb: 2 }}>
                            {result.orderId}
                        </Typography>
                    </>
                )}
            </Box>

            {result && (
                <Box sx={{ width: "100%", mb: 2 }}>
                    <Divider sx={{ mb: 1 }} />
                    <DetailRow label={t("approved.amountLabel")} value={result.amount} />
                    <DetailRow label={t("approved.cardLabel")} value={result.cardNo} />
                    <DetailRow label={t("approved.authCodeLabel")} value={result.trnAuthCode} />
                    <DetailRow label={t("approved.referenceLabel")} value={result.trnRrn} />
                    <DetailRow label={t("approved.entryLabel")} value={result.posEntryMode} />

                    {hasDcc && (
                        <>
                            <Divider sx={{ my: 1.5 }} />
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
                                {t("approved.dccTitle")}
                            </Typography>
                            <DetailRow label={t("approved.dccNoticeLabel")} value={result.dccMsg} />
                            <DetailRow label={t("approved.dccConvertedLabel")} value={result.dccAmount} />
                            <DetailRow label={t("approved.dccRateLabel")} value={result.dccRate} />
                            <DetailRow label={t("approved.dccMarkupLabel")} value={result.dccMarkup} />
                            <DetailRow label={t("approved.dccFromLabel")} value={result.dccCurrencyEx} />
                        </>
                    )}
                    <Divider sx={{ mt: 1 }} />
                </Box>
            )}

            <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", mb: 2 }}>
                {t("approved.receiptNote")}
            </Typography>

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
                {t("approved.done")}
            </Button>

            <Typography variant="caption" sx={{ display: "block", textAlign: "center", color: "text.secondary", mt: 1.5 }}>
                {t("approved.countdown", { count: secondsRemaining })}
            </Typography>
        </KioskSheet>
    );
}

export default KioskOrderApprovedSheet;
