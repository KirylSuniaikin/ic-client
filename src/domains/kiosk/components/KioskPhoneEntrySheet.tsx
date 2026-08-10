import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, CircularProgress, MenuItem, Select, TextField, Typography } from "@mui/material";
import { KioskSheet, KIOSK_BRAND_RED, KIOSK_SHEET_Z_INDEX } from "./KioskSheet";
import { countries, localizedCountryName } from "../../../shared/utils/countries";

interface KioskPhoneEntrySheetProps {
    open: boolean;
    /** True while the order is being created. */
    submitting: boolean;
    /** Order failure from the checkout hook — distinct from local digit validation. */
    checkoutError: string | null;
    onClose: () => void;
    /** Receives the country code joined to the digits, e.g. "97312345678". */
    onSubmit: (tel: string) => void;
}

/**
 * The kiosk's only data-entry step: a phone number, nothing else.
 *
 * Deliberately no name field and no branch picker (locked product decision): the branch comes from
 * the device's own setup, and every extra field is another thing a walk-up customer has to type on
 * a touchscreen.
 *
 * The country selector is the same shared `countries` list ClientInfoPopup and CustomerLoginPopup
 * use — a kiosk sits in one country, so it opens on the first entry (Bahrain), but a visitor with
 * a foreign number must still be able to leave one that can actually be called back.
 */
export function KioskPhoneEntrySheet({
    open,
    submitting,
    checkoutError,
    onClose,
    onSubmit,
}: KioskPhoneEntrySheetProps): JSX.Element {
    const { t, i18n } = useTranslation(["kiosk", "checkout"]);
    const [selectedCountry, setSelectedCountry] = useState(countries[0].name);
    const [digits, setDigits] = useState("");
    const [error, setError] = useState<string | null>(null);

    const country = countries.find(c => c.name === selectedCountry) ?? countries[0];

    // A fresh customer must never find the previous one's number — or country — already selected.
    useEffect(() => {
        if (!open) {
            setSelectedCountry(countries[0].name);
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
        setDigits(value.slice(0, country.digits));
    }

    function handleCountryChange(name: string): void {
        setSelectedCountry(name);
        // Each country has its own length, so digits typed for the previous one may now overflow.
        // Truncating beats clearing: the customer keeps what still fits.
        const next = countries.find(c => c.name === name);
        if (next) setDigits(prev => prev.slice(0, next.digits));
        setError(null);
    }

    function handleSubmit(): void {
        if (digits.length !== country.digits) {
            setError(t("checkout:clientInfo.errors.phoneLength", { count: country.digits }));
            return;
        }
        setError(null);
        onSubmit(country.code + digits);
    }

    return (
        <KioskSheet open={open} onClose={submitting ? undefined : onClose}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, textAlign: "center" }}>
                {t("kiosk:phone.title")}
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, textAlign: "center", color: "text.secondary" }}>
                {t("kiosk:phone.subtitle")}
            </Typography>

            {/* One field, read left to right: "+973 12345678". The code collapses to a compact
                dial-code button so the number itself keeps the width — it is what the customer is
                actually typing. */}
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Select
                    value={selectedCountry}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    disabled={submitting}
                    renderValue={(name) => `+${(countries.find(c => c.name === name) ?? countries[0]).code}`}
                    inputProps={{ "aria-label": t("checkout:clientInfo.country") }}
                    // The sheet is a Drawer at KIOSK_SHEET_Z_INDEX; this menu portals to <body> at
                    // MUI's default 1300 and would otherwise open BEHIND the sheet that owns it.
                    MenuProps={{ sx: { zIndex: KIOSK_SHEET_Z_INDEX + 1 } }}
                    sx={{
                        flexShrink: 0,
                        borderRadius: 4,
                        fontSize: "1.4rem",
                        fontWeight: "bold",
                    }}
                >
                    {countries.map((option) => (
                        <MenuItem key={option.name} value={option.name}>
                            {localizedCountryName(option, i18n.language)} (+{option.code})
                        </MenuItem>
                    ))}
                </Select>

                <TextField
                    autoFocus
                    variant="outlined"
                    value={digits}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder={t("kiosk:phone.placeholder")}
                    disabled={submitting}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                    inputProps={{ inputMode: "numeric", maxLength: country.digits, "aria-label": t("kiosk:phone.placeholder") }}
                    InputProps={{
                        sx: { borderRadius: 4, fontSize: "1.4rem", fontWeight: "bold", letterSpacing: 1 },
                    }}
                    sx={{ flex: 1, minWidth: 0 }}
                />
            </Box>

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
