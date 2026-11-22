import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { BRAND_RED } from "../../../../../shared/utils/theme";
import type { CartItem } from "../../../../menu/types";
import { computeAmountPaid } from "../../../../order/utils/orderPayload";
import { discountArray } from "../../../../cart/components/CartItemHorizontal";
import {
    FIELD_SX, PRIMARY_BUTTON_SX, SECTION_CARD_SX, SECTION_LABEL_SX, SEGMENTED_BUTTON_SX, SEGMENTED_GROUP_SX, SheetNotice,
} from "../../../../delivery/components/sheetStyles";
import { countries, paymentOptions } from "../AdminOrderDetailsPopUp";
import type { OrderCreateDetails } from "./useOrderCreate";
import { formatBd, lineTotal, orderLineLabel } from "./orderLineDisplay";
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

/** Sheet ground from DESIGN.md: a shade lighter than the page, so the white cards read on it. */
const SHEET_GROUND = "#fffcf8";

interface OrderRecapProps {
    items: CartItem[];
    discountPercent: number;
    total: number;
}

/** The order being placed, so the staff member checks it against the customer before paying. */
function OrderRecap({ items, discountPercent, total }: OrderRecapProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const subtotal = computeAmountPaid(items);
    return (
        <Box component="section" data-testid="order-create-recap" sx={SECTION_CARD_SX}>
            <Typography sx={SECTION_LABEL_SX}>{t("create.orderTitle")}</Typography>
            {items.map((item, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1.5, py: 0.75, borderBottom: `1px solid ${EDIT_COLORS.hairline}` }}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0, color: EDIT_COLORS.text }}>
                        {t("summary.line", { count: item.quantity, label: orderLineLabel(item) })}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                        {formatBd(lineTotal(item))}
                    </Typography>
                </Box>
            ))}
            {discountPercent > 0 && (
                <>
                    <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1 }}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{t("create.subtotal")}</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{formatBd(subtotal)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" sx={{ color: BRAND_RED }}>{t("create.discountLine", { percent: discountPercent })}</Typography>
                        <Typography variant="body2" sx={{ color: BRAND_RED }}>−{formatBd(subtotal - total)}</Typography>
                    </Box>
                </>
            )}
            <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1 }}>
                <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text }}>{t("summary.total")}</Typography>
                <Typography data-testid="order-create-recap-total" sx={{ fontWeight: 700, color: EDIT_COLORS.text }}>
                    {t("list.price", { amount: formatBd(total) })}
                </Typography>
            </Box>
        </Box>
    );
}

/**
 * The new order's second step: who it is for and how it is paid, the same fields as the admin
 * menu's "User Data" sheet (AdminOrderDetailsPopUp), with the same phone rules. Styled with the
 * delivery checkout's sheet tokens (sheetStyles): white section cards on the warm sheet ground,
 * rounded fields and the segmented control. Tablet and PC put the order beside the form.
 */
export function OrderCreateDetailsStep({ items, saving, error, onBack, onPlace }: OrderCreateDetailsStepProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const isWide = useMediaQuery(useTheme().breakpoints.up("md"), { noSsr: true });
    const [countryName, setCountryName] = useState(countries[0].name);
    const [phoneDigits, setPhoneDigits] = useState("");
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [customerName, setCustomerName] = useState("");
    const [paymentType, setPaymentType] = useState(paymentOptions[0]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const country = countries.find(c => c.name === countryName) ?? countries[0];

    const discounted = items.map(item => ({ ...item, discountAmount: discountPercent }));
    const total = computeAmountPaid(discounted);

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

    const customerCard = (
        <Box component="section" sx={{ ...SECTION_CARD_SX, display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ ...SECTION_LABEL_SX, mb: 0 }}>{t("create.customerTitle")}</Typography>
            <Box sx={{ display: "flex", gap: 1.5 }}>
                <TextField
                    select
                    label={t("create.country")}
                    value={countryName}
                    onChange={e => { setCountryName(e.target.value); setPhoneError(null); }}
                    sx={{ ...FIELD_SX, width: 170, flexShrink: 0 }}
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
                    helperText={phoneError ?? undefined}
                    inputProps={{ inputMode: "numeric", autoComplete: "off" }}
                    fullWidth
                    sx={FIELD_SX}
                />
            </Box>
            <TextField
                label={t("create.customerName")}
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                inputProps={{ autoComplete: "off" }}
                fullWidth
                sx={FIELD_SX}
            />
        </Box>
    );

    const paymentCard = (
        <Box component="section" sx={{ ...SECTION_CARD_SX, display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ ...SECTION_LABEL_SX, mb: 0 }}>{t("create.paymentTitle")}</Typography>
            <ToggleButtonGroup
                exclusive
                value={paymentType}
                onChange={(_e, value: string | null) => { if (value) setPaymentType(value); }}
                aria-label={t("create.paymentTitle")}
                sx={SEGMENTED_GROUP_SX}
            >
                {paymentOptions.map(option => (
                    <ToggleButton key={option} value={option} sx={{ ...SEGMENTED_BUTTON_SX, minHeight: 44 }}>
                        {t(PAYMENT_LABEL_KEYS[option] ?? option)}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
            <TextField
                select
                label={t("create.discount")}
                value={discountPercent}
                onChange={e => setDiscountPercent(Number(e.target.value))}
                sx={{ ...FIELD_SX, maxWidth: 200 }}
            >
                {discountArray.map(percent => <MenuItem key={percent} value={percent}>{percent}%</MenuItem>)}
            </TextField>
        </Box>
    );

    const recap = <OrderRecap items={items} discountPercent={discountPercent} total={total} />;

    return (
        <Box data-testid="order-create-details" sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, bgcolor: SHEET_GROUND }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, bgcolor: "#fff", borderBottom: `1px solid ${EDIT_COLORS.hairline}` }}>
                <IconButton aria-label={t("create.backToItems")} onClick={onBack} disabled={saving} sx={{ width: 44, height: 44, color: BRAND_RED }}>
                    <ArrowBackRoundedIcon sx={{ "[dir=rtl] &": { transform: "scaleX(-1)" } }} />
                </IconButton>
                <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text, flex: 1 }}>{t("create.detailsTitle")}</Typography>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    p: 2,
                    display: "grid",
                    gap: 2,
                    alignContent: "start",
                    gridTemplateColumns: isWide ? "minmax(0, 1.25fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
                }}
            >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {customerCard}
                    {paymentCard}
                </Box>
                {recap}
            </Box>

            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5, bgcolor: "#fff", borderTop: `1px solid ${EDIT_COLORS.hairline}` }}>
                {error !== null && <SheetNotice tone="error">{t("create.placeError", { message: error })}</SheetNotice>}
                <Button
                    variant="contained"
                    disableElevation
                    disabled={saving}
                    onClick={handlePlace}
                    sx={{ ...PRIMARY_BUTTON_SX, minHeight: 52, fontSize: 17 }}
                >
                    {saving ? t("create.placing") : t("create.place", { amount: formatBd(total) })}
                </Button>
            </Box>
        </Box>
    );
}
