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
import { TextTitle, TextSecondary } from "../utils/typography";

const colorText = "#1A1A1A";
const colorWhite = "#ffffff";
const highlightColor = "#E44B4C";

function MenuItemCardHorizontal({
                                    group,
                                    onSelect,
                                    handleAddToCart,
                                    handleRemoveItemFromCart,
                                    handleChangeQuantity,
                                    cartItems
                                }) {
    const defaultItem = group.items.find(i => i.size === "S") || group.items[0];
    const { name, price, photo } = defaultItem;
    const displayPrice = `${price}`;
    const [selected, setSelected] = useState(false);
    const isSimpleGroup = ["Sides", "Sauces", "Beverages"].includes(group.category);
    const cartItem = cartItems.find(i => i.name === name);

    const handleClick = () => {
        if (isSimpleGroup) {
            if (!selected) {
                handleAddToCart({
                    ...defaultItem,
                    amount: price,
                    quantity: 1
                });
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


    const handleQuantityChange = (delta) => {
        const newQty = (cartItem?.quantity || 1) + delta;
        if (newQty <= 0) {
            handleRemoveItemFromCart(cartItem);
        } else {
            handleChangeQuantity(cartItem, newQty);
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

            <CardContent sx={{ px: 1.5, py: 1 , '&:last-child': { pb: 0.2 }}}>
                <TextTitle
                    sx={{
                        fontSize: "1rem",
                        // fontWeight: 600,
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
                        <Box
                            component="span"
                            sx={{
                                display: "inline-block",
                                width: 14,
                                height: 14,
                                borderRight: "2px solid #ccc",
                                borderBottom: "2px solid #ccc",
                                transform: "rotate(-45deg)",
                                mt: "2px"
                            }}
                        />
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