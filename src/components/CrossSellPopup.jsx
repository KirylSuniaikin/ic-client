import {Box, Button, Modal, Typography} from "@mui/material";
import {useEffect, useState} from "react";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

function CrossSellPopup({
                            open,
                            onClose,
                            onAddToCart,
                            crossSellItems = [],
                            onCheckout
                        }) {
    const [crossSellMap, setSelectedCrossSellItems] = useState({});


    useEffect( () => {
        console.log(crossSellItems)
    },[])

    function increaseQuantityOnCrossSell(name) {
        setSelectedCrossSellItems(prev => ({
            ...prev,
            [name]: (prev[name] || 0) + 1
        }));
    }

    function decreaseQuantityOnCrossSell(name) {
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
        const products = []
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
                });
            }
        }))
        onAddToCart?.(products);
        onCheckout?.();
        onClose?.();
    }


    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "9%",
                    width: {xs: "100%", md: 400},
                    maxHeight: "91vh",
                    bgcolor: "#fff",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    bottom: 0
                }}
            >
                <Typography
                    variant="subtitle1"
                    sx={{
                        fontWeight: "bold",
                        mb: 1,
                        pt: 2,
                        pl: 2
                    }}
                >
                    Customers also buy
                </Typography>
                {/* Cross-sell rows */}
                {[0, 1].map((rowIndex) => {
                    const items = crossSellItems.slice(rowIndex * 3, (rowIndex + 1) * 3);
                    return (
                        <Box
                            key={rowIndex}
                            sx={{
                                display: "flex",
                                overflowX: "auto",
                                gap: 1,
                                mb: 1,
                                px: 1,
                                "&::-webkit-scrollbar": { display: "none" },
                                scrollbarWidth: "none"
                            }}
                        >
                            {items.map((item) => {
                                console.log(item.name)
                                const active = crossSellMap[item.name] != null;
                                return (
                                    <Box
                                        key={item.name}
                                        onClick={() => {
                                            if (!active) increaseQuantityOnCrossSell(item.name);
                                        }}
                                        sx={{
                                            minWidth: 100,
                                            flexShrink: 0,
                                            textAlign: "center",
                                            p: 2,
                                            mb: 1,
                                            mt: 1,
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
                                                alt={item.name}
                                                style={{ width: "100%", height: 120, objectFit: "contain" }}
                                            />
                                        ) : (
                                            <Box sx={{ width: "100%", height: 60, backgroundColor: "#f3f3f3" }} />
                                        )}
                                        <Typography variant="body2" sx={{ fontWeight: "bold", mt: 1 }}>
                                            {item.name}
                                        </Typography>
                                        {!active && (
                                            <Typography variant="body2" sx={{ mt: 1.2 }}>
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
                                                    height: 30,
                                                    mt: 1.1,
                                                    maxWidth: "130px",
                                                    mx: "auto"
                                                }}
                                            >
                                                <Button onClick={() => decreaseQuantityOnCrossSell(item.name)} sx={{ minWidth: 36, height: 26 }}>–</Button>
                                                <Box sx={{ minWidth: 22, textAlign: "center" }}>{crossSellMap[item.name]}</Box>
                                                <Button onClick={() => increaseQuantityOnCrossSell(item.name)} sx={{ minWidth: 36, height: 26 }}>+</Button>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    );
                })}
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
                            // width: 160,
                            textTransform: "none",
                            fontSize: "16px",
                            borderRadius: 4,
                            "&:hover": {
                                backgroundColor: "#d23f40"
                            }
                        }}
                        onClick={handleAdd}
                    >
                        Next
                    </Button>
                </Box>
            </Box>
        </Modal>
    )
}

export default CrossSellPopup;