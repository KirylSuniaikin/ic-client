import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, CircularProgress, InputAdornment, TextField, Typography } from "@mui/material";
import { KioskSheet, KIOSK_BRAND_RED } from "./KioskSheet";
import { PHONE_COUNTRY_CODE, PHONE_DIGIT_COUNT } from "../config";

interface KioskPhoneEntrySheetProps {
    open: boolean;
    /** True while the order is being created and the terminal armed. */
    submitting: boolean;
    /** Order/terminal failure from the checkout hook — distinct from local digit validation. */
    checkoutError: string | null;
    onClose: () => void;
    /** Receives the full "973########" string the backend's `tel` field expects. */
    onSubmit: (tel: string) => void;
}

/**
 * The kiosk's only data-entry step: a phone number, nothing else.
 *
 * Deliberately no name field and no branch picker (locked product decision): the backend derives
 * the branch from the paired kiosk, and every extra field is another thing a walk-up customer has
 * to type on a touchscreen.
 */
export function KioskPhoneEntrySheet({
    open,
    submitting,
    checkoutError,
    onClose,
    onSubmit,
}: KioskPhoneEntrySheetProps): JSX.Element {
    const { t } = useTranslation(["kiosk", "checkout"]);
    const [digits, setDigits] = useState("");
    const [error, setError] = useState<string | null>(null);

    // A fresh customer must never find the previous one's number already typed in.
    useEffect(() => {
        if (!open) {
            setDigits("");
            setError(null);
        }
    }, [open]);

    function handleChange(value: string): void {
        if (value !== "" && !/^\d+$/.test(value)) {
            setError(t("checkout:clientInfo.errors.onlyDigits"));
            return;
        }
        setError(null);
        setDigits(value.slice(0, PHONE_DIGIT_COUNT));
    }

    function handleSubmit(): void {
        if (digits.length !== PHONE_DIGIT_COUNT) {
            setError(t("checkout:clientInfo.errors.phoneLength", { count: PHONE_DIGIT_COUNT }));
            return;
        }
        setError(null);
        onSubmit(PHONE_COUNTRY_CODE + digits);
    }

    return (
        <KioskSheet open={open} onClose={submitting ? undefined : onClose}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, textAlign: "center" }}>
                {t("kiosk:phone.title")}
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, textAlign: "center", color: "text.secondary" }}>
                {t("kiosk:phone.subtitle")}
            </Typography>

            <TextField
                autoFocus
                fullWidth
                variant="outlined"
                value={digits}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={t("kiosk:phone.placeholder")}
                disabled={submitting}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                inputProps={{ inputMode: "numeric", maxLength: PHONE_DIGIT_COUNT, "aria-label": t("kiosk:phone.placeholder") }}
                InputProps={{
                    startAdornment: <InputAdornment position="start">+{PHONE_COUNTRY_CODE}</InputAdornment>,
                    sx: { borderRadius: 4, fontSize: "1.4rem", fontWeight: "bold", letterSpacing: 1 },
                }}
                sx={{ mb: 1 }}
            />

            {/* Local digit validation and a failed order attempt are different problems; both land
                here, but neither ever clears what the customer typed. */}
            <Box sx={{ minHeight: 24, mb: 1.5 }}>
                {(error ?? checkoutError) && (
                    <Typography variant="caption" sx={{ color: KIOSK_BRAND_RED }}>
                        {error ?? checkoutError}
                    </Typography>
                )}
            </Box>

            <Button
                fullWidth
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting}
                sx={{
                    borderRadius: 3,
                    py: 1.5,
                    bgcolor: KIOSK_BRAND_RED,
                    color: "white",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    boxShadow: "none",
                    "&:hover": { bgcolor: "#c73c3d", boxShadow: "none" },
                }}
            >
                {submitting ? <CircularProgress size={24} sx={{ color: "white" }} /> : t("kiosk:phone.submit")}
            </Button>
        </KioskSheet>
    );
}

export default KioskPhoneEntrySheet;
