import {CartItem, ComboItem, Group, MenuItem, MiniPizza} from "../management/types/menuTypes";
import React, {useEffect, useMemo, useState} from "react";
import {
    Box,
    Button,
    Fab,
    Grid,
    IconButton,
    Modal,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";

type Props = {
    open: boolean;
    onClose: () => void;
    onAddToCart: (cartItem: CartItem) => void;
    group: Group;
}

const MiniPizaOptions: string[] = [
    "Margherita",
    "Pepperoni",
    "Smoked Turkey & Mushroom",
    "Vegetarian",
    "Chicken",
    "Zaatar with Labneh",
]

const SIZE_LIMITS: Record<string, number> = {
    "S": 6,
    "L": 12,
};

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

export default function RamadanPopup({open, group, onAddToCart, onClose}: Props) {
    const [selectedMiniPizzas, setSelectedMiniPizzas] = useState<MiniPizza[]>([]);
    const [note, setNote] = useState("");
    const [selectedItem, setSelectedItem] = useState<MenuItem>(group[0]);
    const [selectedSize, setSelectedSize] = useState<string>("");
    const [availableSizes, setAvailableSizes] = useState<string[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        console.log(group)
        if (open && group.items.length > 0) {
            const sizes = Array.from(new Set(group.items.map((i) => i.size)));
            const order = ["S", "L"];
            const sortedSizes = order.filter((size) => sizes.includes(size));
            setAvailableSizes(sortedSizes);

            const defaultItem = group.items.find(i => i.size === "S") || group.items[0];
            setSelectedItem(defaultItem);
            setSelectedSize(defaultItem.size);

            setCounts({});
            setNote("");
            setQuantity(1);
        }
    }, [open, group]);

    useEffect(() => {
        const item = group.items.find((i) => i.size === selectedSize);
        if (item) {
            setSelectedItem(null)
            setSelectedItem(item);
            setCounts({});

        }
    }, [selectedSize, group]);


    const currentLimit = SIZE_LIMITS[selectedSize] || 6;

    const totalSelected = useMemo(() => {
        return Object.values(counts).reduce((acc, curr) => acc + curr, 0);
    }, [counts]);

    const handleIncrement = (pizzaName: string) => {
        if (totalSelected < currentLimit) {
            setCounts((prev) => ({
                ...prev,
                [pizzaName]: (prev[pizzaName] || 0) + 1,
            }));
        }
    };

    const handleDecrement = (pizzaName: string) => {
        if (counts[pizzaName] > 0) {
            setCounts((prev) => {
                const newCounts = { ...prev };
                newCounts[pizzaName] -= 1;
                if (newCounts[pizzaName] === 0) delete newCounts[pizzaName];
                return newCounts;
            });
        }
    };


    const generateDescription = () => {
        const parts = Object.entries(counts)
            .filter(([_, qty]) => qty > 0)
            .map(([name, qty]) => `${name} x${qty}`);

        let desc = parts.join(", ");
        if (note) desc += ` (Note: ${note})`;
        return desc;
    };

    const handleAddToCart = () => {
        console.log(selectedItem)
        if (!selectedItem) return;
        if (totalSelected !== currentLimit) return; // Защита

        const description = generateDescription();

        const comboItems: ComboItem[] = Object.entries(counts).map(([name, qty]) => ({
            name: name,
            category: "Mini Pizza",
            size: "Mini",
            isThinDough: false,
            isGarlicCrust: false,
            description: "",
            quantity: qty
        }));

        const cartItem: CartItem = {
            name: selectedItem.name,
            size: selectedSize,
            category: selectedItem.category,
            isThinDough: false,
            isGarlicCrust: false,
            extraIngredients: [],
            toppings: [],
            photo: selectedItem.photo,
            note: note,
            quantity: quantity,
            description: description,
            amount: selectedItem.price,
            discount_amount: 0,
            comboItems: comboItems
        };

        onAddToCart(cartItem);
        onClose();
    };

    if (!selectedItem) return null;

    const isComplete = totalSelected === currentLimit;
    const remaining = currentLimit - totalSelected;

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: { xs: "0%", md: "3%" },
                    bottom: { xs: "0%", md: "unset" },
                    left: { xs: "0%", md: "50%" },
                    transform: { md: "translate(-50%, 0)" },
                    width: { xs: "100%", md: 500 },
                    maxHeight: { xs: "100%", md: "90vh" },
                    bgcolor: "#fff",
                    borderRadius: { xs: 0, md: 4 },
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: 24,
                    overflow: "hidden",
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
                        zIndex: 10,
                    }}
                >
                    <CloseIcon />
                </Fab>

                <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

                    <Box sx={{ width: "100%", height: 250, overflow: "hidden" }}>
                        <img
                            src={selectedItem.photo || "/placeholder_pizza.jpg"}
                            alt={selectedItem.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    </Box>

                    <Box sx={{ p: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 1, textAlign: "center" }}>
                            {selectedItem.name}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 3 }}>
                            {selectedItem.description}
                        </Typography>

                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
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
                                    sx={{ minWidth: 34, color: "#666", borderRadius: "50%" }}
                                >
                                    –
                                </Button>
                                <Box sx={{ minWidth: 30, textAlign: "center", fontWeight: "bold" }}>
                                    {quantity}
                                </Box>
                                <Button
                                    onClick={() => setQuantity((q) => q + 1)}
                                    sx={{ minWidth: 34, color: "#666", borderRadius: "50%" }}
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
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            sx={{ mb: 3 }}
                            InputProps={{ sx: { borderRadius: 4 } }}
                        />

                        <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                                Choose your flavors
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: isComplete ? "green" : brandRed,
                                    fontWeight: "bold",
                                    bgcolor: isComplete ? "#e8f5e9" : "#ffebee",
                                    px: 1, py: 0.5, borderRadius: 2
                                }}
                            >
                                {isComplete ? "Completed!" : `Select ${remaining} more`}
                            </Typography>
                        </Box>

                        {/* Список мини пицц */}
                        <Grid container spacing={2}>
                            {MiniPizaOptions.map((name) => {
                                const count = counts[name] || 0;
                                return (
                                    <Grid size={{xs: 12}}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                p: 1.5,
                                                borderRadius: 3,
                                                border: "1px solid #eee",
                                                bgcolor: count > 0 ? "#fff5f5" : "#fff",
                                            }}
                                        >
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {name}
                                            </Typography>

                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    bgcolor: brandGray,
                                                    borderRadius: 4,
                                                }}
                                            >
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDecrement(name)}
                                                    disabled={count === 0}
                                                    sx={{ color: brandRed }}
                                                >
                                                    <RemoveIcon fontSize="small" />
                                                </IconButton>

                                                <Typography sx={{ mx: 1.5, minWidth: 16, textAlign: "center", fontWeight: "bold" }}>
                                                    {count}
                                                </Typography>

                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleIncrement(name)}
                                                    disabled={totalSelected >= currentLimit}
                                                    sx={{ color: totalSelected >= currentLimit ? "gray" : brandRed }}
                                                >
                                                    <AddIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>

                    </Box>
                </Box>

                <Box
                    sx={{
                        borderTop: "1px solid #eee",
                        display: "flex",
                        gap: 2,
                        p: 2,
                        bgcolor: "#fff"
                    }}
                >
                    {availableSizes.length > 1 && (
                        <ToggleButtonGroup
                            exclusive
                            value={selectedSize}
                            onChange={(e, val) => val && setSelectedSize(val)}
                            sx={{
                                backgroundColor: brandGray,
                                borderRadius: 8,
                                p: "4px",
                                height: 50,
                                "& .MuiToggleButtonGroup-grouped": {
                                    border: 0,
                                    borderRadius: 8,
                                    px: 3,
                                    "&:not(:last-of-type)": { borderRight: "none" }
                                }
                            }}
                        >
                            {availableSizes.map((size) => (
                                <ToggleButton
                                    key={size}
                                    value={size}
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: "bold",
                                        color: "#666",
                                        "&.Mui-selected": {
                                            bgcolor: "#fff",
                                            color: brandRed,
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                            "&:hover": { bgcolor: "#fff" }
                                        }
                                    }}
                                >
                                    {size === "S" ? "6 Pcs" : "12 Pcs"}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    )}

                    <Button
                        variant="contained"
                        fullWidth
                        disabled={!isComplete}
                        onClick={handleAddToCart}
                        sx={{
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "18px",
                            fontWeight: "bold",
                            borderRadius: 8,
                            height: 50,
                            flex: 1,
                            "&:hover": { backgroundColor: "#d23f40" },
                            "&.Mui-disabled": { backgroundColor: "#ffcdd2", color: "#fff" }
                        }}
                    >
                        {`Add · ${(selectedItem.price * quantity).toFixed(2)}`}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}