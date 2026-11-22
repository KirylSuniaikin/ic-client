import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { BRAND_RED } from "../../../../../shared/utils/theme";
import type { CartItem } from "../../../../menu/types";
import { computeAmountPaid } from "../../../../order/utils/orderPayload";
import { discountArray } from "../../../../cart/components/CartItemHorizontal";
import { countries, paymentOptions } from "../AdminOrderDetailsPopUp";
import type { OrderCreateDetails } from "./useOrderCreate";
import { formatBd } from "./orderLineDisplay";
import { EDIT_COLORS } from "./orderEditColors";

interface OrderCreateDetailsStepProps {
    items: CartItem[];
    saving: boolean;
    error: string | null;
    onBack: () => void;
    onPlace: (details: OrderCreateDetails) => void;
}

const PAYMENT_LABEL_KEYS: Record<string, string> = {
    "Card (Through card machine)": "create.payment.card",
    "Cash": "create.payment.cash",
    "Benefit": "create.payment.benefit",
};

/**
 * The new order's second step: who it is for and how it is paid, the same fields as the admin
 * menu's "User Data" sheet (AdminOrderDetailsPopUp), with the same phone rules.
 */
export function OrderCreateDetailsStep({ items, saving, error, onBack, onPlace }: OrderCreateDetailsStepProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const [countryName, setCountryName] = useState(countries[0].name);
    const [phoneDigits, setPhoneDigits] = useState("");
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [customerName, setCustomerName] = useState("");
    const [paymentType, setPaymentType] = useState(paymentOptions[0]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const country = countries.find(c => c.name === countryName) ?? countries[0];

    const total = computeAmountPaid(items.map(item => ({ ...item, discountAmount: discountPercent })));

    function handlePlace(): void {
        if (phoneDigits !== "" && phoneDigits.length !== country.digits) {
            setPhoneError(t("create.phoneLength", { count: country.digits }));
            return;
        }
        setPhoneError(null);
        onPlace({
            phone: phoneDigits === "" ? null : country.code + phoneDigits,
            customerName: customerName.trim(),
            paymentType,
            discountPercent,
        });
    }

    return (
        <Box data-testid="order-create-details" sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, borderBottom: `1px solid ${EDIT_COLORS.hairline}` }}>
                <IconButton aria-label={t("create.backToItems")} onClick={onBack} disabled={saving} sx={{ width: 44, height: 44, color: BRAND_RED }}>
                    <ArrowBackRoundedIcon sx={{ "[dir=rtl] &": { transform: "scaleX(-1)" } }} />
                </IconButton>
                <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text, flex: 1 }}>{t("create.detailsTitle")}</Typography>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", gap: 1.5 }}>
                    <TextField
                        select
                        label={t("create.country")}
                        value={countryName}
                        onChange={e => { setCountryName(e.target.value); setPhoneError(null); }}
                        sx={{ width: 190, flexShrink: 0 }}
                    >
                        {countries.map(c => <MenuItem key={c.name} value={c.name}>{c.name} (+{c.code})</MenuItem>)}
                    </TextField>
                    <TextField
                        label={t("create.phone")}
                        value={phoneDigits}
                        onChange={e => {
                            const value = e.target.value;
                            if (/^\d*$/.test(value) && value.length <= country.digits) {
                                setPhoneDigits(value);
                                setPhoneError(null);
                            }
                        }}
                        error={phoneError !== null}
                        helperText={phoneError ?? " "}
                        inputProps={{ inputMode: "numeric", autoComplete: "off" }}
                        fullWidth
                    />
                </Box>

                <TextField
                    label={t("create.customerName")}
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    inputProps={{ autoComplete: "off" }}
                    fullWidth
                />

                <Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.75 }}>{t("create.paymentTitle")}</Typography>
                    <ToggleButtonGroup
                        exclusive
                        fullWidth
                        value={paymentType}
                        onChange={(_e, value: string | null) => { if (value) setPaymentType(value); }}
                        aria-label={t("create.paymentTitle")}
                    >
                        {paymentOptions.map(option => (
                            <ToggleButton
                                key={option}
                                value={option}
                                sx={{
                                    minHeight: 48,
                                    textTransform: "none",
                                    fontWeight: 700,
                                    "&.Mui-selected, &.Mui-selected:hover": { bgcolor: EDIT_COLORS.openHeader, color: BRAND_RED },
                                }}
                            >
                                {t(PAYMENT_LABEL_KEYS[option] ?? option)}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </Box>

                <TextField
                    select
                    label={t("create.discount")}
                    value={discountPercent}
                    onChange={e => setDiscountPercent(Number(e.target.value))}
                    sx={{ maxWidth: 220 }}
                >
                    {discountArray.map(percent => <MenuItem key={percent} value={percent}>{percent}%</MenuItem>)}
                </TextField>
            </Box>

            {error !== null && <Alert severity="error" sx={{ mx: 2, mt: 1.5 }}>{t("create.placeError", { message: error })}</Alert>}
            <Box sx={{ p: 2, borderTop: `1px solid ${EDIT_COLORS.hairline}` }}>
                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={saving}
                    onClick={handlePlace}
                    sx={{
                        minHeight: 52,
                        borderRadius: 999,
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 17,
                        bgcolor: BRAND_RED,
                        "&:hover": { bgcolor: BRAND_RED, filter: "brightness(0.94)" },
                        "&.Mui-disabled": { bgcolor: EDIT_COLORS.disabledCta, color: "text.secondary" },
                    }}
                >
                    {saving ? t("create.placing") : t("create.place", { amount: formatBd(total) })}
                </Button>
            </Box>
        </Box>
    );
}
