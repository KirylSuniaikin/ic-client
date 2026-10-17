import { Box, Button, CircularProgress, IconButton, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { BRAND_RED } from "../../../shared/utils/theme";
import { CARD_FIELD_IDS } from "../hooks/useCardCheckout";
import type { CardCheckoutStep, CardFieldErrors } from "../hooks/useCardCheckout";
import { CustomerSheet } from "../../../shared/components/CustomerSheet";
import type { CustomerSheetDesktop } from "../../../shared/components/CustomerSheet";
import { SheetHandle } from "../../delivery/components/sheetStyles";

interface CardPaymentDrawerProps {
    open: boolean;
    step: CardCheckoutStep;
    total: string;
    fieldErrors: CardFieldErrors;
    error: string | null;
    fieldContainerRef: (node: HTMLElement | null) => void;
    onClose: () => void;
    onPay: () => void;
    onRetry: () => void;
}

type FieldKey = keyof typeof CARD_FIELD_IDS;
const FIELD_ORDER: readonly FieldKey[] = ["cardNumber", "expiryMonth", "expiryYear", "securityCode"];
const TITLE_ID = "card-payment-drawer-title";

// PC: a centred 480px dialog at the same 1350 as the phone sheet.
const CARD_DESKTOP = {
    placement: "center",
    width: 480,
    paperSx: { backgroundColor: "#fffcf8" },
} satisfies CustomerSheetDesktop;

const CTA_SX = {
    borderRadius: 999, py: 1.5, textTransform: "none", fontWeight: 700, color: "#fff",
    background: `linear-gradient(135deg, ${BRAND_RED} 0%, #D0393A 100%)`,
    "&:hover": { filter: "brightness(0.94)" },
} as const;

const FIELD_BOX_SX = {
    border: "1px solid #f1eae4",
    borderRadius: 3,
    px: 1.5,
    py: 1,
    bgcolor: "#ffffff",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    "& input": { width: "100%", border: 0, outline: 0, background: "transparent", fontSize: "1rem" },
} as const;

// Follows the bottom-sheet pattern of CashInputDrawer (the repo's canonical Drawer) with the
// brand-red CTA from DESIGN.md; the shared sheetStyles.tsx tokens do not exist in this checkout.
export default function CardPaymentDrawer({
    open, step, total, fieldErrors, error, fieldContainerRef, onClose, onPay, onRetry,
}: CardPaymentDrawerProps): React.JSX.Element {
    const { t } = useTranslation("cardPayment");
    const preparing = step === "preparing";
    const processing = step === "updatingSession" || step === "paying";
    const needsNewSession = step === "needsNewSession";

    return (
        <CustomerSheet
            open={open}
            onClose={onClose}
            sx={{ zIndex: 1350 }}
            labelledBy={TITLE_ID}
            desktop={CARD_DESKTOP}
            PaperProps={{
                role: "dialog",
                "aria-labelledby": TITLE_ID,
                sx: {
                    borderTopLeftRadius: { xs: 20, sm: 28 },
                    borderTopRightRadius: { xs: 20, sm: 28 },
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    backgroundImage: "none",
                    bgcolor: "#fffcf8",
                    maxHeight: "92vh",
                    overflowY: "auto",
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <SheetHandle />

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography id={TITLE_ID} variant="h6" fontWeight="bold" sx={{ color: "#3b352c" }}>
                        {t("drawer.title")}
                    </Typography>
                    <IconButton aria-label={t("drawer.close")} onClick={onClose} disabled={processing} size="small">
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                    <Typography sx={{ color: "#8a807a" }}>{t("drawer.total")}</Typography>
                    <Typography fontWeight="bold" sx={{ color: "#3b352c" }}>{total}</Typography>
                </Box>

                {preparing && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }} role="status">
                        <CircularProgress size={20} sx={{ color: BRAND_RED }} />
                        <Typography sx={{ color: "#8a807a" }}>{t("loading")}</Typography>
                    </Box>
                )}

                {/* Kept mounted (only hidden) while a new session is needed, so a retry can re-attach. */}
                <Box ref={fieldContainerRef} dir="ltr" sx={{ display: needsNewSession ? "none" : "block" }}>
                    {FIELD_ORDER.map(key => (
                        <Box key={key} sx={{ mb: 1.5 }}>
                            <Typography component="label" htmlFor={CARD_FIELD_IDS[key]} variant="body2" sx={{ color: "#8a807a", display: "block", mb: 0.5 }}>
                                {t(`fields.${key}`)}
                            </Typography>
                            <Box sx={{ ...FIELD_BOX_SX, ...(fieldErrors[key] ? { borderColor: BRAND_RED } : {}) }}>
                                {/* No `name`: the value is owned by the gateway's hosted field, never by our form. */}
                                <input
                                    id={CARD_FIELD_IDS[key]}
                                    title={t(`fields.${key}`)}
                                    aria-label={t(`fields.${key}`)}
                                    aria-invalid={fieldErrors[key] ? true : undefined}
                                    readOnly
                                />
                            </Box>
                        </Box>
                    ))}
                </Box>

                {error && (
                    <Typography role="alert" sx={{ color: BRAND_RED, mb: 2 }}>
                        {error}
                    </Typography>
                )}

                {needsNewSession ? (
                    <Button
                        fullWidth
                        onClick={onRetry}
                        sx={CTA_SX}
                    >
                        {t("actions.tryAgain")}
                    </Button>
                ) : (
                    <Button
                        fullWidth
                        onClick={onPay}
                        disabled={step !== "ready"}
                        aria-busy={processing}
                        sx={{
                            ...CTA_SX,
                            boxShadow: "0 10px 24px rgba(228,75,76,0.30)",
                            "&.Mui-disabled": { background: "#e9dedb", color: "#fff", boxShadow: "none" },
                        }}
                    >
                        {processing ? t("actions.paying") : t("actions.pay")}
                    </Button>
                )}
            </Box>
        </CustomerSheet>
    );
}
