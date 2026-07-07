import React, {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {
    Modal,
    Box,
    Typography,
    Fab,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import * as PropTypes from "prop-types";
import PizzaLoader from "../../../order-status/components/animations/PizzaLoader";
import {ToppingsScroll} from "../ToppingsScroll";
import {QuickPickChips} from "../QuickPickChips";
import {BetterTogetherComponent} from "../../../order/components/BetterTogetherComponent";
import {useLocalizedItem} from "../../../../shared/hooks/useLocalizedItem";
import {useOptionLabel} from "../../../../shared/hooks/useOptionLabel";
import type { MenuItem, CartItem, ExtraIngr, Topping, Group } from '../../types';


const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

function RoundedTextField(props: Record<string, unknown>): null {
    return null;
}

RoundedTextField.propTypes = {
    fullWidth: PropTypes.bool,
    InputProps: PropTypes.shape({startAdornment: PropTypes.element}),
    minRows: PropTypes.number,
    maxRows: PropTypes.number,
    onChange: PropTypes.func,
    multiline: PropTypes.bool,
    variant: PropTypes.string,
    placeholder: PropTypes.string
};

interface PizzaPopupProps {
    open: boolean;
    onClose: () => void;
    editItem?: CartItem | null;
    group: Group;
    extraIngredients?: ExtraIngr[];
    onAddToCart: (products: CartItem[]) => void;
    crossSellItems?: MenuItem[];
    removeFromCart: (name: string, amount: number, quantity: number) => void;
    isEditMode?: boolean;
    toppings?: Topping[];
    isSDoughAvailable?: boolean;
    isAdmin?: boolean;
}

function PizzaPopup({
                        open,
                        onClose,
                        editItem,
                        group,
                        extraIngredients = [],
                        onAddToCart,
                        crossSellItems = [],
                        removeFromCart,
                        isEditMode,
                        toppings = [],
                        isSDoughAvailable,
                        isAdmin
                    }: PizzaPopupProps): JSX.Element | null {
    const {t} = useTranslation("menu");
    const {name: localizeName, description: localizeDescription} = useLocalizedItem();
    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState<MenuItem | null>(null);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [selectedDough, setSelectedDough] = useState("Traditional");
    const [quantity, setQuantity] = useState(1);
    const [selectedIngr, setSelectedIngr] = useState<string[]>([]);
    const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
    const [crossSellMap, setSelectedCrossSellItems] = useState<Record<string, number>>({});
    const [note, setNote] = useState("");
    const [availableSizes, setAvailableSizes] = useState<string[]>([])
    const [selectedQuickPickIds, setSelectedQuickPickIds] = useState<number[]>([]);
    useEffect(() => {
        const TT_PIXEL_ID = 'D1SBUPRC77U25MKH1E40';

        if (!window.ttq) {
            // as unknown as TikTokBootstrap — TikTok's own bootstrap pattern uses a hybrid array/object
            type TikTokBootstrap = {
                methods: string[];
                setAndDefer: (t: Record<string, unknown>, e: string) => void;
                load: (e: string, n?: unknown) => void;
                page: () => void;
                [key: string]: unknown;
            };
            (function (w, d, t) {
                w.TiktokAnalyticsObject = t;
                const ttq = (w[t] = w[t] || []) as unknown as TikTokBootstrap;
                ttq.methods = [
                    "page", "track", "identify", "instances", "debug", "on", "off",
                    "once", "ready", "alias", "group", "enableCookie", "disableCookie",
                    "holdConsent", "revokeConsent", "grantConsent"
                ];
                ttq.setAndDefer = function (t: Record<string, unknown>, e: string) {
                    t[e] = function () {
                        // eslint-disable-next-line prefer-rest-params
                        // as unknown as unknown[] — TikTok bootstrap mutates ttq as both map and array
                        (t as unknown as unknown[]).push([e].concat(Array.prototype.slice.call(arguments, 0)));
                    };
                };
                for (let i = 0; i < ttq.methods.length; i++) {
                    ttq.setAndDefer(ttq as unknown as Record<string, unknown>, ttq.methods[i]);

                }

                ttq.load = function (e: string, n?: unknown) {
                    const r = "https://analytics.tiktok.com/i18n/pixel/events.js";
                    const script = d.createElement("script");
                    script.type = "text/javascript";
                    script.async = true;
                    script.src = `${r}?sdkid=${e}&lib=${t}`;
                    const f = d.getElementsByTagName("script")[0];
                    f.parentNode!.insertBefore(script, f);
                };

                ttq.load(TT_PIXEL_ID);
                ttq.page();
            })(window, document, 'ttq')
        }
        setLoading(true);
        if (isEditMode && editItem) {
            setItem(editItem as unknown as MenuItem);
            setSelectedSize(editItem.size);
            setSelectedDough(editItem.isThinDough ? "Thin" : "Traditional");
            setQuantity(editItem.quantity)
            setSelectedToppings((editItem as unknown as Record<string, string[]>).toppings || [])
            setSelectedIngr(editItem.extraIngredients as unknown as string[] || [])
            setNote((editItem as unknown as Record<string, string>).note || "")
        } else if (group) {
            const defaultItem = group.items.find(i => i.size === "M" && i.available) || group.items.find(i => i.available) || group.items[0];
            setItem(defaultItem);
            setSelectedSize(defaultItem.size);
            setSelectedDough("Traditional");
            window.ttq?.track('ViewContent', {
                content_id: defaultItem.name,
                content_type: 'product',
                content_name: defaultItem.name,
                currency: 'BHD',
                value: defaultItem.price
            });
        }
        const sizes = Array.from(new Set(group.items.filter(i => i.available).map(i => i.size)));
        const order = ["S", "M", "L"];
        const sortedSizes = order.filter(size => sizes.includes(size));
        setAvailableSizes(sortedSizes);
        setLoading(false);
    }, [open, group, isEditMode, editItem]);

    const showDoughSelector =
        (selectedSize === "M" && isSDoughAvailable) ||
        (selectedSize === "L" && isSDoughAvailable) || isAdmin

    useEffect(() => {
        if (selectedSize === "S" || showDoughSelector === false) {
            setSelectedDough("Traditional");
        }
    }, [selectedSize, showDoughSelector]);

    const matchedItem = group.items.find(it => it.size === selectedSize);
    const basePrice = matchedItem ? matchedItem.price : 0;

    const quickPickMenuItemId = matchedItem?.id ?? item?.id;

    // Resets stale selections whenever the customized menu_item row changes (size toggle,
    // or the popup reopening for a different item) — a quick_pick belongs to exactly one menu_item.
    useEffect(() => {
        setSelectedQuickPickIds([]);
    }, [quickPickMenuItemId, open]);

    const ingrsForSize = extraIngredients.filter(ing => (ing as unknown as Record<string, unknown>).size === selectedSize);

    const extraCost = (selectedIngr || []).reduce((sum, ingrName) => {
        const found = ingrsForSize.find(i => i.name === ingrName);
        return found ? sum + (found as unknown as Record<string, number>).price : sum;
    }, 0);

    const toppingCost = (selectedToppings || []).reduce((sum, ingrName) => {
        const found = toppings.find(i => i.name === ingrName);
        return found ? sum + (found as unknown as Record<string, number>).price : sum;
    }, 0);

    const finalPizzaPricePerItem = (basePrice + extraCost + toppingCost);

    function getFinalPriceOnPopup(): string {
        let price = 0;
        crossSellItems.forEach((item => {
            const count = crossSellMap[item.name];
            if (count) {
                price += item.price * count;
            }
        }))
        return (finalPizzaPricePerItem * quantity + price).toFixed(2);
    }

    function handleToggleIngr(name: string): void {
        if (selectedIngr.includes(name)) {
            setSelectedIngr(prev => prev.filter(x => x !== name));
        } else {
            setSelectedIngr(prev => [...prev, name]);
        }
    }

    function getDesc(): string {
        let parts: string[] = [];

        if (selectedDough !== "Traditional") {
            parts.push(`+${selectedDough}`);
        }

        if (selectedIngr && selectedIngr.length > 0) {
            const extra = selectedIngr.map(ingr => `+${ingr}`).join(" ");
            parts.push(`(${extra})`);
        }

        if (selectedToppings && selectedToppings.length > 0) {
            const topping = selectedToppings.map(topping => `+${topping} Topping`).join(" ");
            parts.push(`(${topping})`);
        }
        if (note !== "") parts.push(`+${note}`);
        return parts.join(" ");
    }

    function handleAdd(): void {
        if (!item) return;
        let isThinDoughVal = selectedDough !== "Traditional";
        let isGarlicCrustVal = selectedIngr.includes("garlic crust");

        const currentVariant = matchedItem || item;

        // Quick picks are merged into `note` as they are toggled, and getDesc() already appends the
        // note, so the description carries them without a separate concatenation.
        const finalDescription = getDesc();

        const products: CartItem[] = [{
            ...currentVariant,
            name: item.name,
            size: selectedSize ?? item.size,
            category: item.category,
            isThinDough: isThinDoughVal,
            isGarlicCrust: isGarlicCrustVal,
            extraIngredients: selectedIngr as unknown as ExtraIngr[],
            toppings: selectedToppings as unknown as Topping[],
            note: note,
            quantity,
            description: finalDescription,
            amount: finalPizzaPricePerItem,
            discountAmount: 0,
            comboItems: [],
        }];
        crossSellItems.forEach((item => {
            const count = crossSellMap[item.name];
            if (count) {
                products.push({
                    ...item,
                    quantity: count,
                    amount: item.price,
                    isThinDough: false,
                    isGarlicCrust: false,
                    extraIngredients: [],
                    toppings: [],
                    note: "",
                    description: "",
                    discountAmount: 0,
                    comboItems: [],
                });
            }
        }))
        // Edit replacement is handled in useCart.handleAddToCart by reference; removing
        // by value here could wipe other identical lines, so it is intentionally omitted.
        onAddToCart?.(products);
        onClose?.();
    }

    function increaseQuantityOnCrossSell(name: string): void {
        setSelectedCrossSellItems(prev => ({
            ...prev,
            [name]: (prev[name] || 0) + 1
        }));
    }

    function decreaseQuantityOnCrossSell(name: string): void {
        setSelectedCrossSellItems(prev => {
            const currentCount = prev[name] || 0;
            if (currentCount <= 1) {
                const {[name]: _, ...rest} = prev;
                return rest;
            } else {
                return {
                    ...prev,
                    [name]: currentCount - 1
                };
            }
        });
    }

    if (loading) return <PizzaLoader/>;
    if (!item) return null;
    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "3%",
                    bottom: "0%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: {xs: "100%", md: 400},
                    maxHeight: "97vh",
                    bgcolor: "#fff",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column"
                }}
            >
                <Fab
                    size="small"
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        color: brandRed,
                        backgroundColor: "#fff",
                        zIndex: 9999
                    }}
                >
                    <CloseIcon/>
                </Fab>

                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        scrollbarWidth: "none",
                        boxSizing: "border-box",
                        "&::-webkit-scrollbar": {
                            display: "none"
                        }
                    }}>
                    <Box sx={{
                        width: "100%",
                        height: {
                            xs: 460,
                            sm: 500,
                            md: 480,
                            lg: 460,
                            xl: 520
                        },
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#fff"
                    }}>

                    <img
                            src={item.photo}
                            alt={localizeName(item)}
                            style={{width: "100%", height: "100%", objectFit: "contain"}}
                        />
                    </Box>

                    <Box
                        sx={{
                            px: {xs: 2, md: 3},
                            boxSizing: "border-box",
                            pt: 2,
                            pb: 2
                        }}
                    >
                        <Typography variant="h6" sx={{fontWeight: "bold", mb: 3, textAlign: "center"}}>
                            {localizeName(item)}
                        </Typography>

                        <TogglesWithQuantity
                            selectedSize={selectedSize}
                            selectedDough={selectedDough}
                            setSelectedDough={setSelectedDough}
                            quantity={quantity}
                            setQuantity={setQuantity}
                            showDoughSelector={showDoughSelector}
                            isAdmin={isAdmin}
                        />

                        <QuickPickChips
                            menuItemId={quickPickMenuItemId}
                            selectedIds={selectedQuickPickIds}
                            onChange={(ids) => setSelectedQuickPickIds(ids)}
                            note={note}
                            onNoteChange={setNote}
                        />

                        <TextField
                            label={t("pizzaPopup.addNote")}
                            fullWidth
                            multiline
                            rows={2}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            sx={{mb: 3}}
                            InputProps={{sx: {borderRadius: 4}}}
                        />

                        <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, px: 0.2}}>
                            {t("pizzaPopup.customize")}
                        </Typography>

                        <Box
                            sx={{
                                display: "flex",
                                overflowX: "auto",
                                gap: 1,
                                mb: 2,
                                py: 1,
                                px: 0.2,
                                scrollSnapType: "x mandatory",
                                scrollbarWidth: "none",
                                "&::-webkit-scrollbar": {
                                    display: "none"
                                }
                            }}
                        >
                            <Box
                                key={"garlic crust"}
                                onClick={() => {
                                    handleToggleIngr("garlic crust");
                                }}
                                sx={{
                                    width: 140,
                                    flexShrink: 0,
                                    textAlign: "center",
                                    p: 2,
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    color: "#000",
                                    boxShadow: selectedIngr.includes("garlic crust")
                                        ? `0 0 0 2px ${brandRed}`
                                        : "0 1px 3px rgba(0,0,0,0.25)",
                                    border: "none",
                                    "&:hover": {
                                        boxShadow: selectedIngr.includes("garlic crust")
                                            ? `0 0 0 2px ${brandRed}`
                                            : "0 2px 5px rgba(0,0,0,0.2)"
                                    }
                                }}
                            >
                                <img
                                    src="/crust.png"
                                    alt="CRUST"
                                    style={{
                                        maxWidth: "100%",
                                        height: 120,
                                        objectFit: "contain"
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: "bold",
                                        mt: 1,
                                        overflowWrap: "break-word",
                                        wordWrap: "break-word",
                                        whiteSpace: "normal",
                                        lineHeight: 1.2
                                    }}
                                >
                                    {t("pizzaPopup.garlicCrust")}
                                </Typography>
                                <Typography variant="body2" sx={{mt: 1.2}}>
                                    {t("pizzaPopup.free")}
                                </Typography>
                            </Box>
                            {item.name === "Margherita" && <Box
                                key={"cherry"}
                                onClick={() => {
                                    handleToggleIngr("cherry");
                                }}
                                sx={{
                                    width: 140,
                                    flexShrink: 0,
                                    textAlign: "center",
                                    p: 2,
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    color: "#000",
                                    boxShadow: selectedIngr.includes("cherry")
                                        ? `0 0 0 2px ${brandRed}`
                                        : "0 1px 3px rgba(0,0,0,0.25)",
                                    border: "none",
                                    "&:hover": {
                                        boxShadow: selectedIngr.includes("cherry")
                                            ? `0 0 0 2px ${brandRed}`
                                            : "0 2px 5px rgba(0,0,0,0.2)"
                                    }
                                }}
                            >
                                <img
                                    src="/cherry.png"
                                    alt="CRUST"
                                    style={{
                                        maxWidth: "100%",
                                        height: 120,
                                        objectFit: "contain"
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: "bold",
                                        mt: 1,
                                        overflowWrap: "break-word",
                                        wordWrap: "break-word",
                                        whiteSpace: "normal",
                                        lineHeight: 1.2
                                    }}
                                >
                                    {t("pizzaPopup.cherry")}
                                </Typography>
                                <Typography variant="body2" sx={{mt: 1.2}}>
                                    {t("pizzaPopup.free")}
                                </Typography>
                            </Box>
                            }
                            {ingrsForSize.map((ing) => {
                                const active = selectedIngr.includes(ing.name);
                                const ingWithPhoto = ing as unknown as Record<string, unknown>;
                                return (
                                    <Box
                                        key={ing.name}
                                        onClick={() => handleToggleIngr(ing.name)}
                                        sx={{
                                            width: 140,
                                            flexShrink: 0,
                                            textAlign: "center",
                                            p: 2,
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            fontSize: "13px",
                                            color: "#000",
                                            boxShadow: active
                                                ? `0 0 0 2px ${brandRed}`
                                                : "0 1px 3px rgba(0,0,0,0.25)",
                                            border: "none",
                                            "&:hover": {
                                                boxShadow: active
                                                    ? `0 0 0 2px ${brandRed}`
                                                    : "0 2px 5px rgba(0,0,0,0.2)"
                                            }
                                        }}
                                    >
                                        {ingWithPhoto.photo ? (
                                            <img
                                                src={ingWithPhoto.photo as string}
                                                alt={localizeName(ing)}
                                                style={{
                                                    maxWidth: "100%",
                                                    height: 120,
                                                    objectFit: "contain"
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: "100%",
                                                    height: 120,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    backgroundColor: "#f9f9f9"
                                                }}
                                            />
                                        )}
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: "bold",
                                                mt: 1,
                                                overflowWrap: "break-word",
                                                wordWrap: "break-word",
                                                whiteSpace: "normal",
                                                lineHeight: 1.2
                                            }}
                                        >
                                            {localizeName(ing)}
                                        </Typography>
                                        <Typography variant="body2" sx={{mt: 0.5}}>
                                            +{ingWithPhoto.price as number}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>

                        <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, px: 0.2}}>
                            {t("pizzaPopup.drizzles")}
                        </Typography>

                        <ToppingsScroll
                            toppings={toppings as unknown as Parameters<typeof ToppingsScroll>[0]['toppings']}
                            selectedToppings={selectedToppings}
                            onUpdateSelectedToppings={setSelectedToppings}
                        />

                        <BetterTogetherComponent
                            betterTogether={crossSellItems}
                            selectedItems={crossSellMap}
                            increaseQuantityOnCrossSell={increaseQuantityOnCrossSell}
                            decreaseQuantityOnCrossSell={decreaseQuantityOnCrossSell}
                        />

                        {!isEditMode &&
                            <Box>
                                <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, px: 0.2}}>
                                    {t("pizzaPopup.about")}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        mb: 2,
                                        color: "#444",
                                        lineHeight: 1.4,
                                        fontSize: "14px"
                                    }}
                                >
                                    {localizeDescription(item)}
                                </Typography>
                            </Box>
                        }
                    </Box>
                </Box>

                <Box
                    sx={{
                        borderTop: "1px solid #eee",
                        display: "flex",
                        gap: 2,
                        p: 2,
                        alignItems: "stretch",
                    }}
                >
                    <ToggleButtonGroup
                        exclusive
                        value={selectedSize}
                        onChange={(e, val) => val && setSelectedSize(val)}
                        sx={{
                            backgroundColor: brandGray,
                            borderRadius: 8,
                            p: "4px",
                            flex: 1, // 50%
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
                        {availableSizes.map((label) => (
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

                    <Button
                        variant="contained"
                        fullWidth
                        onClick={handleAdd}
                        sx={{
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "20px",
                            borderRadius: 8,
                            flex: 1,
                            height: "100%",
                            "&:hover": {
                                backgroundColor: "#d23f40"
                            }
                        }}
                    >
                        {t("pizzaPopup.add", {price: getFinalPriceOnPopup()})}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

interface TogglesWithQuantityProps {
    selectedSize: string | null;
    selectedDough: string;
    setSelectedDough: (dough: string) => void;
    quantity: number;
    setQuantity: React.Dispatch<React.SetStateAction<number>>;
    showDoughSelector: boolean | undefined;
    isAdmin: boolean;
}

export function TogglesWithQuantity({
                                 selectedSize,
                                 selectedDough,
                                 setSelectedDough,
                                 quantity,
                                 setQuantity,
                                 showDoughSelector,
                                    isAdmin
                             }: TogglesWithQuantityProps): JSX.Element {
    const optionLabel = useOptionLabel();
    const groupSx = {
        backgroundColor: brandGray,
        borderRadius: "9999px",
        p: "4px",
        display: "flex",
        alignItems: "center",
        height: "36px",
        flexGrow: 1,
        "& .MuiToggleButtonGroup-grouped": {
            border: 0,
            flex: 1,
            borderRadius: "9999px",
            mr: "4px",
            "&:not(:last-of-type)": {
                borderRight: "none"
            }
        }
    };

    const toggleBtnSx = {
        textTransform: "none",
        fontSize: "14px",
        justifyContent: "center",
        color: "#666",
        borderRadius: "9999px",
        height: 34,
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
    };

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mb: 2,
                mt: 1,
                justifyContent: "space-between",
                flexWrap: "wrap"
            }}
        >
            <Box
                sx={{
                    backgroundColor: brandGray,
                    borderRadius: "9999px",
                    p: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    height: 34,
                    minWidth: 108,
                }}
            >
                <Button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    sx={{
                        minWidth: 34,
                        height: 26,
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
                <Box sx={{minWidth: 30, textAlign: "center", fontSize: "15px", color: "#666"}}>
                    {quantity}
                </Box>
                <Button
                    onClick={() => setQuantity((q) => q + 1)}
                    sx={{
                        minWidth: 34,
                        height: 26,
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

            {showDoughSelector && (
                <ToggleButtonGroup
                    exclusive
                    value={selectedDough}
                    onChange={(e, val) => val && setSelectedDough(val)}
                    sx={groupSx}
                >
                    {["Traditional", "Thin"].map((label) => (
                        <ToggleButton key={label} value={label} sx={toggleBtnSx}>
                            {optionLabel(label)}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            )}
        </Box>
    );
}

export default PizzaPopup;
