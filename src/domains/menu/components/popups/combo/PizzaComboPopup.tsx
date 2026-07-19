import {
    Modal,
    Box,
    Typography,
    Button,
    ToggleButtonGroup,
    ToggleButton, Fab,
} from "@mui/material";
import React, {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import ItemEditorPopup from "./ItemEditorPopup";
import {ItemCard} from "./ItemCard";
import CloseIcon from "@mui/icons-material/Close";
import {useLocalizedItem} from "../../../../../shared/hooks/useLocalizedItem";
import {ExtraIngrScroll} from "../../ExtraIngrScroll";
import {ToppingsScroll} from "../../ToppingsScroll";
import type {MenuItem, CartItem, Group, RecipeComponent, ExtraIngr, Topping, Customization} from '../../../types';
import {
    buildAdditionTokens,
    buildRemovalTokens,
    extrasFromCustomizations,
    intersectRemovals,
    matchRemovalNames,
    parseExtrasNames,
    parseRemovalNames,
    removedFromCustomizations,
    stripExtrasParts,
    stripRemovalTokens,
    toRemoveCustomizations,
    RemovedComponent,
} from "../../../utils/customizations";

const TOPPING_SUFFIX = " Topping";

// Mirrors extrasFromCustomizations (customizations.ts) for the toppingId ADD rows — kept local
// since drizzles are combo-specific here; the standalone popup reads toppingId inline too.
function toppingsFromCustomizations(customizations?: Customization[]): string[] {
    return (customizations ?? [])
        .filter(c => c.action === "ADD" && c.toppingId != null && !!c.name)
        .map(c => c.name as string);
}

// Legacy-description fallback: the shared additions group mixes extras and " Topping"-suffixed
// drizzle names, so pull only the suffixed ones back out.
function toppingNameFromAdditionToken(name: string): string | null {
    return name.endsWith(TOPPING_SUFFIX) ? name.slice(0, -TOPPING_SUFFIX.length) : null;
}

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

interface PizzaConfig {
    item: MenuItem | undefined;
    size: string;
    dough: string;
    crust: string;
    isThinDough?: boolean;
}

interface DrinkSauceConfig {
    item: MenuItem | undefined;
}

interface EditorSaveResult {
    item: MenuItem;
    size: string;
    dough: string;
    crust: string;
}

interface PizzaComboPopupProps {
    open: boolean;
    onClose: () => void;
    comboGroup: MenuItem[];
    pizzas: Group[];
    drinks: Group[];
    sauces: Group[];
    onAddToCart: (item: CartItem) => void;
    selectedPizza?: CartItem | null;
    editItem?: CartItem | null;
    isEditMode?: boolean;
    removeFromCart?: (name: string, amount: number, quantity: number) => void;
    isSDoughAvailable?: boolean;
    isAdmin?: boolean;
    extraIngredients?: ExtraIngr[];
    toppings?: Topping[];
}

export function PizzaComboPopup({
                                    open,
                                    onClose,
                                    comboGroup,
                                    pizzas,
                                    drinks,
                                    sauces,
                                    onAddToCart,
                                    selectedPizza,
                                    editItem,
                                    isEditMode,
                                    removeFromCart,
                                    isSDoughAvailable,
                                    isAdmin,
                                    extraIngredients = [],
                                    toppings = [],
                                }: PizzaComboPopupProps): JSX.Element {
    const {t} = useTranslation("menu");
    const {name: localizeName, description: localizeDescription} = useLocalizedItem();
    const [selectedSize, setSelectedSize] = useState<string>(() => {
        if (isEditMode && editItem) {
            return editItem.size.trim();
        } else {
            return selectedPizza?.size?.trim() || "M";
        }
    });
    const [initialEditorItem, setInitialEditorItem] = useState<MenuItem | null>(null);

    const [pizza, setPizza] = useState<PizzaConfig>(() => {
        if (isEditMode && editItem) {
            const editedItem = editItem.comboItems[0];
            const targetSize = editedItem.size.trim() || "M";

            const found = pizzas
                .flatMap(p => p.items)
                .find(i => i.name === editedItem.name && i.size.trim() === targetSize);

            return {
                item: found,
                size: targetSize,
                dough: editedItem.isThinDough ? "Thin Dough" : "Traditional Dough",
                crust: editedItem.isGarlicCrust ? "Garlic Crust" : "Classic Crust",
            };

        } else {
            const targetSize = selectedPizza?.size?.trim() || "M";

            const found =
                pizzas
                    .flatMap(p => p.items)
                    .find(i => i.name === selectedPizza?.name && i.size.trim() === targetSize)
                ?? findPizzaBySize(pizzas, "M")
                ?? pizzas[0].items[0];

            return {
                item: found,
                size: targetSize,
                dough: selectedPizza?.isThinDough ? "Thin Dough" : "Traditional Dough",
                crust: selectedPizza?.isGarlicCrust ? "Garlic Crust" : "Classic Crust",
            };
        }
    });

    const [drink, setDrink] = useState<DrinkSauceConfig>(() => {
        if (isEditMode && editItem) {
            const foundDrink = drinks
                .flatMap(list => list.items)
                .find(i => i.name === editItem.comboItems[1].name);

            return {item: foundDrink || drinks[0].items[0]};
        } else {
            return {item: drinks[0].items[0]};
        }
    });

    const [sauce, setSauce] = useState<DrinkSauceConfig>(() => {
        if (isEditMode && editItem) {
            const foundSauce = sauces
                .flatMap(list => list.items)
                .find(i => i.name === editItem.comboItems[2].name);

            return {item: foundSauce || sauces[0].items[0]};
        } else {
            return {item: sauces[0].items[0]};
        }
    });

    const [description, setDescription] = useState<string>(() => {
        if (isEditMode && editItem) {
            // Prefer the real comboItems[0].note field; fall back to stripping removal/extras
            // tokens out of the legacy description string for pre-migration orders that never
            // carried a structural note.
            return editItem.comboItems[0].note
                ?? stripExtrasParts(stripRemovalTokens(editItem.comboItems[0].description?.trim() ?? ""));
        } else {
            return (selectedPizza as unknown as Record<string, string>)?.note?.trim() || "";
        }
    });

    const [removedComponents, setRemovedComponents] = useState<RemovedComponent[]>(() => {
        if (isEditMode && editItem) {
            const editedItem = editItem.comboItems[0];
            const targetSize = editedItem.size.trim() || "M";
            const editRecipe = pizzas
                .flatMap(p => p.items)
                .find(i => i.name === editedItem.name && i.size.trim() === targetSize)
                ?.recipe_components ?? [];
            // Structural removals win; legacy lines fall back to parsing the `-(x)` tokens.
            const structural = removedFromCustomizations(editedItem.customizations);
            return structural.length > 0
                ? intersectRemovals(structural, editRecipe)
                : matchRemovalNames(parseRemovalNames(editedItem.description ?? ""), editRecipe);
        }
        if (selectedPizza) {
            // Upsell flow: carry the pending pizza's removals into the combo instead of dropping them.
            const targetSize = selectedPizza.size?.trim() || "M";
            const upsellRecipe = pizzas
                .flatMap(p => p.items)
                .find(i => i.name === selectedPizza.name && i.size.trim() === targetSize)
                ?.recipe_components ?? [];
            const structural = removedFromCustomizations(selectedPizza.customizations);
            return structural.length > 0
                ? intersectRemovals(structural, upsellRecipe)
                : matchRemovalNames(parseRemovalNames(selectedPizza.description ?? ""), upsellRecipe);
        }
        return [];
    });

    // Extra-ingredient names, same string[] state shape as PizzaPopupContent's selectedIngr —
    // hydrated only with names that exist in the catalog (drops "garlic crust"/"cherry" pseudo
    // entries; crust already carries over via the crust toggle).
    const [selectedExtras, setSelectedExtras] = useState<string[]>(() => {
        const catalogNames = new Set(extraIngredients.map(ing => ing.name));
        if (isEditMode && editItem) {
            const editedItem = editItem.comboItems[0];
            const structural = extrasFromCustomizations(editedItem.customizations);
            const names = structural.length > 0
                ? structural
                : parseExtrasNames(editedItem.description ?? "");
            return names.filter(name => catalogNames.has(name));
        }
        if (selectedPizza) {
            // Upsell flow: selectedPizza.extraIngredients holds plain name strings at runtime.
            const names = (selectedPizza.extraIngredients as unknown as string[]) ?? [];
            return names.filter(name => catalogNames.has(name));
        }
        return [];
    });

    function handleToggleExtra(name: string): void {
        setSelectedExtras(prev => prev.includes(name)
            ? prev.filter(x => x !== name)
            : [...prev, name]);
    }

    // Drizzle names, same string[] state shape as PizzaPopupContent's selectedToppings —
    // hydrated only with names that exist in the topping catalog (mirrors selectedExtras above).
    const [selectedToppings, setSelectedToppings] = useState<string[]>(() => {
        const catalogNames = new Set(toppings.map(tp => tp.name));
        if (isEditMode && editItem) {
            const editedItem = editItem.comboItems[0];
            const structural = toppingsFromCustomizations(editedItem.customizations);
            const names = structural.length > 0
                ? structural
                : parseExtrasNames(editedItem.description ?? "")
                    .map(toppingNameFromAdditionToken)
                    .filter((name): name is string => name !== null);
            return names.filter(name => catalogNames.has(name));
        }
        if (selectedPizza) {
            // Upsell flow: selectedPizza.toppings holds plain name strings at runtime (same
            // convention as selectedPizza.extraIngredients above).
            const names = (selectedPizza.toppings as unknown as string[]) ?? [];
            return names.filter(name => catalogNames.has(name));
        }
        return [];
    });

    function handleToggleComponent(component: RecipeComponent): void {
        setRemovedComponents(prev => prev.some(r => r.id === component.id)
            ? prev.filter(r => r.id !== component.id)
            : [...prev, {id: component.id, name: component.name}]);
    }
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorItems, setEditorItems] = useState<MenuItem[]>([]);
    const [editorTarget, setEditorTarget] = useState<string | null>(null);

    const sizeItem = comboGroup?.find((i) => i.size === selectedSize);
    const basePrice = sizeItem ? sizeItem.price : 0;

    // Extras are per-size catalog rows (same convention as PizzaPopupContent): selection is
    // by name, so a size toggle re-resolves prices automatically.
    const ingrsForSize = extraIngredients.filter(
        ing => (ing as unknown as Record<string, unknown>).size === selectedSize);

    const extrasCost = selectedExtras.reduce((sum, name) => {
        const found = ingrsForSize.find(i => i.name === name);
        return found ? sum + ((found as unknown as Record<string, number>).price || 0) : sum;
    }, 0);

    // Assumed: drizzles are priced the same way extras are (standalone PizzaPopupContent adds
    // toppingCost into its final price) — the topping catalog is not size-scoped, unlike extras.
    const toppingsCost = selectedToppings.reduce((sum, name) => {
        const found = toppings.find(tp => tp.name === name);
        return found ? sum + ((found as unknown as Record<string, number>).price || 0) : sum;
    }, 0);

    const finalComboPrice = basePrice + extrasCost + toppingsCost;

    const showDoughSelector =
        (selectedSize === "M" && isSDoughAvailable) ||
        (selectedSize === "L" && isSDoughAvailable) || isAdmin

    useEffect(() => {
        if (selectedSize === "S" || showDoughSelector === false) {
            setPizza({
                ...pizza,
                size: selectedSize,
                dough: "Traditional"
            })
        }
    }, [selectedSize, showDoughSelector]);

    function findPizzaBySize(
        pizzas: Group[],
        targetSize: string): MenuItem | undefined {
        if (!pizzas?.length) return undefined;
        const sizeNorm = targetSize.trim().toUpperCase();

        const all = pizzas.flatMap(p => p.items ?? []);

        const anyAvail = all.find(i =>
            i.size?.trim().toUpperCase() === sizeNorm && i.available
        );
        if (anyAvail) return anyAvail;

        return all.find(i => i.size?.trim().toUpperCase() === sizeNorm);
    }

    function openEditor(target: string, items: MenuItem[], currentItem: MenuItem | null | undefined): void {
        setEditorTarget(target);
        setEditorItems(items);
        setInitialEditorItem(currentItem ?? null);
        setEditorOpen(true);
    }

    function handleEditorSave(updated: EditorSaveResult): void {
        if (editorTarget === "pizza") {
            setPizza(updated);
            // Switching the pizza invalidates its customizations: clear the note, removals, extras and drizzles.
            setDescription("");
            setRemovedComponents([]);
            setSelectedExtras([]);
            setSelectedToppings([]);
        }
        if (editorTarget === "drink") setDrink(updated);
        if (editorTarget === "sauce") setSauce(updated);
    }

    function handleSizeChange(val: string): void {
        if (!val) return;
        setSelectedSize(val);

        if (pizza) {
            const newItem =
                pizzas
                    .flatMap(p => p.items)
                    .find(i => i.name === pizza.item?.name && i.size.trim() === val);

            setPizza({
                ...pizza,
                item: newItem || pizza.item,
                size: val,
                dough: val === "S" ? "Traditional" : pizza.dough,
                isThinDough: val === "S" ? false : pizza.isThinDough,
            });
            // Same pizza, other size: keep removals whose component is still in the recipe,
            // and extras that exist in the new size's catalog rows.
            setRemovedComponents(prev => intersectRemovals(prev, (newItem || pizza.item)?.recipe_components ?? []));
            const newSizeNames = new Set(extraIngredients
                .filter(ing => (ing as unknown as Record<string, unknown>).size === val)
                .map(ing => ing.name));
            setSelectedExtras(prev => prev.filter(name => newSizeNames.has(name)));
            // Toppings/drizzles are not a per-size catalog (same as PizzaPopupContent's
            // selectedToppings), so a size toggle leaves selectedToppings untouched.
        }
    }

    function handleAdd(): void {
        if (!pizza?.item || !drink?.item || !sauce?.item || !sizeItem) return;

        // Extras + drizzles group first, then removals. Drizzle names keep the " Topping"
        // suffix (mirrors PizzaPopupContent.getDesc). The free-text note lives on
        // comboItems[0].note now, never folded into this string.
        const additionNames = [
            ...selectedExtras,
            ...selectedToppings.map(name => `${name}${TOPPING_SUFFIX}`),
        ];
        const extrasPart = buildAdditionTokens(additionNames);
        const finalDescription = [
            extrasPart,
            buildRemovalTokens(removedComponents),
        ].filter(Boolean).join(", ");

        const customizations: Customization[] = [
            ...toRemoveCustomizations(removedComponents),
            ...selectedExtras
                .map(name => ingrsForSize.find(i => i.name === name))
                .filter((found): found is ExtraIngr => found != null && found.id != null)
                .map(found => ({action: "ADD" as const, extraIngrId: found.id, quantity: 1, name: found.name})),
            ...selectedToppings
                .map(name => toppings.find(tp => tp.name === name))
                .filter((found): found is Topping => found != null && found.id != null)
                .map(found => ({action: "ADD" as const, toppingId: found.id, quantity: 1, name: found.name})),
        ];

        const orderItem = {
            id: sizeItem.id,
            amount: finalComboPrice,
            category: "Combo Deals",
            name: "Pizza Combo",
            description: "",
            discountAmount: 0,
            isGarlicCrust: false,
            isThinDough: false,
            photo: sizeItem.photo,
            quantity: 1,
            size: selectedSize,
            note: "",
            extraIngredients: [],
            toppings: [],
            comboItems: [
                {
                    id: pizza.item.id,
                    category: "Pizzas",
                    name: pizza.item.name,
                    size: selectedSize,
                    isGarlicCrust: pizza.crust === "Garlic Crust",
                    isThinDough: pizza.dough === "Thin Dough",
                    description: finalDescription,
                    note: description,
                    quantity: 1,
                    customizations,
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
        // Edit replacement is handled in useCart.handleAddToCart by reference; removing
        // by value here could wipe other identical lines, so it is intentionally omitted.
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
                            {sizeItem?.photo && (
                                <Box
                                    component="img"
                                    src={sizeItem.photo}
                                    alt={localizeName(sizeItem)}
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
                                {sizeItem ? localizeName(sizeItem) : ""}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {sizeItem ? localizeDescription(sizeItem) : ""}
                            </Typography>
                        </Box>

                        <ItemCard
                            item={pizza.item}
                            dough={pizza.dough}
                            crust={pizza.crust}
                            onDoughChange={(val) => setPizza({...pizza, dough: val})}
                            onCrustChange={(val) => setPizza({...pizza, crust: val})}
                            onChange={() => {
                                openEditor("pizza", pizzas
                                        .map(p => p.items.find(i => i.size.trim() === selectedSize && i.available))
                                        .filter((i): i is MenuItem => i !== undefined),
                                    pizza.item
                                );
                            }
                            }
                            description={description}
                            setDescription={setDescription}
                            showDoughSelector={showDoughSelector}
                            components={pizza.item?.recipe_components ?? []}
                            removedIds={removedComponents.map(r => r.id)}
                            onToggleComponent={handleToggleComponent}
                            extrasSlot={
                                <>
                                    <ExtraIngrScroll
                                        ingredients={ingrsForSize}
                                        selected={selectedExtras}
                                        onToggle={handleToggleExtra}
                                    />
                                    <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, mt: 1, px: 0.2}}>
                                        {t("pizzaPopup.drizzles")}
                                    </Typography>
                                    <ToppingsScroll
                                        toppings={toppings as unknown as Parameters<typeof ToppingsScroll>[0]['toppings']}
                                        selectedToppings={selectedToppings}
                                        onUpdateSelectedToppings={setSelectedToppings}
                                    />
                                </>
                            }
                        />
                        <ItemCard
                            item={drink.item}
                            onChange={() => openEditor("drink", drinks.flatMap((d) => d.items).filter(i => i.available), drink.item)}
                        />
                        <ItemCard
                            item={sauce.item}
                            onChange={() => openEditor("sauce", sauces.flatMap((s) => s.items).filter(i => i.available), sauce.item)}
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
                            {comboGroup
                                ?.filter((c) => c.available === true)
                                .map((c) => (
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
                                minHeight: 60,
                                height: "100%",
                                "&:hover": {
                                    backgroundColor: "#d23f40"
                                }
                            }}
                        >
                            {t("comboPopup.add", {price: finalComboPrice.toFixed(2)})}
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
                    initialItem={initialEditorItem}
                    target={editorTarget}
                    dough={pizza?.dough}
                    crust={pizza?.crust}
                />
            )}
        </>
    );
}
