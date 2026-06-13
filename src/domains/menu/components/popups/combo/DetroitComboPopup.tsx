import {
    Modal,
    Box,
    Typography,
    Button,
} from "@mui/material";
import React, {useState} from "react";
import ItemEditorPopup from "./ItemEditorPopup";
import {ItemCard} from "./ItemCard";
import CloseIcon from "@mui/icons-material/Close";
import { Fab } from "@mui/material";
import type { MenuItem, CartItem, Group } from '../../../types';

const brandRed = "#E44B4C";

interface ItemConfig {
    item: MenuItem | undefined;
}

interface EditorSaveResult {
    item: MenuItem;
    size: string;
    dough: string;
    crust: string;
}

interface DetroitComboPopupProps {
    open: boolean;
    onClose: () => void;
    combo: Group | MenuItem[];
    bricks: Group[];
    drinks: Group[];
    sauces: Group[];
    onAddToCart: (item: CartItem) => void;
    selectedDetroitPizza?: CartItem | null;
    editItem?: CartItem | null;
    isEditMode?: boolean;
    removeFromCart?: (name: string, amount: number, quantity: number) => void;
}

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
                                  }: DetroitComboPopupProps): JSX.Element | null {
    const [brick, setBrick] = useState<ItemConfig>(() => {
        if (isEditMode === false) {
            const found = bricks
                .flatMap(b => b.items)
                .find(i => i.name === selectedDetroitPizza?.name);

            return {item: found || bricks[0].items[0]};
        } else {
            const found = bricks
                .flatMap(b => b.items)
                .find(i => i.name === editItem?.comboItems[0].name);

            return {item: found || bricks[0].items[0]};
        }

    });

    const [drink, setDrink] = useState<ItemConfig>(() => {
        if (isEditMode === false) {
            return {item: drinks[0].items[0]}
        } else {
            const foundDrink = drinks
                .flatMap(list => list.items)
                .find(i => i.name === editItem?.comboItems[1].name);

            return {item: foundDrink || drinks[0].items[0]}
        }
    });

    const [sauce, setSauce] = useState<ItemConfig>(() => {
        if (isEditMode === false) {
            return {item: sauces[0].items[0]}
        } else {
            const foundSauce = sauces
                .flatMap(list => list.items)
                .find(i => i.name === editItem?.comboItems[2].name);

            return {item: foundSauce || sauces[0].items[0]}
        }
    });

    const [initialEditorItem, setInitialEditorItem] = useState<MenuItem | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorItems, setEditorItems] = useState<MenuItem[]>([]);
    const [editorTarget, setEditorTarget] = useState<string | null>(null);

    if (!combo) return null;
    // combo can be a Group object with .items or a raw MenuItem array
    const comboGroup = (combo as Group).items?.[0] || (combo as MenuItem[])[0] || {};
    const basePrice = (comboGroup as MenuItem)?.price || 0;

    function openEditor(target: string, items: MenuItem[], currentItem: MenuItem | null | undefined): void {
        setEditorTarget(target);
        setEditorItems(items);
        setInitialEditorItem(currentItem ?? null);
        setEditorOpen(true);
    }

    function handleEditorSave(updated: EditorSaveResult): void {
        if (editorTarget === "brick") setBrick(updated);
        if (editorTarget === "drink") setDrink(updated);
        if (editorTarget === "sauce") setSauce(updated);
    }

    function handleAdd(): void {
        if (!brick?.item || !drink?.item || !sauce?.item) return;

        const orderItem = {
            id: (comboGroup as MenuItem).id,
            amount: basePrice,
            category: "Combo Deals",
            name: "Detroit Combo",
            description: "",
            discountAmount: 0,
            isGarlicCrust: false,
            isThinDough: false,
            photo: (comboGroup as MenuItem).photo,
            quantity: 1,
            size: "",
            note: "",
            extraIngredients: [],
            toppings: [],
            comboItems: [
                {
                    id: brick.item.id,
                    category: "Brick Pizzas",
                    name: brick.item.name,
                    size: "",
                    isGarlicCrust: false,
                    isThinDough: false,
                    quantity: 1,
                    description: "",
                },
                {
                    id: drink.item.id,
                    category: "Beverages",
                    name: drink.item.name,
                    size: "",
                    isGarlicCrust: false,
                    isThinDough: false,
                    quantity: 1,
                    description: "",
                },
                {
                    id: sauce.item.id,
                    category: "Sauces",
                    name: sauce.item.name,
                    size: "",
                    isGarlicCrust: false,
                    isThinDough: false,
                    quantity: 1,
                    description: "",
                },
            ],
        } as unknown as CartItem;
        if(isEditMode && editItem) {
            removeFromCart?.(orderItem.name, (orderItem as unknown as Record<string, number>).amount, orderItem.quantity);
        }
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
                    <Box sx={{
                        flex: 1,
                        overflowY: "auto",
                        p: 2,
                        "&::-webkit-scrollbar": {display: "none"},
                    }}>
                        <Box sx={{textAlign: "center", mb: 2}}>
                            {(comboGroup as MenuItem)?.photo && (
                                <Box
                                    component="img"
                                    src={(comboGroup as MenuItem).photo}
                                    alt={(comboGroup as MenuItem).name}
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
                                {(comboGroup as MenuItem)?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {(comboGroup as MenuItem)?.description}
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
