import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, ToggleButtonGroup, ToggleButton } from "@mui/material";
import CartItemHorizontal from "./CartItemHorizontal";
import type { CartItem, MenuItem, Topping, ExtraIngr } from "../../menu/types";
import { UnavailablePopup } from "../../menu/components/UnavailablePopup";
import { ItemPopupShell } from "../../menu/components/popups/ItemPopupShell";
import type { ItemPopupDesktopLayout } from "../../menu/components/popups/ItemPopupShell";
import { ActionButton, SCREEN_ROOT_SX, ScreenHeader } from "./CartChrome";
import { useDesktopLayout } from "../../../shared/hooks/useDesktopLayout";
import { DELIVERY_COMING_SOON } from "../../delivery/constants";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

// Blinks so a customer notices delivery is on its way rather than reading a grey button as broken.
const comingSoonSx = {
    fontSize: 11,
    fontWeight: 700,
    color: brandRed,
    animation: "deliveryComingSoonBlink 1.4s ease-in-out infinite",
    "@keyframes deliveryComingSoonBlink": {
        "0%, 100%": { opacity: 1 },
        "50%": { opacity: 0.3 },
    },
    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
};

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
    // The tender admin and kiosk check out with. Customers choose theirs on the payment page that
    // follows the cart (owner, 19 Oct 2026); the cart asks them only pickup or delivery.
    paymentMethod: string;
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
                       orderType,
                       onDeliveryTypeChange,
                       isKiosk,
                   }: CartPopupProps): JSX.Element {
    const { t } = useTranslation("cart");
    const isDesktop = useDesktopLayout();
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

    // Every checkout leaves with the tender the cart was handed. Admin and kiosk pay with it; a
    // customer's Checkout goes on to sign-in and the payment page, where the method is chosen.
    const checkoutWith = (tender: string): void =>
        onCheckout?.(items, null, null, orderType, tender, "", null, false);

    const itemCards = items.map((item, idx) => (
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
    ));

    // Delivery type + payment — customer flow only (admin rings payment via
    // AdminOrderDetailsPopUp). Both controls are hidden on kiosk: kiosk is
    // always Pickup + Card, and there's nothing for a walk-up customer to choose.
    const choiceSection = !isAdmin && !isKiosk && (
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
                        <ToggleButton value="Delivery" disabled={DELIVERY_COMING_SOON} sx={toggleBtnSx}>
                            {DELIVERY_COMING_SOON ? (
                                <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                                    <span>{t("delivery")}</span>
                                    <Typography component="span" sx={comingSoonSx}>
                                        {t("comingSoon")}
                                    </Typography>
                                </Box>
                            ) : (
                                t("delivery")
                            )}
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            )}
        </Box>
    );

    // The total rides on the button rather than on a line above it (owner, 19 Oct 2026), which
    // gives the items that line's room.
    const payButton = (
        <ActionButton
            label={t("paymentChoice:checkoutAmount", { amount: totalPrice })}
            onClick={() => checkoutWith(paymentMethod)}
        />
    );

    const unavailablePopup = (
        <UnavailablePopup
            open={unavailablePopupOpen}
            onClose={onCloseUnavailablePopup ?? (() => {})}
            unavailableItems={unavailableItems}
            message={unavailableMessage ?? undefined}
            // PC: the dialog's round close button sits exactly where the overlay's own close
            // button does and paints above it, so there the notice is the centred card instead.
            standalone={isDesktop}
        />
    );

    // PC (owner, 18 Oct 2026: "the same style we did for pizzapopup"): the pizza popup's
    // two-column dialog, with the items on the warm ground where its photo sits and the choices
    // and pay button in the white column beside them.
    const desktopLayout: ItemPopupDesktopLayout = {
        aside: (
            <>
                <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
                    {t("title")}
                </Typography>
                {itemCards}
            </>
        ),
    };

    return (
        <ItemPopupShell
            open={open}
            onClose={onClose}
            // Phone, admin and kiosk: the full-screen cart exactly as before, its own back-arrow
            // header standing in for the round close button. position: absolute on this root is
            // the key fix — it creates a stacking context so the absolutely-positioned
            // UnavailablePopup renders on top of the cart, not behind it as it did when it was a
            // sibling in HomePage.
            legacy={{ paperSx: SCREEN_ROOT_SX }}
            showClose={isDesktop}
            desktop={desktopLayout}
            footer={isDesktop ? payButton : undefined}
        >
            {isDesktop ? (
                <>
                    {choiceSection}
                    {unavailablePopup}
                </>
            ) : (
                <>
                    <ScreenHeader title={t("title")} onBack={onClose} />

                    {/* Items list */}
                    <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
                        {itemCards}
                    </Box>

                    {choiceSection}
                    {payButton}

                    {/*
                     * UnavailablePopup is now a child of CartComponent.
                     * It uses position:absolute + inset:0 to overlay the entire cart,
                     * which is possible because the cart's root Box has position:absolute
                     * giving it a proper stacking context.
                     */}
                    {unavailablePopup}
                </>
            )}
        </ItemPopupShell>
    );
}

export default CartPopup;
