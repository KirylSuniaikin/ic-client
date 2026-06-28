import React, {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {
    Modal,
    Box,
    Typography,
    Fab,
    Button, Checkbox, FormControlLabel, TextField
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {useLocalizedItem} from "../../../../shared/hooks/useLocalizedItem";
import type { MenuItem, CartItem, ExtraIngr, Group } from '../../types';

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

interface GenericItemPopupContentProps {
    open: boolean;
    onClose: () => void;
    group: Group;
    extraIngredients?: ExtraIngr[];
    onAddToCart: (products: CartItem[]) => void;
    crossSellItems: MenuItem[];
}

function GenericItemPopupContent({
                                     open,
                                     onClose,
                                     group,
                                     extraIngredients = [],
                                     onAddToCart,
                                     crossSellItems
}: GenericItemPopupContentProps): JSX.Element | null {
    const {t} = useTranslation("menu");
    const {name: localizeName, description: localizeDescription} = useLocalizedItem();
    const [item, setItem] = useState<MenuItem>(group.items[0]);
    const [quantity, setQuantity] = useState(1);
    const [description, setDescription] = useState("");
    const [selectedToppings, setSelectedToppings] = useState<string[]>([""]);
    const [crossSellMap, setSelectedCrossSellItems] = useState<Record<string, number>>({});
    const [note, setNote] = useState( "");

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
        if (open && item) {
            setQuantity(1);
            if (item.name === "Pizza Rolls") {
                setSelectedToppings(["Pepperoni"]);
                setDescription("Pepperoni");
            } else {
                setSelectedToppings([]);
                setDescription("");
            }
            window.ttq?.track('ViewContent', {
                content_id: item.name,
                content_type: 'product',
                content_name: item.name,
                currency: 'BHD',
                value: item.price
            });
        }

    }, [open, item]);

    if (!item) return null;

    const finalPizzaPricePerItem = item.price;

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

    function handleAdd(): void {
        const products: CartItem[] = [{
            ...item,
            name: item.name,
            size: item.size,
            category: item.category,
            quantity: quantity,
            amount: finalPizzaPricePerItem,
            description: item.category === "Brick Pizzas" ? note : description,
            isThinDough: false,
            isGarlicCrust: false,
            extraIngredients: [],
            toppings: [],
            note: "",
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

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "3%",
                    bottom: 0,
                    width: {xs: "100%", md: 400},
                    maxHeight: "98vh",
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

                <Box sx={{
                    flex: 1,
                    overflowY: "auto",
                    scrollbarWidth: "none",
                    boxSizing: "border-box",
                    "&::-webkit-scrollbar": {
                        display: "none"
                    }
                }}>
                    <Box sx={{width: "100%",
                        aspectRatio: "5 / 3",
                        maxHeight: {
                            xs: 400,
                            sm: 800,
                            md: 1000,
                            lg: 420
                        },
                        overflow: "hidden"}}>
                        <img
                            src={item.photo}
                            alt={localizeName(item)}
                            style={{width: "100%", height: "100%", objectFit: "cover"}}
                        />
                    </Box>

                    <Box
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            px: {xs: 2, md: 3},
                            pt: 2,
                            pb: 2
                        }}
                    >
                        <Typography variant="h6" sx={{fontWeight: "bold", mb: 1}}>
                            {localizeName(item)}
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
                        {item.name === "Pizza Rolls" && (
                            <>
                                <FormControlLabel
                                    label={
                                        <Typography variant="body1" sx={{fontWeight: "bold"}}>
                                            Pepperoni
                                        </Typography>
                                    }
                                    control={
                                        <Checkbox
                                            checked={selectedToppings.includes("Pepperoni")}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedToppings(["Pepperoni"]);
                                                    setDescription("Pepperoni");
                                                } else {
                                                    setSelectedToppings([]);
                                                    setDescription("");
                                                }
                                            }}
                                            sx={{
                                                color: brandRed,
                                                "&.Mui-checked": {color: brandRed},
                                            }}
                                        />
                                    }
                                />
                                <FormControlLabel
                                    label={
                                        <Typography variant="body1" sx={{fontWeight: "bold"}}>
                                            Smoked Turkey
                                        </Typography>
                                    }
                                    control={
                                        <Checkbox
                                            checked={selectedToppings.includes("Smoked Turkey")}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedToppings(["Smoked Turkey"]);
                                                    setDescription("Smoked Turkey");
                                                } else {
                                                    setSelectedToppings([]);
                                                    setDescription("");
                                                }
                                            }}
                                            sx={{
                                                color: brandRed,
                                                "&.Mui-checked": {color: brandRed},
                                            }}
                                        />
                                    }
                                />
                            </>
                        )}

                        <Box
                            sx={{
                                backgroundColor: brandGray,
                                borderRadius: "9999px",
                                p: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "4px",
                                height: 34,
                                mb: 2,
                                maxWidth: "130px",
                                mx: "auto"
                            }}
                        >
                            <Button
                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                sx={{
                                    minWidth: 40,
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
                            <Box
                                sx={{
                                    minWidth: 30,
                                    textAlign: "center",
                                    fontSize: "15px",
                                    color: "#666"
                                }}
                            >
                                {quantity}
                            </Box>
                            <Button
                                onClick={() => setQuantity((q) => q + 1)}
                                sx={{
                                    minWidth: 40,
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
                        {item.category === "Brick Pizzas" &&
                            <Box>

                                <TextField
                                    label={t("genericPopup.addNote")}
                                    fullWidth
                                    multiline
                                    rows={2}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    sx={{mb: 3}}
                                    InputProps={{sx: {borderRadius: 4}}}
                                />

                                <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1}}>
                                    {t("genericPopup.betterTogether")}
                                </Typography>

                                <Box
                                    sx={{
                                        display: "flex",
                                        overflowX: "auto",
                                        gap: 1,
                                        mb: 2,
                                        py: 1,
                                        px: 1,
                                        pl: 1,
                                        scrollSnapType: "x mandatory",
                                        "& > *": {
                                            flex: "0 0 auto",
                                            scrollSnapAlign: "start"
                                        },
                                        scrollbarWidth: "none",
                                        "&::-webkit-scrollbar": {
                                            display: "none"
                                        }
                                    }}
                                >
                                    {crossSellItems.map((item) => {
                                        const active = crossSellMap[item.name] != null;
                                        return (
                                            <Box
                                                key={item.name}
                                                onClick={() => {
                                                    if (!active) {
                                                        increaseQuantityOnCrossSell(item.name);
                                                    }
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
                                                {item.photo ? (
                                                    <img
                                                        src={item.photo}
                                                        alt={localizeName(item)}
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
                                                            height: 60,
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
                                                    {localizeName(item)}
                                                </Typography>
                                                {!active &&
                                                    <Typography variant="body2" sx={{mt: 1.2}}>
                                                        +{item.price}
                                                    </Typography>
                                                }
                                                {active &&
                                                    <Box
                                                        sx={{
                                                            backgroundColor: brandGray,
                                                            borderRadius: "9999px",
                                                            p: "4px",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: "4px",
                                                            height: 30,
                                                            mt: 1.1,
                                                            maxWidth: "130px",
                                                        }}
                                                    >
                                                        <Button
                                                            onClick={() => decreaseQuantityOnCrossSell(item.name)}
                                                            sx={{
                                                                minWidth: 36,
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
                                                        <Box sx={{
                                                            minWidth: 22,
                                                            textAlign: "center",
                                                            fontSize: "15px",
                                                            color: "#666"
                                                        }}>
                                                            {crossSellMap[item.name]}
                                                        </Box>
                                                        <Button
                                                            onClick={() => increaseQuantityOnCrossSell(item.name)}
                                                            sx={{
                                                                minWidth: 36,
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
                                                }
                                            </Box>
                                        )
                                    })}
                                </Box>
                            </Box>
                        }

                    </Box>
                </Box>
                <Box
                    sx={{
                        borderTop: "1px solid #eee",
                        p: 2
                    }}
                >
                    <Button
                        variant="contained"
                        fullWidth
                        sx={{
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "16px",
                            borderRadius: 4,
                            "&:hover": {
                                backgroundColor: "#d23f40"
                            }
                        }}
                        onClick={handleAdd}
                    >
                        {t("genericPopup.add", {price: getFinalPriceOnPopup()})}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default GenericItemPopupContent;
