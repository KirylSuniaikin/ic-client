import React from "react";
import { useTranslation } from "react-i18next";
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
import { useLocalizedItem } from "../../../shared/hooks/useLocalizedItem";
import { useOptionLabel } from "../../../shared/hooks/useOptionLabel";
import { buildDisplay, OPTION_VALUES } from "../../menu/utils/buildDisplay";
import type { BuildDisplayMenuData } from "../../menu/utils/buildDisplay";
import type { CartItem, ComboItem, MenuItem as MenuItemType, Topping, ExtraIngr } from '../../menu/types';

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
    // Source toppings/extras (with Arabic names) used to localize the customization tokens
    // baked into a cart line's description string. Default [] keeps the cart English-only.
    toppings?: Topping[];
    extras?: ExtraIngr[];
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
                                toppings = [],
                                extras = [],
                            }: CartItemHorizontalProps): JSX.Element {
    const { t, i18n } = useTranslation("cart");
    const { name: localizeName, description: localizeSourceDescription } = useLocalizedItem();
    const optionLabel = useOptionLabel();
    const isArabic = i18n.language.startsWith("ar");
    // CartItem stores only the canonical English name (used for order matching), so resolve the
    // Arabic display name by looking the source MenuItem up in menuData. Falls back to the raw
    // English name when the item isn't in menuData or has no name_ar.
    const localizedName = (rawName: string): string => {
        const source = menuData.find((m) => m.name === rawName);
        return source ? localizeName(source) : rawName;
    };

    // useOptionLabel is a hook, so the pure buildDisplay util can't call it itself — resolved
    // here and threaded in via the menu data bundle.
    const doughLabels: Record<string, string> = Object.fromEntries(
        OPTION_VALUES.map((value) => [value, optionLabel(value)])
    );
    const displayMenu: BuildDisplayMenuData = { toppings, extras, menuItems: menuData, doughLabels };

    // Structural data present -> build the ingredient string from it. Empty/absent (a
    // pre-migration cart line — shouldn't happen for fresh carts, but be safe) -> fall back to
    // showing the stored description as-is. Dough/crust flags count as structural too (a
    // dough-only change with no add/remove customizations is still a fresh, structured line).
    const resolveDisplayText = (source: CartItem | ComboItem): string => {
        const hasStructure = (source.customizations?.length ?? 0) > 0 || !!source.isThinDough || !!source.isGarlicCrust;
        if (!hasStructure) return source.description || "";
        return buildDisplay(source, displayMenu, isArabic);
    };

    // A cart line's description is either the menu item's own description (simple items) or a
    // built-up customization string (pizzas/combos). Localize the former via description_ar and
    // build the latter from structured data.
    const localizeItemDescription = (cartItem: CartItem): string => {
        const source = menuData.find((m) => m.name === cartItem.name);
        if (source && cartItem.description === source.description) {
            return localizeSourceDescription(source);
        }
        return resolveDisplayText(cartItem);
    };

    const discount = item.discountAmount || 0;
    const discountedPrice = item.amount * (1 - discount / 100);
    const itemTotal = (discountedPrice * item.quantity).toFixed(2);

    function renderItemDetails(cartItem: CartItem): JSX.Element | null {
        if (cartItem.category === "Combo Deals" && Array.isArray(cartItem.comboItems)) {
            return (
                <Box sx={{ mt: 1, ml: 1 }}>
                    {cartItem.comboItems.map((ci, idx) => {
                        // buildDisplay (via resolveDisplayText) is the SOLE source of the
                        // dough/crust token here — it already emits it from ci.isThinDough /
                        // ci.isGarlicCrust, so no separate badge push (that duplicated the token).
                        const extras: string[] = [];

                        const childDisplay = resolveDisplayText(ci);
                        if (childDisplay) {
                            childDisplay
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
                                • <strong>{localizedName(ci.name)}</strong>
                                {ci.size && ` (${ci.size})`}
                                {extras.length > 0 && " + " + extras.join(" + ")}
                                {ci.note && (
                                    <Typography component="span" variant="body2" sx={{ color: "#888", fontStyle: "italic", display: "block", ml: 1 }}>
                                        {ci.note}
                                    </Typography>
                                )}
                            </Typography>
                        );
                    })}
                </Box>
            );
        }

        // buildDisplay (via resolveDisplayText) is the SOLE source of the dough/crust token
        // here too — same duplication fix as the combo branch above.
        const extras: string[] = [];

        const itemDisplay = resolveDisplayText(cartItem);
        if (itemDisplay) {
            itemDisplay
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
                        alt={localizedName(item.name)}
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
                        {localizedName(item.name)}
                    </Typography>
                    {item.description && item.category !== "Combo Deals" ? (
                        <Typography variant="body2" sx={{color: "#555", mt: 0.5}}>
                            {localizeItemDescription(item)}
                        </Typography>
                    ) : (
                        renderItemDetails(item)
                        )}
                    {/* The note is the customer's own free-text — rendered verbatim, separate
                        from the (localized) structural ingredient text above. Combo child notes
                        render per-child inside renderItemDetails instead. */}
                    {item.category !== "Combo Deals" && item.note && (
                        <Typography variant="body2" sx={{color: "#888", fontStyle: "italic", mt: 0.5}}>
                            {item.note}
                        </Typography>
                    )}
                </Box>
            </Box>

            <Divider sx={{my: 1.5}}/>

            <Box>
                {isAdmin && (
                    <Box sx={{mt: 1}}>
                        <FormControl fullWidth sx={{mb: 2}}>
                            <InputLabel id={`discount-label-${item.name}`}>{t("discount")}</InputLabel>
                            <Select
                                size="small"
                                labelId={`discount-label-${item.name}`}
                                value={item.discountAmount ?? 0}
                                label={t("discount")}
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
