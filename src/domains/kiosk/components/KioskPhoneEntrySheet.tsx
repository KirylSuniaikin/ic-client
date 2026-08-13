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
    /** Receives the full "973########" string the backend's `tel` field expects, plus the name. */
    onSubmit: (tel: string, name: string) => void;
}

/**
 * The kiosk's data-entry step: name and phone number.
 *
 * Still no branch picker — the backend derives the branch from the paired kiosk. The name was
 * deliberately absent at first (every extra field is one more thing a walk-up customer has to type
 * on a touchscreen) and was added back because an order nobody can call out is worse than a field.
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
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    // A fresh customer must never find the previous one's details already typed in.
    useEffect(() => {
        if (!open) {
            setDigits("");
            setName("");
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
        // Name first: it is the field above, so reporting the phone problem while the name is also
        // empty would point at the wrong box.
        if (name.trim() === "") {
            setError(t("checkout:clientInfo.errors.nameRequired"));
            return;
        }
        if (digits.length !== PHONE_DIGIT_COUNT) {
            setError(t("checkout:clientInfo.errors.phoneLength", { count: PHONE_DIGIT_COUNT }));
            return;
        }
        setError(null);
        onSubmit(PHONE_COUNTRY_CODE + digits, name.trim());
    }

    return (
        <KioskSheet open={open} onClose={submitting ? undefined : onClose}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, textAlign: "center" }}>
                {t("kiosk:phone.title")}
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, textAlign: "center", color: "text.secondary" }}>
                {t("kiosk:phone.subtitle")}
            </Typography>

            {/* Name before phone: it is what gets called out when the order is ready, and the
                phone field's numeric keypad is the natural last step before Pay. */}
            <TextField
                autoFocus
                fullWidth
                variant="outlined"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder={t("checkout:clientInfo.name")}
                disabled={submitting}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                inputProps={{ maxLength: 60, "aria-label": t("checkout:clientInfo.name") }}
                InputProps={{ sx: { borderRadius: 4, fontSize: "1.4rem", fontWeight: "bold" } }}
                sx={{ mb: 1.5 }}
            />

            <TextField
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
