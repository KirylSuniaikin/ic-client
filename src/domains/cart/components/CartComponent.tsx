import React, { type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Box, Typography, IconButton, Button, ToggleButtonGroup, ToggleButton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CartItemHorizontal from "./CartItemHorizontal";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import type { CartItem, MenuItem, Topping, ExtraIngr } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";
import { PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { UnavailablePopup } from "../../menu/components/UnavailablePopup";
import { branchDisplayName } from "../../branch/utils/branchDisplayName";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

// Canonical payment values sent to the backend; the visible labels are translated in the toggle.
//
// Three choices, two of which take money now:
//   At counter  — pay on collection. Cash and card were separate options; the customer decides at
//                 the till either way, and staff record the real tender at the POS. The VALUE is
//                 unchanged from the old default, deliberately: PaymentService gates the cash
//                 drawer on the exact string "Cash", the admin edit dropdown offers these three
//                 literals, and historic stats group by them. Only the label collapsed.
//   Benefit     — BPG's hosted card page. Card number and PIN on BENEFIT's own domain.
//   BenefitPay  — the wallet. A QR the customer scans with their phone, on our page.
// Online-only by product decision: every customer order is paid before it reaches the kitchen,
// so there is no pay-at-counter option here. DEFAULT_PAYMENT_METHOD still exists and is still the
// kiosk's tender (useKioskCheckout) — it is the customer-facing CHOICE that was removed, not the
// tender string, so historic orders and the admin dropdown are unaffected.
const PAYMENT_OPTIONS: ReadonlyArray<{ value: string; labelKey: string; logo: string; alt: string }> = [
    { value: PAY_ONLINE_METHOD, labelKey: "payment.benefit", logo: "/benefit-logo.png", alt: "Benefit" },
    { value: WALLET_METHOD, labelKey: "payment.benefitPay", logo: "/benefitpay-logo.png", alt: "BenefitPay" },
];

/**
 * Height of the payment marks. Both are cropped square-ish lockups, so one height reads as one
 * size for both — matching them by WIDTH would make the wider one look smaller.
 *
 * The images live in public/ beside jahez-logo.png and keeta-logo.png, the convention already in
 * use for partner marks. They are trademarks: use the files BENEFIT supply, never a redraw.
 */
const PAYMENT_LOGO_HEIGHT = 20;

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
                   }: CartPopupProps): JSX.Element {
    const { t, i18n } = useTranslation("cart");
    // The RTL emotion cache mirrors the card's layout but not an icon's glyph, so the chevron has
    // to be chosen by direction to keep pointing "onward".
    const isRtl = useTheme().direction === "rtl";
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
                    AdminOrderDetailsPopUp). Both toggle groups are hidden on kiosk: kiosk is
                    always Pickup + Card, and there's nothing for a walk-up customer to choose. */}
                {!isAdmin && !isKiosk && (
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
                                    <ToggleButton value="Delivery" sx={toggleBtnSx}>
                                        {t("delivery")}
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
                            method itself — leaving this group visible would let a customer pick
                            Cash here and then be charged by card, so it is hidden rather than
                            disabled. Mirrors mobile's CartComponent. */}
                        {orderType !== "Delivery" && (
                            <>
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
                                            <Box sx={{
                                                display: "flex", alignItems: "center",
                                                gap: 0.75, minWidth: 0,
                                            }}>
                                                <Box
                                                    component="img"
                                                    src={opt.logo}
                                                    alt=""
                                                    aria-hidden
                                                    sx={{
                                                        height: PAYMENT_LOGO_HEIGHT,
                                                        width: "auto",
                                                        flexShrink: 0,
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                    // The mark is decoration beside a label that
                                                    // already names the method, so a missing file
                                                    // must cost nothing: hide it and let the text
                                                    // stand alone rather than show a broken image.
                                                    onError={(e: SyntheticEvent<HTMLImageElement>) => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                                <Box component="span" sx={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {t(opt.labelKey)}
                                                </Box>
                                            </Box>
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </>
                        )}
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
