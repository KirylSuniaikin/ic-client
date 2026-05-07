import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardMedia,
    Box,
    IconButton
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {TextTitle, TextSecondary, TextTitleWithoutVariant} from "../utils/typography";
import type { Group, CartItem, MenuItem } from '../management/types/menuTypes';

// Group at runtime always carries `category` (MenuGroup is a superset of Group).
// This local type reflects the actual runtime shape passed from menu_service.
export type GroupWithCategory = Group & { category: string };

// CartItems in this component carry a legacy `discount` field alongside discount_amount.
// Using an intersection type to reflect the actual runtime shape without changing logic.
type CartItemWithDiscount = CartItem & { discount?: number };

interface MenuItemCardHorizontalProps {
    group: GroupWithCategory;
    // item is optional because this component calls onSelect with only the group;
    // the full (group, item) signature is used by parent components when opening popup
    onSelect: (group: GroupWithCategory, item?: MenuItem) => void;
    isBestSellerBlock?: boolean;
    handleRemoveItemFromCart: (item: CartItem) => void;
    handleAddToCart: (item: CartItem) => void;
    handleChangeQuantity: (item: CartItem, delta: number) => void;
    cartItems: CartItemWithDiscount[];
}

const colorText = "#1A1A1A";
const highlightColor = "#E44B4C";

function MenuItemCardHorizontal({
                                    group,
                                    onSelect,
                                    isBestSellerBlock,
                                    handleAddToCart,
                                    handleRemoveItemFromCart,
                                    handleChangeQuantity,
                                    cartItems
                                }: MenuItemCardHorizontalProps): JSX.Element | null {
    const defaultItem = group.items.find(i => i.size === "S") || group.items[0];
    const { name, price, photo, is_best_seller } = defaultItem;
    const is_ramadan = defaultItem.category === "Ramadan";
    const displayPrice = `${price}`;
    const [selected, setSelected] = useState(false);
    const isSimpleGroup = ["Sides", "Sauces", "Beverages"].includes(group.category);
    const cartItem = cartItems.find(i => i.name === name && (i.discount || 0) === 0);

    const handleClick = () => {
        if (isSimpleGroup) {
            if (!selected) {
                // Cast is needed: for simple items (sides/sauces/beverages), CartItem
                // fields like isThinDough/isGarlicCrust are irrelevant and default to undefined at runtime.
                // The parent only reads name/quantity/amount for these items.
                handleAddToCart({
                    ...defaultItem,
                    amount: price,
                    quantity: 1
                } as unknown as CartItem);
            }
        } else {
            if (onSelect) onSelect(group);
        }
    };

    useEffect(() => {
        if (cartItem && isSimpleGroup) setSelected(true);
        if (!cartItem && isSimpleGroup) setSelected(false);
    }, [cartItem, isSimpleGroup]);

    if (!group || !group.items || group.items.length === 0) {
        console.error("Invalid group passed to MenuItemCardHorizontal:", group);
        return null;
    }


    const handleQuantityChange = (delta: number) => {
        const newQty = (cartItem?.quantity || 1) + delta;
        if (newQty <= 0) {
            handleRemoveItemFromCart(cartItem!);
        } else {
            handleChangeQuantity(cartItem!, newQty);
        }
    };

    return (
        <Card
            onClick={handleClick}
            sx={{
                borderRadius: 3,
                border: selected ? `2px solid ${highlightColor}` : "2px solid transparent",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                width: 160,
                cursor: "pointer",
                overflow: "hidden",
                flexShrink: 0,
                mx: 0.65,
                transition: "border 0.2s ease-in-out"
            }}
        >
            <Box sx={{ position: "relative" }}>
                {is_best_seller && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            backgroundColor: "#E44B4C",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            px: 1.2,
                            py: 0.3,
                            borderRadius: "999px",
                            zIndex: 2,
                            letterSpacing: 0.5,
                        }}
                    >
                        Bestseller
                    </Box>
                )}

                {is_ramadan && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            backgroundColor: "#E44B4C",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            px: 1.2,
                            py: 0.3,
                            borderRadius: "999px",
                            zIndex: 2,
                            letterSpacing: 0.5,
                        }}
                    >
                        25 min
                    </Box>
                )}

                <CardMedia
                    component="img"
                    image={photo}
                    alt={name}
                    sx={{
                        width: "100%",
                        height: 180,
                        objectFit: "contain",
                        backgroundColor: "#fff",
                    }}
                />
            </Box>
            <CardContent sx={{ px: 1.5, py: 1 , '&:last-child': { pb: 0.2 }}}>
                <TextTitle
                    sx={{
                        fontSize: "1rem",
                        lineHeight: 1.3,
                        mb: 1,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        minHeight: "2.6em",
                    }}
                >
                    {name}
                </TextTitle>

                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontWeight: 600,
                        color: colorText,
                    }}
                >
                    < TextSecondary>{displayPrice}</TextSecondary>

                    {!isSimpleGroup ? (
                        <TextTitleWithoutVariant
                            component="span"
                            variant="body2"
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 14,
                                fontWeight: 500,
                                color: "text.secondary",
                                border: "1.5px solid #e0e0e0",
                                borderRadius: "20px",
                                px: 1.5,
                                py: 0.25,
                                lineHeight: 1,
                                height: 28,
                                minWidth: 70,
                            }}
                        >
                            SELECT
                        </TextTitleWithoutVariant>
                    ) : (
                        cartItem ? (
                            <Box
                                onClick={e => e.stopPropagation()}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.5,
                                    borderRadius: 99,
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(-1)}
                                    sx={{ p: 0.5 }}
                                >
                                    <RemoveIcon fontSize="small" />
                                </IconButton>
                                <TextSecondary>{cartItem.quantity}</TextSecondary>
                                <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(1)}
                                    sx={{ p: 0.5 }}
                                >
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ) : (
                            <AddIcon fontSize="small" />
                        )
                    )}
                </Box>
            </CardContent>
        </Card>
    );
}

export default MenuItemCardHorizontal;
