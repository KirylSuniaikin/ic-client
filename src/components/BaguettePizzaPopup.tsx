import {MenuItem} from "../management/types/menuTypes";
import {Box, Button, Fab, Modal, TextField, Typography} from "@mui/material";
import React, {useState} from "react";
import {BetterTogetherComponent} from "./BetterTogetherComponent";
import CloseIcon from "@mui/icons-material/ArrowBackIosNewRounded";

type BaguettePizzaPopupProps = {
    menuItem: MenuItem;
    open: boolean;
    onClose: () => void;
    onAddToCart: (items: any[]) => void;
    crossSellItems: MenuItem[],
    removeFromCart: (name: string, price: number, quantity: number) => void;
}

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

export function BaguettePizzaPopup({menuItem, open, onClose, onAddToCart, crossSellItems, removeFromCart}: BaguettePizzaPopupProps) {
    const [notes, setNotes] = useState<string>("");
    const [quantity, setQuantity] = useState<number>(1);
    const [crossSellMap, setSelectedCrossSellItems] = useState<Record<string, number>>({});

    function getFinalPriceOnPopup() {
        let price = 0;
        crossSellItems.forEach((item => {
            const count = crossSellMap[item.name];
            if (count) {
                price += item.price * count;
            }
        }))
        return (menuItem.price * quantity + price).toFixed(2);
    }

    function increaseQuantityOnCrossSell(name: string) {
        setSelectedCrossSellItems(prev => ({
            ...prev,
            [name]: (prev[name] || 0) + 1
        }));
    }

    function decreaseQuantityOnCrossSell(name: string) {
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

    function handleAdd() {

        const products: any[] = [{
            ...menuItem,
            name: menuItem.name,
            category: menuItem.category,
            note: notes,
            quantity,
            description: notes,
            amount: menuItem.price
        }];
        crossSellItems.forEach((item => {
            const count = crossSellMap[item.name];
            if (count) {
                products.push({
                    ...item,
                    quantity: count,
                    amount: item.price
                });
            }
        }))
        removeFromCart(menuItem.name, menuItem.price, quantity);
        onAddToCart?.(products);
        onClose?.();
    }


    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "3%",
                    bottom: "0%",
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
                    <CloseIcon />
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
                        height: { xs: 250, sm: 400, md: 300 },
                        overflow: "hidden"
                    }}>
                        <img
                            src={menuItem.photo}
                            alt={menuItem.name}
                            style={{width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#fff"}}
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
                            {menuItem.name}
                        </Typography>

                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mb: 3,
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
                        </Box>

                        <TextField
                            label="Add a note"
                            fullWidth
                            multiline
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            sx={{mb: 3}}
                            InputProps={{sx: {borderRadius: 4}}}
                        />

                        <BetterTogetherComponent
                            betterTogether={crossSellItems}
                            selectedItems={crossSellMap}
                            increaseQuantityOnCrossSell={increaseQuantityOnCrossSell}
                            decreaseQuantityOnCrossSell={decreaseQuantityOnCrossSell}
                        />

                        <Box>
                            <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, px: 0.2}}>
                                About
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
                                {menuItem.description}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
                <Box
                    sx={{
                        borderTop: "1px solid #eee",
                        p: 2,
                        backgroundColor: "#fff"
                    }}
                >
                    <Button
                        variant="contained"
                        fullWidth
                        onClick={handleAdd}
                        sx={{
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "18px",
                            fontWeight: "bold",
                            borderRadius: 8,
                            py: 1.5,
                            "&:hover": {
                                backgroundColor: "#d23f40"
                            }
                        }}
                    >
                        Add · {getFinalPriceOnPopup()} BHD
                    </Button>
                </Box>
            </Box>
        </Modal>
    )
}