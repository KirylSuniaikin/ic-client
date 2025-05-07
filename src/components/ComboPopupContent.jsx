import React, {useEffect, useState} from "react";
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
                        sameItems,
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

    const matched = sameItems?.find((it) => it.size === selectedSize);
    const basePrice = matched?.price || item?.sizes?.[selectedSize] || item?.price || 0;

    function handleTogglePizza(pizzaName, checked) {
        const exists = selectedPizzas.filter(p => p.name === pizzaName);
        if (checked) {
            if (exists.length >= 2) return; // max 2
            setSelectedPizzas(prev => [...prev, {
                name: pizzaName,
                dough: "Traditional",
                crust: "Classic Crust"
            }]);
        } else {
            setSelectedPizzas(prev => prev.filter(p => p.name !== pizzaName));
        }
    }

    function updatePizzaConfig(pizzaName, index, key, value) {
        setSelectedPizzas(prev =>
            prev.map((p, i) =>
                p.name === pizzaName && prev.filter(pp => pp.name === pizzaName).indexOf(p) === index
                    ? {...p, [key]: value}
                    : p
            )
        );
    }

    function handleQuantityChange(pizzaName, delta) {
        setSelectedPizzas(prev => {
            const samePizzas = prev.filter(p => p.name === pizzaName);
            if (delta === 1 && samePizzas.length < 2) {
                return [...prev, {
                    name: pizzaName,
                    dough: "Traditional",
                    crust: "Classic Crust"
                }];
            }
            if (delta === -1 && samePizzas.length > 0) {
                const indexToRemove = prev.findIndex((p, i) => p.name === pizzaName && i === prev.indexOf(samePizzas.at(-1)));
                return [...prev.slice(0, indexToRemove), ...prev.slice(indexToRemove + 1)];
            }
            return prev;
        });
    }

    const groupedPizzas = uniquePizzas.map(pizza => {
        const configs = selectedPizzas.filter(p => p.name === pizza.name);
        return {pizza, configs};
    });

    const canAdd = selectedPizzas.length === 2;

    function getDescription() {
        return selectedPizzas.map(p => {
            const parts = [p.name];
            if (p.crust !== "Classic Crust") parts.push(`+${p.crust}`);
            if (p.dough !== "Traditional") parts.push(`+${p.dough}`);
            return parts.join(" ");
        }).join("; ");
    }

    function handleAdd() {
        if (!canAdd) return;
        onAddToCart?.({
            name: item.name,
            size: selectedSize,
            category: item.category,
            photo: item.photo,
            quantity: 1,
            description: getDescription(),
            amount: basePrice
        });
        onClose?.();
    }

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
        <Modal open={open} onClose={onClose}>
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
                        <Typography variant="h6" sx={{fontWeight: "bold", mb: 2}}>
                            {item.name}
                        </Typography>

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

                        <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1}}>
                            Pick 2 Pizzas
                        </Typography>

                        {groupedPizzas.map(({pizza, configs}) => {
                            const isSelected = configs.length > 0;
                            return (
                                <Box key={pizza.name} sx={{
                                    p: 2, mb: 2, borderRadius: 3,
                                    boxShadow: isSelected
                                        ? `0 0 0 2px ${brandRed}`
                                        : "0 1px 3px rgba(0,0,0,0.15)"
                                }}>
                                    <FormControlLabel
                                        label={<Typography sx={{fontWeight: "bold"}}>{pizza.name}</Typography>}
                                        control={<Checkbox
                                            checked={isSelected}
                                            onChange={(e) => handleTogglePizza(pizza.name, e.target.checked)}
                                            sx={{color: brandRed, "&.Mui-checked": {color: brandRed}}}
                                        />}
                                    />

                                    {isSelected && (
                                        <>
                                            {/* Quantity */}
                                            <Box sx={{
                                                backgroundColor: brandGray,
                                                borderRadius: "9999px",
                                                p: "4px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "4px",
                                                height: 30,
                                                mt: 1,
                                                mb: 2,
                                                maxWidth: "130px"
                                            }}>
                                                <Button onClick={() => handleQuantityChange(pizza.name, -1)}
                                                        sx={{minWidth: 36, color: "#666",}}>–</Button>
                                                <Box sx={{minWidth: 22, textAlign: "center"}}>
                                                    {configs.length}
                                                </Box>
                                                <Button onClick={() => handleQuantityChange(pizza.name, 1)}
                                                        sx={{minWidth: 36, color: "#666"}}>+</Button>
                                            </Box>

                                            {configs.map((p, i) => (
                                                <Box key={i} sx={{ mb: 2 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                                        Pizza #{i + 1}
                                                    </Typography>

                                                    {/* Dough */}
                                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                                        Dough
                                                    </Typography>
                                                    <ToggleButtonGroup
                                                        exclusive
                                                        value={p.dough}
                                                        onChange={(e, val) => val && updatePizzaConfig(p.name, i, "dough", val)}
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

                                                    {/* Crust */}
                                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                                        Crust
                                                    </Typography>
                                                    <ToggleButtonGroup
                                                        exclusive
                                                        value={p.crust}
                                                        onChange={(e, val) => val && updatePizzaConfig(p.name, i, "crust", val)}
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
                                            ))}
                                        </>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                <Box sx={{borderTop: "1px solid #eee", p: 2}}>
                    <Button
                        variant="contained"
                        fullWidth
                        disabled={!canAdd}
                        sx={{
                            backgroundColor: canAdd ? brandRed : "#ccc",
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "16px",
                            borderRadius: 4
                        }}
                        onClick={handleAdd}
                    >
                        Add · {basePrice.toFixed(2)}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default ComboPopup;