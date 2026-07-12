import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Box, Typography, IconButton, Button, TextField } from "@mui/material";
import CartItemHorizontal from "./CartItemHorizontal";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import type { CartItem, MenuItem, Topping, ExtraIngr } from "../../menu/types";
import { UnavailablePopup } from "../../menu/components/UnavailablePopup";

const brandRed = "#E44B4C";

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
    // Order note. Shown only to logged-in customers, who skip ClientInfoPopup and would
    // otherwise lose the note field it carries; guests still write theirs in that popup.
    showNoteField?: boolean;
    note?: string;
    onNoteChange?: (note: string) => void;
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
                       showNoteField = false,
                       note = "",
                       onNoteChange,
                   }: CartPopupProps): JSX.Element {
    const { t } = useTranslation("cart");
    const totalPrice = items
        .reduce((acc, i) => {
            const discount = i.discountAmount || 0;
            const discountedPrice = i.amount * (1 - discount / 100);
            return acc + discountedPrice * i.quantity;
        }, 0)
        .toFixed(2);

    const [tel] = useState<string | null>(null);

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

                {/* Order note — logged-in customers only (they skip ClientInfoPopup) */}
                {showNoteField && (
                    <Box sx={{ flexShrink: 0, px: 3, pt: 1, pb: 1.5 }}>
                        <TextField
                            fullWidth
                            multiline
                            size="small"
                            maxRows={3}
                            value={note}
                            onChange={(e) => onNoteChange?.(e.target.value)}
                            label={t("noteLabel")}
                            placeholder={t("notePlaceholder")}
                            InputProps={{ sx: { borderRadius: 3, bgcolor: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" } }}
                        />
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
                        onClick={() => onCheckout?.(items, tel, null, null, null, note)}
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
                        {t("checkoutTakeOutOnly")}
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
