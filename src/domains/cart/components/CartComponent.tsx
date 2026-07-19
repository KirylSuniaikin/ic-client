import React from "react";
import { useTranslation } from "react-i18next";
import { Modal, Box, Typography, IconButton, Button, ToggleButtonGroup, ToggleButton } from "@mui/material";
import CartItemHorizontal from "./CartItemHorizontal";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import type { CartItem, MenuItem, Topping, ExtraIngr } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD } from "../../order/types";
import { UnavailablePopup } from "../../menu/components/UnavailablePopup";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

// Canonical payment values sent to the backend; the visible labels are translated in the toggle.
const PAYMENT_OPTIONS: ReadonlyArray<{ value: string; labelKey: string }> = [
    { value: "Cash", labelKey: "payment.cash" },
    { value: DEFAULT_PAYMENT_METHOD, labelKey: "payment.card" },
    { value: "Benefit", labelKey: "payment.benefit" },
];

interface CartPopupProps {
    open: boolean;
    onClose: () => void;
    items: CartItem[];
    onChangeQuantity: (item: CartItem, delta: number) => void;
    onChangeSize: (item: CartItem, newSize: string) => void;
    onRemoveItem: (item: CartItem) => void;
    onCheckout: (...args: unknown[]) => void;
    openPizzaEditPopUp: (item: CartItem) => void;
    openPizzaComboEditPopup: (item: CartItem) => void;
    openDetroitComboEditPopup: (item: CartItem) => void;
    isAdmin: boolean;
    handleDiscountChange: (item: CartItem, discount: number) => void;
    menuData: MenuItem[];
    toppings?: Topping[];
    extras?: ExtraIngr[];
    // Unavailable popup props — passed down from HomePage
    unavailablePopupOpen?: boolean;
    unavailableItems?: string[];
    unavailableMessage?: string | null;
    onCloseUnavailablePopup?: () => void;
    // Delivery type + payment method, shown as toggles for customers (not admin). The
    // delivery-type toggle is hidden on kiosk, which is always Pickup.
    paymentMethod: string;
    onPaymentChange: (value: string) => void;
    orderType: string;
    onDeliveryTypeChange: (value: string) => void;
    isKiosk: boolean;
}

function CartPopup({
                       open,
                       onClose,
                       items = [],
                       onChangeQuantity,
                       onChangeSize,
                       onRemoveItem,
                       onCheckout,
                       openPizzaEditPopUp,
                       openPizzaComboEditPopup,
                       openDetroitComboEditPopup,
                       isAdmin,
                       handleDiscountChange,
                       menuData,
                       toppings = [],
                       extras = [],
                       unavailablePopupOpen = false,
                       unavailableItems = [],
                       unavailableMessage,
                       onCloseUnavailablePopup,
                       paymentMethod,
                       onPaymentChange,
                       orderType,
                       onDeliveryTypeChange,
                       isKiosk,
                   }: CartPopupProps): JSX.Element {
    const { t } = useTranslation("cart");
    const totalPrice = items
        .reduce((acc, i) => {
            const discount = i.discountAmount || 0;
            const discountedPrice = i.amount * (1 - discount / 100);
            return acc + discountedPrice * i.quantity;
        }, 0)
        .toFixed(2);

    // Segmented-control styling shared by the delivery-type and payment toggles, matching the
    // size/dough toggles in the pizza popups (gray track, white selected pill in brand red).
    const toggleGroupSx = {
        backgroundColor: brandGray,
        borderRadius: 3,
        p: "4px",
        width: "100%",
        "& .MuiToggleButtonGroup-grouped": {
            border: 0,
            flex: 1,
            borderRadius: 3,
            mr: "4px",
            "&:not(:last-of-type)": { borderRight: "none" },
            "&:last-of-type": { mr: 0 },
        },
    };
    const toggleBtnSx = {
        textTransform: "none",
        fontSize: "14px",
        justifyContent: "center",
        color: "#666",
        borderRadius: 3,
        py: 1,
        "&:hover": { backgroundColor: "transparent" },
        "&.Mui-selected": {
            backgroundColor: "#fff",
            color: brandRed,
            boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
            "&:hover": { backgroundColor: "#fff" },
        },
        "&.Mui-disabled": { border: 0, color: "#bbb" },
    };

    return (
        <Modal open={open} onClose={onClose}>
            {/*
             * position: relative here is the key fix — it creates a stacking context
             * so the absolutely-positioned UnavailablePopup renders on top of the cart,
             * not behind it as it did when it was a sibling in HomePage.
             */}
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#FAFAFA",
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        position: "relative",
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        px: 2,
                        backgroundColor: "#fafafa",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                >
                    <Box
                        sx={{
                            position: "absolute",
                            left: 8,
                            top: "50%",
                            transform: "translateY(-50%)",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <IconButton
                            onClick={onClose}
                            sx={{ color: brandRed, ml: 1.3, p: 0 }}
                        >
                            <ArrowBackIosNewIcon fontSize="medium" />
                        </IconButton>
                        <Box
                            sx={{
                                width: "1px",
                                height: "100%",
                                backgroundColor: "#ccc",
                                ml: 1,
                            }}
                        />
                    </Box>
                    <Typography variant="h5">{t("title")}</Typography>
                </Box>

                {/* Items list */}
                <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
                    {items.map((item, idx) => (
                        <CartItemHorizontal
                            key={idx}
                            item={item}
                            onChangeQuantity={onChangeQuantity}
                            onChangeSize={onChangeSize}
                            onRemoveItem={onRemoveItem}
                            openPizzaEditPopUp={openPizzaEditPopUp}
                            openPizzaComboEditPopup={openPizzaComboEditPopup}
                            openDetroitComboEditPopup={openDetroitComboEditPopup}
                            isAdmin={isAdmin}
                            handleDiscountChange={handleDiscountChange}
                            menuData={menuData}
                            toppings={toppings}
                            extras={extras}
                        />
                    ))}
                </Box>

                {/* Delivery type + payment — customer flow only (admin rings payment via
                    AdminOrderDetailsPopUp). Delivery toggle is hidden on kiosk (always Pickup). */}
                {!isAdmin && (
                    <Box sx={{ flexShrink: 0, px: 3, pt: 1.5, pb: 0.5 }}>
                        {!isKiosk && (
                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="subtitle2" sx={{ color: "#000", mb: 0.75 }}>
                                    {t("deliveryTitle")}
                                </Typography>
                                <ToggleButtonGroup
                                    exclusive
                                    value={orderType}
                                    onChange={(_e, val) => val && onDeliveryTypeChange(val)}
                                    sx={toggleGroupSx}
                                    fullWidth
                                >
                                    <ToggleButton value="Pick Up" sx={toggleBtnSx}>
                                        {t("pickup")}
                                    </ToggleButton>
                                    <ToggleButton value="Delivery" disabled sx={toggleBtnSx}>
                                        <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                                            <span>{t("delivery")}</span>
                                            <Typography component="span" sx={{ fontSize: 11, color: "#999" }}>
                                                {t("comingSoon")}
                                            </Typography>
                                        </Box>
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </Box>
                        )}

                        <Typography variant="subtitle2" sx={{ color: "#000", mb: 0.75 }}>
                            {t("paymentTitle")}
                        </Typography>
                        <ToggleButtonGroup
                            exclusive
                            value={paymentMethod}
                            onChange={(_e, val) => val && onPaymentChange(val)}
                            sx={toggleGroupSx}
                            fullWidth
                        >
                            {PAYMENT_OPTIONS.map((opt) => (
                                <ToggleButton key={opt.value} value={opt.value} sx={toggleBtnSx}>
                                    {t(opt.labelKey)}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>
                )}

                {/* Total */}
                <Box
                    sx={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 3,
                        py: 2,
                        borderTop: "1px solid #eee",
                    }}
                >
                    <Typography
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{ color: "#000" }}
                    >
                        {t("totalVatIncl")}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: "#000" }}>
                        {totalPrice}
                    </Typography>
                </Box>

                {/* Checkout button */}
                <Box
                    sx={{
                        flexShrink: 0,
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 2,
                        pb: 2,
                    }}
                >
                    <Button
                        variant="contained"
                        onClick={() => onCheckout?.(items, null, null, orderType, paymentMethod, "", null, false)}
                        sx={{
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontWeight: "bold",
                            borderRadius: 4,
                            width: "100%",
                            "&:hover": { backgroundColor: brandRed },
                        }}
                    >
                        {t("checkout")}
                    </Button>
                </Box>

                {/*
                 * UnavailablePopup is now a child of CartComponent.
                 * It uses position:absolute + inset:0 to overlay the entire cart,
                 * which is possible because the parent Box above has position:absolute
                 * giving it a proper stacking context.
                 */}
                <UnavailablePopup
                    open={unavailablePopupOpen}
                    onClose={onCloseUnavailablePopup ?? (() => {})}
                    unavailableItems={unavailableItems}
                    message={unavailableMessage ?? undefined}
                />
            </Box>
        </Modal>
    );
}

export default CartPopup;
