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
import {ItemCard} from "./ItemCard";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

export function PizzaComboPopup({
                                    open,
                                    onClose,
                                    comboGroup,
                                    pizzas,
                                    drinks,
                                    sauces,
                                    onAddToCart,
                                    selectedPizza,
                                }) {
    const [selectedSize, setSelectedSize] = useState(
        selectedPizza?.size?.trim() || "M"
    );

    const [pizza, setPizza] = useState(() => {
        const targetSize = selectedPizza?.size?.trim() || "M";

        const found =
            pizzas
                .flatMap(p => p.items)
                .find(i => i.name === selectedPizza?.name && i.size.trim() === targetSize) ||
            pizzas[0].items[0];

        return {
            item: found,
            size: targetSize,
            dough: selectedPizza?.isThinDough ? "Thin Dough" : "Traditional Dough",
            crust: selectedPizza?.isGarlicCrust ? "Garlic Crust" : "Classic Crust",
        };
    });

    const [drink, setDrink] = useState({
        item: drinks[0].items[0],
    });

    const [sauce, setSauce] = useState({
        item: sauces[0].items[0],
    });

    const [description, setDescription] = useState(
        selectedPizza?.note?.trim() || ""
    );
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorItems, setEditorItems] = useState([]);
    const [editorTarget, setEditorTarget] = useState(null);

    const sizeItem = comboGroup.find((i) => i.size === selectedSize);
    const basePrice = sizeItem ? sizeItem.price : 0;

    function openEditor(target, items) {
        setEditorTarget(target);
        setEditorItems(items);
        setEditorOpen(true);
    }

    function handleEditorSave(updated) {
        if (editorTarget === "pizza") setPizza(updated);
        if (editorTarget === "drink") setDrink(updated);
        if (editorTarget === "sauce") setSauce(updated);
    }

    function handleSizeChange(val) {
        if (!val) return;
        setSelectedSize(val);

        if (pizza) {
            const newItem =
                pizzas
                    .flatMap(p => p.items)
                    .find(i => i.name === pizza.item.name && i.size.trim() === val);

            setPizza({
                ...pizza,
                item: newItem || pizza.item,
                size: val,
                dough: val === "S" ? "Traditional" : pizza.dough,
                isThinDough: val === "S" ? false : pizza.isThinDough,
            });
        }
    }

    function handleAdd() {
        if (!pizza?.item || !drink?.item || !sauce?.item) return;

        const orderItem = {
            amount: basePrice,
            category: "Combo Deals",
            name: "Pizza Combo",
            description: "",
            discount_amount: 0,
            isGarlicCrust: false,
            isThinDough: false,
            photo: sizeItem.photo,
            quantity: 1,
            size: selectedSize,
            comboItems: [
                {
                    category: "Pizzas",
                    name: pizza.item.name,
                    size: selectedSize,
                    isGarlicCrust: pizza.crust === "Garlic Crust",
                    isThinDough: pizza.dough === "Thin Dough",
                    description: description,
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

        onAddToCart?.(orderItem);
        onClose?.();
    }


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
                    <Box sx={{
                        flex: 1,
                        overflowY: "auto",
                        p: 2,
                        "&::-webkit-scrollbar": { display: "none" },
                    }}>
                        <Box sx={{ textAlign: "center", mb: 2 }}>
                        {sizeItem?.photo && (
                            <img
                                src={sizeItem.photo}
                                alt={sizeItem.name}
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
                            {sizeItem?.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {sizeItem?.description}
                        </Typography>
                    </Box>

                        <ItemCard
                            item={pizza.item}
                            dough={pizza.dough}
                            crust={pizza.crust}
                            onDoughChange={(val) => setPizza({ ...pizza, dough: val })}
                            onCrustChange={(val) => setPizza({ ...pizza, crust: val })}
                            onChange={() => {
                                openEditor("pizza", pizzas
                                    .map(p => p.items.find(i => i.size.trim() === selectedSize))
                                    .filter(Boolean)
                                );
                            }
                            }
                            description={description}
                            setDescription={setDescription}
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
                            onChange={(e, val) => handleSizeChange(val)}
                            sx={{
                                backgroundColor: brandGray,
                                borderRadius: 8,
                                p: "4px",
                                flex: 1,
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
                            {comboGroup.map((c) => (
                                <ToggleButton
                                    key={c.size}
                                    value={c.size}
                                    sx={{
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
                                    }}
                                >
                                    {c.size}
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
                    size={selectedSize}
                    onSave={handleEditorSave}
                    target={editorTarget}
                    dough={pizza?.dough}
                    crust={pizza?.crust}
                />
            )}
        </>
    );
}



