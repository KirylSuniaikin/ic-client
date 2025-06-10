import React, {useEffect, useState} from "react";
import {
    Modal,
    Box,
    Typography,
    Fab,
    Button,
    ToggleButton,
    ToggleButtonGroup, InputAdornment, TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import * as PropTypes from "prop-types";
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';


const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

function RoundedTextField(props) {
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

function PizzaPopup({
                        open,
                        onClose,
                        sameItems,
                        item,
                        extraIngredients = [],
                        onAddToCart,
                        crossSellItems = [],
                    }) {
    const [selectedSize, setSelectedSize] = useState("M");
    const [selectedDough, setSelectedDough] = useState("Traditional");
    const [quantity, setQuantity] = useState(1);
    const [selectedIngr, setSelectedIngr] = useState([]);
    const [crossSellMap, setSelectedCrossSellItems] = useState({});
    const [note, setNote] = useState("");

    useEffect(() => {
        if (open && item) {
            setSelectedSize("M");
            setSelectedDough("Traditional");
            setQuantity(1);
            setSelectedIngr([]);
        }
        console.log(item.name)
    }, [open, item]);

    useEffect(() => {
        if (selectedSize === "S") {
            setSelectedDough("Traditional");
        }
    }, [selectedSize]);

    if (!item) return null;

    const getSelectedSize = () => {
        if (selectedSize === "L") return "Large"
        if (selectedSize === "M") return "Medium"
        if (selectedSize === "S") return "Small"
    }

    const matched = sameItems ? sameItems.find(it => it.size === getSelectedSize()) : null;
    const basePrice = matched ? matched.price : (item.sizes?.[getSelectedSize()] || item.price || 0);

    const ingrsForSize = extraIngredients.filter(ing => ing.size === getSelectedSize());

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

        if (selectedIngr && selectedIngr.length > 0) {
            const extra = selectedIngr.map(ingr => `+${ingr}`).join(" ");
            parts.push(`(${extra})`);
        }
        if (note !== "") parts.push(`+${note}`);
        return parts.join(" ");
    }

    function handleAdd() {
        let isThinDoughVal = selectedDough !== "Traditional";
        let isGarlicCrustVal = selectedIngr.includes("garlic crust");

        const products = [{
            ...item,
            name: item.name,
            size: getSelectedSize(),
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
                            <Typography variant="h6" sx={{fontWeight: "bold", mb: 3, textAlign: "center"}}>
                                {item.name}
                            </Typography>

                            <TogglesWithQuantity
                                selectedSize={selectedSize}
                                selectedDough={selectedDough}
                                setSelectedDough={setSelectedDough}
                                quantity={quantity}
                                setQuantity={setQuantity}
                            />

                            <TextField
                                label="Add a note"
                                fullWidth
                                multiline
                                rows={2}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                sx={{ mb: 3 }}
                                InputProps={{ sx: { borderRadius: 4 } }}
                            />

                            <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, px: 0.2}}>
                                Better together
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
                                                    alt={item.name}
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
                                                        borderRadius: 8,
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
                                                            borderRadius: 8,
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
                                                            borderRadius: 8,
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
                                    );
                                })}
                            </Box>
                            <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, px: 0.2}}>
                                Customize as you like it
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
                                    onClick={() => {handleToggleIngr("garlic crust");}}
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
                                        Garlic Crust
                                    </Typography>
                                    <Typography variant="body2" sx={{mt: 1.2}}>
                                        FREE
                                    </Typography>
                                </Box>
                                {item.name === "Margherita" && <Box
                                    key={"cherry"}
                                    onClick={() => {handleToggleIngr("cherry");}}
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
                                        Cherry
                                    </Typography>
                                    <Typography variant="body2" sx={{mt: 1.2}}>
                                        FREE
                                    </Typography>
                                </Box>
                                }
                                {ingrsForSize.map((ing) => {
                                    const active = selectedIngr.includes(ing.name);
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
                                            {ing.photo ? (
                                                <img
                                                    src={ing.photo}
                                                    alt={ing.name}
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
                                                {ing.name}
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                +{ing.price}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
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
                                {item.description}
                            </Typography>
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
                            {["S", "M", "L"].map((label) => (
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
                            Add · {getFinalPriceOnPopup()}
                        </Button>
                    </Box>
                </Box>
        </Modal>
);
}

function TogglesWithQuantity({
                                 selectedSize,
                                 selectedDough,
                                 setSelectedDough,
                                 quantity,
                                 setQuantity
                             }) {
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
                <Box sx={{ minWidth: 30, textAlign: "center", fontSize: "15px", color: "#666" }}>
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

            {selectedSize !== "S" && (
                <ToggleButtonGroup
                    exclusive
                    value={selectedDough}
                    onChange={(e, val) => val && setSelectedDough(val)}
                    sx={groupSx}
                >
                    {["Traditional", "Thin"].map((label) => (
                        <ToggleButton key={label} value={label} sx={toggleBtnSx}>
                            {label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            )}
        </Box>
    );
}

export default PizzaPopup;