import {
    Modal,
    Box,
    Typography,
    Button,
} from "@mui/material";
import React, {useState} from "react";
import ItemEditorPopup from "./ItemEditorPopup";
import {ItemCard} from "./ItemCard";

const brandRed = "#E44B4C";

export function DetroitComboPopup({
                                      open,
                                      onClose,
                                      combo,
                                      bricks,
                                      drinks,
                                      sauces,
                                      onAddToCart,
                                      selectedDetroitPizza,
                                      editItem,
                                      isEditMode,
                                      removeFromCart,
                                  }) {
    const [brick, setBrick] = useState(() => {
        if (isEditMode === false) {
            const found = bricks
                .flatMap(b => b.items)
                .find(i => i.name === selectedDetroitPizza?.name);

            return {item: found || bricks[0].items[0]};
        } else {
            const found = bricks
                .flatMap(b => b.items)
                .find(i => i.name === editItem.comboItems[0].name);

            return {item: found || bricks[0].items[0]};
        }

    });

    const [drink, setDrink] = useState(() => {
        if (isEditMode === false) {
            return {item: drinks[0].items[0]}
        } else {
            const foundDrink = drinks
                .flatMap(list => list.items)
                .find(i => i.name === editItem.comboItems[1].name);

            return {item: foundDrink || drinks[0].items[0]}
        }
    });

    const [sauce, setSauce] = useState(() => {
        if (isEditMode === false) {
            return {item: sauces[0].items[0]}
        } else {
            const foundSauce = sauces
                .flatMap(list => list.items)
                .find(i => i.name === editItem.comboItems[2].name);

            return {item: foundSauce || sauces[0].items[0]}
        }
    });

    const [initialEditorItem ,setInitialEditorItem] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorItems, setEditorItems] = useState([]);
    const [editorTarget, setEditorTarget] = useState(null);

    if (!combo) return null;
    const comboGroup = combo.items?.[0] || combo[0] || {};
    const basePrice = comboGroup?.price || 0;

    function openEditor(target, items, currentItem) {
        setEditorTarget(target);
        setEditorItems(items);
        setInitialEditorItem(currentItem);
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

        removeFromCart(orderItem.name, orderItem.amount, orderItem.quantity);
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
                        "&::-webkit-scrollbar": {display: "none"},
                    }}>
                        <Box sx={{textAlign: "center", mb: 2}}>
                            {comboGroup?.photo && (
                                <Box
                                    component="img"
                                    src={comboGroup.photo}
                                    alt={comboGroup.name}
                                    sx={{
                                        width: "100%",
                                        height: "auto",
                                        maxWidth: {xs: 320, sm: 800, md: 900, lg: 1000},
                                        maxHeight: {xs: 320, sm: 600, md: 400, lg: 480},
                                        objectFit: "contain",
                                        display: "block",
                                        mx: "auto",
                                        mb: 2,
                                    }}
                                />
                            )}
                            <Typography
                                variant="h6"
                                fontWeight="bold"
                                sx={{fontSize: "18px", mb: 0.5}}
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
                                openEditor("brick", bricks.flatMap((b) => b.items), brick.item
                                );
                            }}
                        />
                        <ItemCard
                            item={drink.item}
                            onChange={() => openEditor("drink", drinks.flatMap((d) => d.items), drink.item)}
                        />
                        <ItemCard
                            item={sauce.item}
                            onChange={() => openEditor("sauce", sauces.flatMap((s) => s.items), sauce.item)}
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
                                minHeight: 60,
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
                    initialItem={initialEditorItem}
                />
            )}
        </>
    );
}