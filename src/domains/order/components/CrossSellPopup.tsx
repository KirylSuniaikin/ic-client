import {Box, Button, Typography} from "@mui/material";
import {useTranslation} from "react-i18next";
import {useState} from "react";
import type { MenuItem, CartItem } from '../../menu/types';
import {useLocalizedItem} from "../../../shared/hooks/useLocalizedItem";
import {ItemPopupShell} from "../../menu/components/popups/ItemPopupShell";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";
const stepperHeight = 30;

interface CrossSellPopupProps {
    open: boolean;
    onClose: () => void;
    onAddToCart: (products: CartItem[]) => void;
    crossSellItems?: MenuItem[];
    onCheckout: () => void;
}

function CrossSellPopup({
                            open,
                            onClose,
                            onAddToCart,
                            crossSellItems = [],
                            onCheckout
                        }: CrossSellPopupProps): JSX.Element {
    const { t } = useTranslation("checkout");
    const {name: localizeName} = useLocalizedItem();
    const [crossSellMap, setSelectedCrossSellItems] = useState<Record<string, number>>({});


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

    function handleAdd(): void {
        const products: CartItem[] = []
        crossSellItems.forEach((item => {
            const count = crossSellMap[item.name];
            let desc = ""
            if (item.name === "Pizza Rolls") {
                desc = "Pepperoni"
            }
            if (count) {
                products.push({
                    ...item,
                    name: item.name,
                    quantity: count,
                    amount: item.price,
                    description: desc,
                    isThinDough: false,
                    isGarlicCrust: false,
                    extraIngredients: [],
                    toppings: [],
                    note: "",
                    discountAmount: 0,
                    comboItems: [],
                });
            }
        }))
        onAddToCart?.(products);
        onCheckout?.();
        onClose?.();
    }


    const footer = (
        <Box sx={{ borderTop: "1px solid #eee", p: 2 }}>
            <Button
                variant="contained"
                fullWidth
                sx={{
                    backgroundColor: brandRed,
                    color: "#fff",
                    textTransform: "none",
                    fontSize: "1rem",
                    borderRadius: 4,
                    "&:hover": {
                        backgroundColor: "#d23f40"
                    }
                }}
                onClick={handleAdd}
            >
                {t("crossSell.next")}
            </Button>
        </Box>
    );

    return (
        <ItemPopupShell
            open={open}
            onClose={onClose}
            legacy={{
                paperSx: {
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    bgcolor: "#fff",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxHeight: "85vh",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                },
                // Only the title and cards scroll, so Next stays on screen when six items need a
                // third row of cards on a phone.
                scrollSx: {
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflowY: "auto",
                },
            }}
            desktop={{ width: 560 }}
            footer={footer}
            showClose={false}
        >
            <Typography
                variant="h6"
                sx={{
                    fontWeight: "bold",
                    pt: 3,
                    pb: 1,
                    px: 3
                }}
            >
                {t("crossSell.title")}
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    // Two columns fit a 360px phone with the -/qty/+ stepper inside each card; three
                    // from 600px up, which also covers the 560px PC dialog (only shown from 900px).
                    gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        sm: "repeat(3, minmax(0, 1fr))"
                    },
                    gap: 1.5,
                    px: 3,
                    pt: 1,
                    pb: 3
                }}
            >
                {crossSellItems.slice(0, 6).map((item) => {
                    const active = crossSellMap[item.name] != null;
                    return (
                        <Box
                            key={item.name}
                            onClick={() => {
                                if (!active) increaseQuantityOnCrossSell(item.name);
                            }}
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                minWidth: 0,
                                textAlign: "center",
                                p: 2,
                                borderRadius: 4,
                                cursor: "pointer",
                                boxShadow: active
                                    ? `0 0 0 2px ${brandRed}`
                                    : "0 1px 3px rgba(0,0,0,0.25)",
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
                                        display: "block",
                                        width: "100%",
                                        height: 120,
                                        objectFit: "contain"
                                    }}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        width: "100%",
                                        height: 120,
                                        backgroundColor: "#f3f3f3"
                                    }}
                                />
                            )}

                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: "bold",
                                    mt: 1,
                                    // Grows to fill the card, so a one-line name's price sits as low as
                                    // a two-line neighbour's.
                                    flexGrow: 1,
                                    overflowWrap: "break-word",
                                    wordWrap: "break-word",
                                    whiteSpace: "normal",
                                    lineHeight: 1.2
                                }}
                            >
                                {localizeName(item)}
                            </Typography>

                            <Box
                                sx={{
                                    // As tall as the stepper, so picking a card does not grow its row.
                                    height: stepperHeight,
                                    mt: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {!active && (
                                    <Typography variant="body2">
                                        +{item.price}
                                    </Typography>
                                )}

                                {active && (
                                    <Box
                                        sx={{
                                            backgroundColor: brandGray,
                                            borderRadius: "9999px",
                                            p: "4px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "4px",
                                            height: stepperHeight
                                        }}
                                    >
                                        <Button
                                            onClick={() => decreaseQuantityOnCrossSell(item.name)}
                                            sx={{ minWidth: 36, height: 26 }}
                                        >
                                            –
                                        </Button>
                                        <Box sx={{ minWidth: 22, textAlign: "center" }}>
                                            {crossSellMap[item.name]}
                                        </Box>
                                        <Button
                                            onClick={() => increaseQuantityOnCrossSell(item.name)}
                                            sx={{ minWidth: 36, height: 26 }}
                                        >
                                            +
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </ItemPopupShell>
    )
}

export default CrossSellPopup;
