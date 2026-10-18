import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, IconButton, Button, ToggleButtonGroup, ToggleButton } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CartItemHorizontal from "./CartItemHorizontal";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import type { CartItem, MenuItem, Topping, ExtraIngr } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";
import { UnavailablePopup } from "../../menu/components/UnavailablePopup";
import { ItemPopupShell } from "../../menu/components/popups/ItemPopupShell";
import type { ItemPopupDesktopLayout } from "../../menu/components/popups/ItemPopupShell";
import { branchDisplayName } from "../../branch/utils/branchDisplayName";
import { ApplePayButton } from "../../order/components/ApplePayButton";
import type { UseApplePayCheckoutResult } from "../../order/hooks/useApplePayCheckout";
import type { UseCardCheckoutResult } from "../../order/hooks/useCardCheckout";
import { APPLE_PAY_CHOICE, CARD_CHOICE, usePaymentChoice } from "../hooks/usePaymentChoice";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
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

// Key order matches the literal this replaced, so the phone's CSS class is unchanged.
const CART_ROOT_SX = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#FAFAFA",
} satisfies SxProps<Theme>;

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
    // The branch a pickup order will be collected from, and the way to change it. The "Pick up
    // from" card needs both: a chevron that does nothing on tap is a broken promise, so without a
    // handler the card is not rendered at all. Irrelevant for admin and kiosk, which hide the
    // whole section.
    pickupBranch?: IBranch | null;
    onChangeBranch?: () => void;
    // Absent (or not `available`) renders the cart exactly as before.
    applePay?: Pick<UseApplePayCheckoutResult, "available" | "busy" | "start">;
    cardPayment?: Pick<UseCardCheckoutResult, "available" | "busy" | "start">;
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
                       pickupBranch = null,
                       onChangeBranch,
                       applePay,
                       cardPayment,
                   }: CartPopupProps): JSX.Element {
    const { t, i18n } = useTranslation("cart");
    // The RTL emotion cache mirrors the card's layout but not an icon's glyph, so the chevron has
    // to be chosen by direction to keep pointing "onward".
    const isRtl = useTheme().direction === "rtl";
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
    // A delivery order goes to whichever kitchen the address resolves to, so naming the pickup
    // branch there would be wrong; an empty name would be a blank card.
    const pickupBranchName = pickupBranch ? branchDisplayName(pickupBranch, i18n.language) : "";
    const pickupBranchAddress = pickupBranch?.address?.trim() ?? "";
    const showPickupBranch = orderType !== "Delivery" && pickupBranchName !== "" && onChangeBranch !== undefined;
    const singleLineSx = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

    // Delivery picks its method in DeliveryCheckoutDrawer, and admin/kiosk never choose, so those
    // keep the original buttons and the tender they were handed.
    const showPaymentChoice = !isAdmin && !isKiosk && orderType !== "Delivery";
    const payment = usePaymentChoice({
        onPaymentChange,
        applePayAvailable: applePay?.available === true,
        cardAvailable: cardPayment?.available === true,
    });
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

    const checkoutButton = (onClick: () => void, disabled = false): JSX.Element => (
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
                onClick={onClick}
                disabled={disabled}
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
    );

    const checkoutWith = (tender: string): void =>
        onCheckout?.(items, null, null, orderType, tender, "", null, false);

    // One button pays with whatever is selected. Apple Pay's must be Apple's own button, and the
    // session has to open inside this very tap, so it calls start() directly.
    function renderPayButton(): JSX.Element {
        const selected = payment.selected;
        // Nothing is preselected, so a tap before choosing opens the list rather than ordering
        // with a method the customer never picked, or looking broken as a disabled button would.
        if (selected === null) {
            return checkoutButton(() => setPaymentSheetOpen(true));
        }
        if (selected === APPLE_PAY_CHOICE && applePay) {
            return <ApplePayButton onClick={() => applePay.start()} disabled={applePay.busy} />;
        }
        if (selected === CARD_CHOICE && cardPayment) {
            return checkoutButton(() => cardPayment.start(), cardPayment.busy);
        }
        return checkoutButton(() => checkoutWith(selected));
    }

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

            {/* Where this pickup will be collected, at the moment the customer is
                deciding — the menu header that names the branch has scrolled away by
                now. Label above, control below, on the same gray track as the two
                toggle groups around it, so the section reads as one family rather than
                a bare text row wedged between two controls. */}
            {showPickupBranch && (
                <Box sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ color: "#000", mb: 0.75 }}>
                        {t("pickupFrom")}
                    </Typography>
                    <Button
                        fullWidth
                        onClick={onChangeBranch}
                        aria-label={`${t("pickupFrom")} ${pickupBranchName}`}
                        sx={{
                            backgroundColor: brandGray,
                            borderRadius: 3,
                            minHeight: 48,
                            px: 2,
                            py: 1,
                            gap: 1,
                            justifyContent: "space-between",
                            textAlign: "start",
                            textTransform: "none",
                            color: "#000",
                            // Without this MUI tints the hover with the primary red,
                            // which the toggles beside it never do.
                            "&:hover": { backgroundColor: brandGray },
                        }}
                    >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#000", ...singleLineSx }}>
                                {pickupBranchName}
                            </Typography>
                            {pickupBranchAddress !== "" && (
                                <Typography data-testid="cart-pickup-branch-address" sx={{ fontSize: "12px", color: "#666", ...singleLineSx }}>
                                    {pickupBranchAddress}
                                </Typography>
                            )}
                        </Box>
                        {isRtl ? (
                            <ChevronLeftRoundedIcon data-testid="cart-pickup-branch-chevron-left" sx={{ color: "#666", flexShrink: 0 }} />
                        ) : (
                            <ChevronRightRoundedIcon data-testid="cart-pickup-branch-chevron-right" sx={{ color: "#666", flexShrink: 0 }} />
                        )}
                    </Button>
                </Box>
            )}

            {/* Delivery is paid online in DeliveryCheckoutDrawer, which asks for the
                method itself — leaving this selector visible would let a customer pick
                Cash here and then be charged by card, so it is hidden rather than
                disabled. Mirrors mobile's CartComponent. */}
            {orderType !== "Delivery" && (
                <>
                    <Typography variant="subtitle2" sx={{ color: "#000", mb: 0.75 }}>
                        {t("paymentTitle")}
                    </Typography>
                    <PaymentMethodSelector
                        choices={payment.choices}
                        selected={payment.selected}
                        onSelect={payment.select}
                        open={paymentSheetOpen}
                        onOpenChange={setPaymentSheetOpen}
                    />
                </>
            )}
        </Box>
    );

    const totalRow = (
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
    );

    // Delivery is paid in DeliveryCheckoutDrawer, so it gets no Apple Pay or card button: those
    // create a pickup order with no address, and the backend refuses one. Admin and kiosk never
    // had them.
    const payButton = showPaymentChoice ? renderPayButton() : checkoutButton(() => checkoutWith(paymentMethod));

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
    // two-column dialog, with the items on the warm ground where its photo sits and the choices,
    // total and pay button in the white column beside them.
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
            legacy={{ paperSx: CART_ROOT_SX }}
            showClose={isDesktop}
            desktop={desktopLayout}
            footer={isDesktop ? <>{totalRow}{payButton}</> : undefined}
        >
            {isDesktop ? (
                <>
                    {choiceSection}
                    {unavailablePopup}
                </>
            ) : (
                <>
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
                        {itemCards}
                    </Box>

                    {choiceSection}
                    {totalRow}
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
