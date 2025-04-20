import React, { useEffect, useState } from "react";
import {
    Modal,
    Box,
    Typography,
    Fab,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    Checkbox,
    FormControlLabel
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

function ComboPopup({
                        open,
                        onClose,
                        item,
                        sameItems,          // массив товаров с тем же названием, но разными размерами
                        uniquePizzas = [],
                        onAddToCart
                    }) {
    const [selectedSize, setSelectedSize] = useState("Medium");
    const [selectedPizzas, setSelectedPizzas] = useState([]);

    useEffect(() => {
        if (open && item) {
            setSelectedSize("Medium");
            setSelectedPizzas([]);
        }
    }, [open, item]);

    if (!item) return null;


    const matched = sameItems
        ? sameItems.find((it) => it.size === selectedSize)
        : null;
    const basePrice = matched
        ? matched.price
        : item.sizes?.[selectedSize] || item.price || 0;

    const canAdd = selectedPizzas.length === 2;

    function handleCheckPizza(pizzaName, isChecked) {
        const idx = selectedPizzas.findIndex((p) => p.name === pizzaName);
        if (isChecked) {
            if (selectedPizzas.length >= 2) {
                return false;
            }
            setSelectedPizzas((prev) => [
                ...prev,
                { name: pizzaName, dough: "Traditional", crust: "Classic Crust" },
            ]);
        } else {
            // Снимают чек
            if (idx >= 0) {
                const newArr = [...selectedPizzas];
                newArr.splice(idx, 1);
                setSelectedPizzas(newArr);
            }
        }
        return true;
    }

    function setPizzaDough(pizzaName, newDough) {
        setSelectedPizzas((prev) =>
            prev.map((p) =>
                p.name === pizzaName ? { ...p, dough: newDough } : p
            )
        );
    }
    function setPizzaCrust(pizzaName, newCrust) {
        setSelectedPizzas((prev) =>
            prev.map((p) =>
                p.name === pizzaName ? { ...p, crust: newCrust } : p
            )
        );
    }

    // Формируем описание (desc) комбо
    function getDescForCombo() {
        return selectedPizzas
            .map((p) => {
                let parts = [p.name];
                if (p.crust && p.crust !== "Classic Crust") {
                    parts.push(`+${p.crust}`);
                }
                if (p.dough && p.dough !== "Traditional") {
                    parts.push(`+${p.dough}`);
                }
                return parts.join(" ");
            })
            .join("; ");
    }

    function handleAddToCart() {
        if (!canAdd) return;

        const product = {
            name: item.name,
            size: selectedSize,
            category: item.category,
            photo: item.photo,
            quantity: 1,
            description: getDescForCombo(),
            amount: basePrice,
        };
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
                    flexDirection: "column",
                }}
            >
                {/* Кнопка закрытия */}
                <Fab
                    size="small"
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        color: brandRed,
                        backgroundColor: "#fff",
                        zIndex: 9999,
                    }}
                >
                    <CloseIcon />
                </Fab>

                <Box sx={{ flex: 1, overflowY: "auto" }}>
                    {/* Изображение */}
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
                            pb: 2,
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                            {item.name}
                        </Typography>

                        {/* Выбор размера (Medium / Large) */}
                        <ToggleButtonGroup
                            exclusive
                            value={selectedSize}
                            onChange={(e, val) => val && setSelectedSize(val)}
                            sx={{
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
                                        borderRight: "none",
                                    },
                                },
                            }}
                            fullWidth
                        >
                            {["Medium", "Large"].map((val) => (
                                <ToggleButton
                                    key={val}
                                    value={val}
                                    sx={{
                                        textTransform: "none",
                                        fontSize: "14px",
                                        justifyContent: "center",
                                        color: "#666",
                                        borderRadius: "9999px",
                                        height: 34,
                                        "&:hover": {
                                            backgroundColor: "transparent",
                                        },
                                        "&.Mui-selected": {
                                            backgroundColor: "#fff",
                                            color: brandRed,
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                                            "&:hover": {
                                                backgroundColor: "#fff",
                                            },
                                        },
                                    }}
                                >
                                    {val}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>

                        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
                            Pick 2 Pizzas
                        </Typography>
                        {uniquePizzas.map((pizza) => {
                            const idx = selectedPizzas.findIndex(
                                (sp) => sp.name === pizza.name
                            );
                            const isSelected = idx >= 0;

                            return (
                                <Box
                                    key={pizza.name}
                                    sx={{
                                        p: 2,
                                        mb: 2,
                                        borderRadius: 3,
                                        boxShadow: isSelected
                                            ? `0 0 0 2px ${brandRed}`
                                            : "0 1px 3px rgba(0,0,0,0.15)",
                                    }}
                                >
                                    <FormControlLabel
                                        label={
                                            <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                                                {pizza.name}
                                            </Typography>
                                        }
                                        control={
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    const ok = handleCheckPizza(pizza.name, e.target.checked);
                                                    if (!ok) {
                                                        e.target.checked = false;
                                                    }
                                                }}
                                                sx={{
                                                    color: brandRed,
                                                    "&.Mui-checked": { color: brandRed },
                                                }}
                                            />
                                        }
                                    />

                                    {/* Если выбрано, показываем Dough/Crust */}
                                    {isSelected && (
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: "bold", mt: 1 }}>
                                                Dough
                                            </Typography>
                                            <ToggleButtonGroup
                                                exclusive
                                                value={selectedPizzas[idx].dough}
                                                onChange={(e, val) => {
                                                    if (val) {
                                                        setPizzaDough(pizza.name, val);
                                                    }
                                                }}
                                                sx={{
                                                    backgroundColor: brandGray,
                                                    borderRadius: "9999px",
                                                    p: "4px",
                                                    mb: 1,
                                                    "& .MuiToggleButtonGroup-grouped": {
                                                        border: 0,
                                                        flex: 1,
                                                        borderRadius: "9999px",
                                                        mr: "4px",
                                                        "&:not(:last-of-type)": { borderRight: "none" },
                                                    },
                                                }}
                                                fullWidth
                                            >
                                                {["Traditional", "Thin"].map((dough) => (
                                                    <ToggleButton
                                                        key={dough}
                                                        value={dough}
                                                        sx={{
                                                            textTransform: "none",
                                                            fontSize: "13px",
                                                            justifyContent: "center",
                                                            color: "#666",
                                                            borderRadius: "9999px",
                                                            height: 30,
                                                            "&:hover": {
                                                                backgroundColor: "transparent",
                                                            },
                                                            "&.Mui-selected": {
                                                                backgroundColor: "#fff",
                                                                color: brandRed,
                                                                boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                                                                "&:hover": {
                                                                    backgroundColor: "#fff",
                                                                },
                                                            },
                                                        }}
                                                    >
                                                        {dough}
                                                    </ToggleButton>
                                                ))}
                                            </ToggleButtonGroup>

                                            <Typography variant="body2" sx={{ fontWeight: "bold", mt: 1 }}>
                                                Crust
                                            </Typography>
                                            <ToggleButtonGroup
                                                exclusive
                                                value={selectedPizzas[idx].crust}
                                                onChange={(e, val) => {
                                                    if (val) {
                                                        setPizzaCrust(pizza.name, val);
                                                    }
                                                }}
                                                sx={{
                                                    backgroundColor: brandGray,
                                                    borderRadius: "9999px",
                                                    p: "4px",
                                                    mb: 1,
                                                    "& .MuiToggleButtonGroup-grouped": {
                                                        border: 0,
                                                        flex: 1,
                                                        borderRadius: "9999px",
                                                        mr: "4px",
                                                        "&:not(:last-of-type)": { borderRight: "none" },
                                                    },
                                                }}
                                                fullWidth
                                            >
                                                {["Classic Crust", "Garlic Crust"].map((crust) => (
                                                    <ToggleButton
                                                        key={crust}
                                                        value={crust}
                                                        sx={{
                                                            textTransform: "none",
                                                            fontSize: "13px",
                                                            justifyContent: "center",
                                                            color: "#666",
                                                            borderRadius: "9999px",
                                                            height: 30,
                                                            "&:hover": {
                                                                backgroundColor: "transparent",
                                                            },
                                                            "&.Mui-selected": {
                                                                backgroundColor: "#fff",
                                                                color: brandRed,
                                                                boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                                                                "&:hover": {
                                                                    backgroundColor: "#fff",
                                                                },
                                                            },
                                                        }}
                                                    >
                                                        {crust}
                                                    </ToggleButton>
                                                ))}
                                            </ToggleButtonGroup>
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                {/* Нижняя часть: цена + кнопка Add to cart */}
                <Box sx={{ borderTop: "1px solid #eee", p: 2 }}>
                    <Button
                        variant="contained"
                        fullWidth
                        disabled={!canAdd}
                        sx={{
                            backgroundColor: canAdd ? brandRed : "#ccc",
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "16px",
                            borderRadius: 4,
                            "&:hover": {
                                backgroundColor: canAdd ? "#d23f40" : "#ccc",
                            },
                        }}
                        onClick={handleAddToCart}
                    >
                        Add to cart · {basePrice.toFixed(2)} BHD
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default ComboPopup;