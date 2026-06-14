import React from "react";
import {
    Box,
    Typography,
    IconButton,
    Button,
    Divider,
    CardMedia, Select, MenuItem, FormControl, InputLabel, ToggleButton, ToggleButtonGroup
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {Edit} from "@mui/icons-material";
import type { CartItem, MenuItem as MenuItemType } from '../../menu/types';

const brandGray = "#f3f3f3";
const brandRed = "#E44B4C";

interface CartItemHorizontalProps {
    item: CartItem;
    onChangeQuantity: (item: CartItem, delta: number) => void;
    onChangeSize: (item: CartItem, newSize: string) => void;
    onRemoveItem: (item: CartItem) => void;
    openPizzaEditPopUp: (item: CartItem) => void;
    openPizzaComboEditPopup: (item: CartItem) => void;
    openDetroitComboEditPopup: (item: CartItem) => void;
    isAdmin: boolean;
    handleDiscountChange: (item: CartItem, discount: number) => void;
    menuData: MenuItemType[];
}

export const discountArray = Array.from({ length: 21 }, (_, i) => i * 5);

function CartItemHorizontal({
                                item,
                                onChangeQuantity,
                                onChangeSize,
                                onRemoveItem,
                                openPizzaEditPopUp,
                                openPizzaComboEditPopup,
                                openDetroitComboEditPopup,
                                isAdmin,
                                handleDiscountChange,
                                menuData,
                            }: CartItemHorizontalProps): JSX.Element {
    const discount = item.discountAmount || 0;
    const discountedPrice = item.amount * (1 - discount / 100);
    const itemTotal = (discountedPrice * item.quantity).toFixed(2);

    function renderItemDetails(cartItem: CartItem): JSX.Element | null {
        if (cartItem.category === "Combo Deals" && Array.isArray(cartItem.comboItems)) {
            return (
                <Box sx={{ mt: 1, ml: 1 }}>
                    {cartItem.comboItems.map((ci, idx) => {
                        const extras: string[] = [];
                        if (ci.isThinDough) extras.push("Thin Dough");
                        if (ci.isGarlicCrust) extras.push("Garlic Crust");

                        if (ci.description) {
                            ci.description
                                .split("+")
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .forEach((s) => extras.push(s));
                        }

                        return (
                            <Typography
                                key={idx}
                                variant="body2"
                                sx={{ ml: 1 }}
                            >
                                • <strong>{ci.name}</strong>
                                {ci.size && ` (${ci.size})`}
                                {extras.length > 0 && " + " + extras.join(" + ")}
                            </Typography>
                        );
                    })}
                </Box>
            );
        }

        const extras: string[] = [];
        if (cartItem.isThinDough) extras.push("Thin Dough");
        if (cartItem.isGarlicCrust) extras.push("Garlic Crust");

        if (cartItem.description) {
            cartItem.description
                .split("+")
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((s) => extras.push(s));
        }

        return extras.length > 0 ? (
            <Box sx={{ mt: 1, ml: 1 }}>
                <Typography variant="body2" sx={{ ml: 1 }}>
                    + {extras.join(" + ")}
                </Typography>
            </Box>
        ) : null;
    }


    return (
        <Box
            sx={{
                position: "relative",
                backgroundColor: "#fff",
                borderRadius: 6,
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                p: 2,
                mb: 2
            }}
        >
            {item.category === "Pizzas" && <IconButton
                onClick={() => {
                    openPizzaEditPopUp(item)
                }}

                sx={{
                    position: "absolute",
                    top: 8,
                    right: 36,
                    color: "#555",
                }}
            >
                <Edit/>
            </IconButton>
            }
            {item.category === "Combo Deals" && item.name === "Pizza Combo" && <IconButton
                onClick={() => {
                    openPizzaComboEditPopup(item)
                }}

                sx={{
                    position: "absolute",
                    top: 8,
                    right: 36,
                    color: "#555",
                }}
            >
                <Edit/>
            </IconButton>
            }

            {item.category === "Combo Deals" && item.name === "Detroit Combo" && <IconButton
                onClick={() => {
                    openDetroitComboEditPopup(item)
                }}

                sx={{
                    position: "absolute",
                    top: 8,
                    right: 36,
                    color: "#555",
                }}
            >
                <Edit/>
            </IconButton>
            }

            <IconButton
                onClick={() => {
                    onRemoveItem?.(item)
                }}

                sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    color: "#555",
                }}
            >
                <CloseIcon/>
            </IconButton>

            <Box sx={{display: "flex", alignItems: "flex-start"}}>
                <Box sx={{width: 80, height: 80, flexShrink: 0, mr: 2}}>
                    <CardMedia
                        component="img"
                        image={item.photo}
                        alt={item.name}
                        sx={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 4
                        }}
                    />
                </Box>

                <Box sx={{flex: 1, minWidth: 0, pr: "40px"}}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{color: "#000"}}>
                        {item.name}
                    </Typography>
                    {item.description && item.category !== "Combo Deals" ? (
                        <Typography variant="body2" sx={{color: "#555", mt: 0.5}}>
                            {item.description}
                        </Typography>
                    ) : (
                        renderItemDetails(item)
                        )}
                </Box>
            </Box>

            <Divider sx={{my: 1.5}}/>

            <Box>
                {isAdmin && (
                    <Box sx={{mt: 1}}>
                        <FormControl fullWidth sx={{mb: 2}}>
                            <InputLabel id={`discount-label-${item.name}`}>Discount</InputLabel>
                            <Select
                                size="small"
                                labelId={`discount-label-${item.name}`}
                                value={item.discountAmount ?? 0}
                                label="Discount"
                                MenuProps={{
                                    PaperProps: {
                                        sx: { zIndex: 2000 }
                                    }
                                }}
                                onChange={(e) =>
                                    handleDiscountChange?.(item, Number(e.target.value))
                                }
                                sx={{
                                    backgroundColor: "#FAFAFA",
                                    borderRadius: 2,
                                    "& .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "#ccc"
                                    },
                                    "&:hover .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "#E44B4C"
                                    },
                                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "#E44B4C"
                                    }
                                }}
                            >
                                {discountArray.map((percent) => (
                                    <MenuItem key={percent} value={percent}>
                                        {percent}%
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                )}
            </Box>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    py: 0.1,
                    gap: 1.5
                }}
            >
                <Typography
                    variant="body1"
                    fontWeight="bold"
                    sx={{
                        color: "#333",
                        mr: "auto",
                        ml: 2,
                    }}
                >
                    {itemTotal}
                </Typography>

                {item.category === "Pizzas" && <ToggleButtonGroup
                    exclusive
                    value={item.size}
                    onChange={(e, val) => val && onChangeSize(item, val)}
                    sx={{
                        backgroundColor: brandGray,
                        borderRadius: 8,
                        p: "0.5px",
                        flex: 1,
                        "& .MuiToggleButtonGroup-grouped": {
                            border: 0,
                            flex: 1,
                            borderRadius: 8,
                            mr: "4px",
                            "&:not(:last-of-type)": {
                                borderRight: "none"
                            }
                        }
                    }}
                    fullWidth
                >
                    {allowedDough(item, menuData).map((label) => (
                        <ToggleButton key={label} value={label} sx={{
                            textTransform: "none",
                            fontSize: "16px",
                            justifyContent: "center",
                            color: "#666",
                            borderRadius: 8,
                            height: "100%",
                            "&:hover": {
                                backgroundColor: "transparent"
                            },
                            "&.Mui-selected": {
                                backgroundColor: "#fff",
                                color: brandRed,
                                boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                                "&:hover": {
                                    backgroundColor: "#fff"
                                }
                            }
                        }}>
                            {label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
                }
                {(100 !== item.discountAmount || isAdmin) && (
                <Box
                    sx={{
                        backgroundColor: brandGray,
                        borderRadius: "9999px",
                        display: "flex",
                        alignItems: "center",
                        p: "4px",
                        gap: "4px"
                    }}
                >
                    <Button
                        onClick={() =>
                            item.quantity > 1 &&
                            onChangeQuantity?.(item, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                        sx={{
                            minWidth: 32,
                            height: 40,
                            backgroundColor: "transparent",
                            color: "#666",
                            fontSize: "16px",
                            textTransform: "none",
                            borderRadius: "9999px",
                            p: 0,
                            "&:hover": {
                                backgroundColor: "rgba(0,0,0,0.1)"
                            }
                        }}
                    >
                        –
                    </Button>

                    <Box
                        sx={{
                            minWidth: 20,
                            textAlign: "center",
                            fontSize: "20px",
                            color: "#666"
                        }}
                    >
                        {item.quantity}
                    </Box>

                    <Button
                        onClick={() => onChangeQuantity?.(item, item.quantity + 1)}
                        sx={{
                            minWidth: 32,
                            height: 28,
                            backgroundColor: "transparent",
                            color: "#666",
                            fontSize: "16px",
                            textTransform: "none",
                            borderRadius: "9999px",
                            p: 0,
                            "&:hover": {
                                backgroundColor: "rgba(0,0,0,0.1)"
                            }
                        }}
                    >
                        +
                    </Button>
                </Box>
                )}
            </Box>
        </Box>
    );
}

function allowedDough(pizza: CartItem, menuData: MenuItemType[]): string[] {
    const allowedSizes = new Set<string>();

    for (const item of menuData) {
        if (item.name === pizza.name && item.available===true) {
            allowedSizes.add(item.size);
        }
    }

    if (pizza.isThinDough) {
        allowedSizes.delete("S");
    }

    return Array.from(allowedSizes);
}

export default CartItemHorizontal;
