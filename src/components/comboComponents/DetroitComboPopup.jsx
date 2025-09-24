import {
    Modal,
    Box,
    Typography,
    Button,
    ToggleButtonGroup,
    ToggleButton,
} from "@mui/material";
import React, { useState } from "react";
import ItemEditorPopup from "./ItemEditorPopup";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

export function DetroitComboPopup({
                                    open,
                                    onClose,
                                    combo,
                                    bricks,
                                    drinks,
                                    sauces,
                                    onAddToCart,
                                    selectedDetroitPizza,
                                }) {
    const [brick, setBrick] = useState(() => {
        const found = bricks
            .flatMap(b => b.items) // все айтемы в один массив
            .find(i => i.name === selectedDetroitPizza?.name);

        return { item: found || bricks[0].items[0] };
    });

    const [drink, setDrink] = useState({
        item: drinks[0].items[0],
    });

    const [sauce, setSauce] = useState({
        item: sauces[0].items[0],
    });

    const [editorOpen, setEditorOpen] = useState(false);
    const [editorItems, setEditorItems] = useState([]);
    const [editorTarget, setEditorTarget] = useState(null);

    if (!combo) return null;
    const comboGroup = combo.items?.[0] || combo[0] || {};
    const basePrice = comboGroup?.price || 0;

    function openEditor(target, items) {
        setEditorTarget(target);
        setEditorItems(items);
        setEditorOpen(true);
    }

    function handleEditorSave(updated) {
        if (editorTarget === "brick") setBrick(updated);
        if (editorTarget === "drink") setDrink(updated);
        if (editorTarget === "sauce") setSauce(updated);
    }

    function handleAdd() {
        if (!brick?.item || !drink?.item || !sauce?.item) return;

        const orderItem = {
            amount: basePrice,
            category: "Combo Deals",
            name: "Detroit Combo",
            description: "",
            discount_amount: 0,
            isGarlicCrust: false,
            isThinDough: false,
            photo: comboGroup.photo,
            quantity: 1,
            comboItems: [
                {
                    category: "Brick Pizzas",
                    name: brick.item.name,
                    isGarlicCrust: false,
                    isThinDough: false,
                    quantity: 1,
                },
                {
                    category: "Beverages",
                    name: drink.item.name,
                    size: "",
                    isGarlicCrust: false,
                    isThinDough: false,
                    quantity: 1,
                },
                {
                    category: "Sauces",
                    name: sauce.item.name,
                    size: "",
                    isGarlicCrust: false,
                    isThinDough: false,
                    quantity: 1,
                },
            ],
        };
        console.log(orderItem);

        onAddToCart?.(orderItem);
        onClose?.();
    }

    const ItemCard = ({ item, onChange, fixed }) => {
        if (!item) {
            return (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 2.5,
                        mb: 2,
                        bgcolor: "#fff",
                        borderRadius: 5,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        minHeight: 120,
                    }}
                >
                    <Typography color="text.secondary">No item available</Typography>
                </Box>
            );
        }
        return(
            <Box
                sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    p: 2.5,
                    mb: 2,
                    bgcolor: "#fff",
                    borderRadius: 5,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                    minHeight: 120,
                }}
            >
                <img
                    src={item.photo}
                    alt={item?.name}
                    style={{
                        width: 120,
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 12,
                    }}
                />
                <Box sx={{
                    ml: 2,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 120,
                }}>
                    <Box>
                        <Typography fontWeight="500" sx={{mb: 0.5}}>
                            {item?.name}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {item.description ? item.description : " "}
                        </Typography>
                    </Box>
                    {!fixed && (
                        <Button
                            variant="outlined"
                            size="small"
                            sx={{
                                color: brandRed,
                                backgroundColor: "#ffe5e6",
                                borderColor: "white",
                                textTransform: "none",
                                fontSize: "15px",
                                borderRadius: 8,
                                "&:hover": {backgroundColor: "#d23f40"},
                                alignSelf: "flex-start",
                            }}
                            onClick={onChange}
                        >
                            Change
                        </Button>
                    )}
                </Box>
            </Box>
        );
    };


    return (
        <>
            <Modal open={open} onClose={onClose}>
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        width: "100%",
                        maxHeight: "92vh",
                        bgcolor: "#fafafa",
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        boxShadow: "0 -4px 12px rgba(0,0,0,0.15)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Header with photo + title + description */}
                    <Box sx={{
                        flex: 1,
                        overflowY: "auto",
                        p: 2,
                        "&::-webkit-scrollbar": { display: "none" },
                    }}>
                        <Box sx={{ textAlign: "center", mb: 2 }}>
                            {comboGroup?.photo && (
                                <img
                                    src={comboGroup.photo}
                                    alt={comboGroup.name}
                                    style={{
                                        width: "100%",
                                        maxWidth: 320,
                                        height: 320,
                                        objectFit: "contain",
                                        margin: "0 auto 12px",
                                    }}
                                />
                            )}
                            <Typography
                                variant="h6"
                                fontWeight="bold"
                                sx={{ fontSize: "18px", mb: 0.5 }}
                            >
                                {comboGroup?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {comboGroup?.description}
                            </Typography>
                        </Box>

                        <ItemCard
                            item={brick.item}
                            onChange={() => {
                                openEditor("brick", bricks.flatMap((b) => b.items)
                                );
                            }}
                        />
                        <ItemCard
                            item={drink.item}
                            onChange={() => openEditor("drink", drinks.flatMap((d) => d.items))}
                        />
                        <ItemCard
                            item={sauce.item}
                            onChange={() => openEditor("sauce", sauces.flatMap((s) => s.items))}
                        />
                    </Box>

                    {/* Footer: size selector + add button */}
                    <Box
                        sx={{
                            borderTop: "1px solid #eee",
                            display: "flex",
                            p: 2,
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
                                fontSize: "20px",
                                borderRadius: 8,
                                flex: 1,
                                minHeight:60,
                                height: "100%",
                                "&:hover": {
                                    backgroundColor: "#d23f40"
                                }
                            }}
                        >
                            Add · {basePrice.toFixed(2)}
                        </Button>
                    </Box>
                </Box>
            </Modal>

            {editorOpen && (
                <ItemEditorPopup
                    open={editorOpen}
                    onClose={() => setEditorOpen(false)}
                    items={editorItems}
                    onSave={handleEditorSave}
                    target={editorTarget}
                />
            )}
        </>
    );
}