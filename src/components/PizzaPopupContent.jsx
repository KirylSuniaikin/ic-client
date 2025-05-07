import React, {useEffect, useState} from "react";
import {
    Modal,
    Box,
    Typography,
    Fab,
    Button,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { motion } from "framer-motion";


const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

function PizzaPopup({
                        open,
                        onClose,
                        sameItems,
                        item,
                        extraIngredients = [],
                        onAddToCart,
                        crossSellItems = [],
                    }) {
    const [selectedSize, setSelectedSize] = useState("Medium");
    const [selectedDough, setSelectedDough] = useState("Traditional");
    const [selectedCrust, setSelectedCrust] = useState("Classic Crust");
    const [quantity, setQuantity] = useState(1);
    const [selectedIngr, setSelectedIngr] = useState([]);
    const [crossSellMap, setSelectedCrossSellItems] = useState({});

    useEffect(() => {
        if (open && item) {
            setSelectedSize("Medium");
            setSelectedDough("Traditional");
            setSelectedCrust("Classic Crust");
            setQuantity(1);
            setSelectedIngr([]);
        }
    }, [open, item]);

    useEffect(() => {
        if (selectedSize === "Small") {
            setSelectedDough("Traditional");
        }
    }, [selectedSize]);


    // const dropIn = {
    //     hidden: { y: "100%", opacity: 0 },
    //     visible: { y: 0, opacity: 1, transition: { duration: 0.3 } },
    //     exit: { y: "100%", opacity: 0, transition: { duration: 0.2 } }
    // };

    if (!item) return null;

    const matched = sameItems ? sameItems.find(it => it.size === selectedSize) : null;
    const basePrice = matched ? matched.price : (item.sizes?.[selectedSize] || item.price || 0);

    const ingrsForSize = extraIngredients.filter(ing => ing.size === selectedSize);

    const extraCost = selectedIngr.reduce((sum, ingrName) => {
        const found = ingrsForSize.find(i => i.name === ingrName);
        return found ? sum + found.price : sum;
    }, 0);

    const finalPizzaPricePerItem = (basePrice + extraCost);

    function getFinalPriceOnPopup() {
        let price = 0;
        crossSellItems.forEach((item => {
            const count = crossSellMap[item.name];
            if (count) {
                price += item.price * count;
            }
        }))
        return (finalPizzaPricePerItem * quantity + price).toFixed(2);
    }

    function handleToggleIngr(name) {
        if (selectedIngr.includes(name)) {
            setSelectedIngr(prev => prev.filter(x => x !== name));
        } else {
            setSelectedIngr(prev => [...prev, name]);
        }
    }

    function getDesc() {
        let parts = [];

        if (selectedDough !== "Traditional") {
            parts.push(`+${selectedDough}`);
        }

        if (selectedCrust !== "Classic Crust") {
            parts.push(`+${selectedCrust}`);
        }

        if (selectedIngr && selectedIngr.length > 0) {
            const extra = selectedIngr.map(ingr => `+${ingr}`).join(" ");
            parts.push(`(${extra})`);
        }

        return parts.join(" ");
    }

    function handleAdd() {
        let isThinDoughVal = selectedDough !== "Traditional";
        let isGarlicCrustVal = selectedCrust !== "Classic Crust";

        const products = [{
            ...item,
            name: item.name,
            size: selectedSize,
            category: item.category,
            isThinDough: isThinDoughVal,
            isGarlicCrust: isGarlicCrustVal,
            quantity,
            description: getDesc(),
            amount: finalPizzaPricePerItem
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
        onAddToCart?.(products);
        onClose?.();
    }

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

    return (
        <Modal open={open} onClose={onClose}>
            {/*<motion.div*/}
            {/*    variants={dropIn}*/}
            {/*    initial="hidden"*/}
            {/*    animate="visible"*/}
            {/*    exit="exit"*/}
            {/*    style={{*/}
            {/*        position: "absolute",*/}
            {/*        left: "50%",*/}
            {/*        bottom: 0,*/}
            {/*        transform: "translateX(-50%)",*/}
            {/*        width: "100%",*/}
            {/*        maxWidth: 400*/}
            {/*    }}*/}
            {/*>*/}
                <Box
                    sx={{
                        position: "absolute",
                        top: "3%",
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
                        <Box sx={{width: "100%", height: 350, overflow: "hidden"}}>
                            <img
                                src={item.photo}
                                alt={item.name}
                                style={{width: "100%", height: "100%", objectFit: "cover"}}
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
                            <Typography variant="h6" sx={{fontWeight: "bold", mb: 1}}>
                                {item.name}
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
                                {item.description}
                            </Typography>

                            <TogglesWithQuantity
                                selectedSize={selectedSize}
                                setSelectedSize={setSelectedSize}
                                selectedDough={selectedDough}
                                setSelectedDough={setSelectedDough}
                                selectedCrust={selectedCrust}
                                setSelectedCrust={setSelectedCrust}
                                quantity={quantity}
                                setQuantity={setQuantity}
                            />

                            <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1}}>
                                Better together
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
                                                    increaseQuantityOnCrossSell(item.name)
                                                }
                                            }
                                            }
                                            sx={{
                                                p: 2,
                                                textAlign: "center",
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
                                                    alt={item.name}
                                                    style={{width: "100%", height: 120, objectFit: "contain"}}
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
                                            <Typography variant="body2" sx={{fontWeight: "bold", mt: 1}}>
                                                {item.name}
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
                            <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1}}>
                                Customize as you like it
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    overflowX: "auto",
                                    gap: 1,
                                    mb: 2,
                                    py: 1,
                                    px: 1,
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
                                {ingrsForSize.map((ing) => {
                                    const active = selectedIngr.includes(ing.name);
                                    return (
                                        <Box
                                            key={ing.name}
                                            onClick={() => handleToggleIngr(ing.name)}
                                            sx={{
                                                p: 2,
                                                textAlign: "center",
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
                                            {ing.photo ? (
                                                <img
                                                    src={ing.photo}
                                                    alt={ing.name}
                                                    style={{width: "100%", height: 120, objectFit: "contain"}}
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
                                            <Typography variant="body2" sx={{fontWeight: "bold", mt: 1}}>
                                                {ing.name}
                                            </Typography>
                                            <Typography variant="body2" sx={{mt: 0.5}}>
                                                +{ing.price}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
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
                            Add · {getFinalPriceOnPopup()}
                        </Button>
                    </Box>

                </Box>
            {/*</motion.div>*/}
        </Modal>
);
}

function TogglesWithQuantity({
    selectedSize,
        setSelectedSize,
        selectedDough,
        setSelectedDough,
        selectedCrust,
                                 setSelectedCrust,
                                 quantity,
                                 setQuantity
                             }) {
    const groupSx = {
        backgroundColor: brandGray,
        borderRadius: "9999px",
        p: "4px",
        mb: 2,
        width: "100%",
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
        <Box sx={{ textAlign: "center" }}>
            {/* SIZE */}
            <ToggleButtonGroup
                exclusive
                value={selectedSize}
                onChange={(e, val) => val && setSelectedSize(val)}
                sx={groupSx}
                fullWidth
            >
                {["Small", "Medium", "Large"].map((label) => (
                    <ToggleButton key={label} value={label} sx={toggleBtnSx}>
                        {label}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {selectedSize !== "Small" && (
                <ToggleButtonGroup
                    exclusive
                    value={selectedDough}
                    onChange={(e, val) => val && setSelectedDough(val)}
                    sx={groupSx}
                    fullWidth
                >
                    {["Traditional", "Thin"].map((label) => (
                        <ToggleButton key={label} value={label} sx={toggleBtnSx}>
                            {label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            )}

            {/* CRUST */}
            <ToggleButtonGroup
                exclusive
                value={selectedCrust}
                onChange={(e, val) => val && setSelectedCrust(val)}
                sx={groupSx}
                fullWidth
            >
                {["Classic Crust", "Garlic Crust"].map((label) => (
                    <ToggleButton key={label} value={label} sx={toggleBtnSx}>
                        {label}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {/* QUANTITY */}
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
                <Box sx={{minWidth: 30, textAlign: "center", fontSize: "15px", color: "#666"}}>
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
        </Box>
    );
}

export default PizzaPopup;