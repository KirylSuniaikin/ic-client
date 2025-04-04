import React, { useEffect, useState } from "react";
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

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

function PizzaPopup({
                        open,
                        onClose,
                        sameItems,           // массив товаров с одинаковым именем для разных размеров
                        item,
                        extraIngredients = [],
                        onAddToCart
                    }) {
    const [selectedSize, setSelectedSize] = useState("Medium");
    const [selectedDough, setSelectedDough] = useState("Traditional");
    const [selectedCrust, setSelectedCrust] = useState("Classic Crust");
    const [quantity, setQuantity] = useState(1);
    const [selectedIngr, setSelectedIngr] = useState([]);

    // При открытии попапа сбрасываем настройки
    useEffect(() => {
        if (open && item) {
            setSelectedSize("Medium"); // По умолчанию Medium
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

    if (!item) return null;

    const matched = sameItems ? sameItems.find(it => it.size === selectedSize) : null;
    const basePrice = matched ? matched.price : (item.sizes?.[selectedSize] || item.price || 0);

    const ingrsForSize = extraIngredients.filter(ing => ing.size === selectedSize);

    const extraCost = selectedIngr.reduce((sum, ingrName) => {
        const found = ingrsForSize.find(i => i.name === ingrName);
        return found ? sum + found.price : sum;
    }, 0);

    const finalPricePerItem = (basePrice + extraCost);

    // Тогл ингредиента
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

        const product = {
            ...item,
            name: item.name,
            size: selectedSize,
            category: item.category,
            isThinDough: isThinDoughVal,
            isGarlicCrust: isGarlicCrustVal,
            quantity,
            description: getDesc(),
            pricePerItem: finalPricePerItem
        };
        console.log("basePrice", basePrice);
        console.log("pricePerItem", finalPricePerItem);
        onAddToCart?.(product);
        onClose?.();
    }

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: { xs: "90%", md: 400 },
                    maxHeight: "95vh",
                    bgcolor: "#fff",
                    borderRadius: 4,
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

                <Box sx={{ flex: 1, overflowY: "auto" }}>
                    <Box sx={{ width: "100%", height: 350, overflow: "hidden" }}>
                        <img
                            src={item.photo}
                            alt={item.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    </Box>

                    <Box
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            px: { xs: 2, md: 3 },
                            pt: 2,
                            pb: 2
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
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

                        <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                            Add additional ingredients
                        </Typography>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: 2,
                                mb: 2
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
                                                style={{ width: "100%", height: 60, objectFit: "contain" }}
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
                                        <Typography variant="body2" sx={{ fontWeight: "bold", mt: 1 }}>
                                            {ing.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
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
                        Add to cart · {(finalPricePerItem * quantity).toFixed(2)}
                    </Button>
                </Box>
            </Box>
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

            {/* DOUGH: скрываем, если выбран "Small" */}
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
                <Box sx={{ minWidth: 30, textAlign: "center", fontSize: "15px", color: "#666" }}>
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