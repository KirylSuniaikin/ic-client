import { useState, Dispatch, SetStateAction } from "react";
import type { MenuItem, CartItem, ExtraIngr, Group } from "../../menu/types";
import { sameRemovals } from "../../menu/utils/customizations";

export interface UseCartResult {
    cartItems: CartItem[];
    setCartItems: Dispatch<SetStateAction<CartItem[]>>;
    handleAddToCart: (items: CartItem | CartItem[], upsellDeclined?: boolean) => void;
    removeFromCart: (name: string, amount: number, quantity: number) => void;
    handleRemoveItemFromCart: (item: CartItem) => void;
    handleChangeQuantity: (item: CartItem, newQty: number) => void;
    handleChangeSize: (item: CartItem, newSize: string) => void;
    handleDiscountChange: (item: CartItem, discount: number) => void;
    totalPrice: string;
    upsellPopupOpen: boolean;
    setUpsellPopupOpen: Dispatch<SetStateAction<boolean>>;
    upsellItem: CartItem | null;
    upsellType: string | null;
    comboOfferPhoto: string | null;
    comboPrice: number | null;
    pendingItems: CartItem | CartItem[] | null;
    handleUpsellDecline: () => void;
    handleUpsellAccept: (item: CartItem | null, type: string | null) => void;
    pizzaPopupOpen: boolean;
    setPizzaPopupOpen: Dispatch<SetStateAction<boolean>>;
    comboPopupOpen: boolean;
    setComboPopupOpen: Dispatch<SetStateAction<boolean>>;
    pizzaComboPopupOpen: boolean;
    setPizzaComboPopupOpen: Dispatch<SetStateAction<boolean>>;
    detroitComboPopupOpen: boolean;
    setDetroitComboPopupOpen: Dispatch<SetStateAction<boolean>>;
    genericPopupOpen: boolean;
    setGenericPopupOpen: Dispatch<SetStateAction<boolean>>;
    baguettePizzaPopupOpen: boolean;
    setBaguettePizzaPopupOpen: Dispatch<SetStateAction<boolean>>;
    popupGroup: Group | MenuItem | MenuItem[] | null;
    setPopupGroup: Dispatch<SetStateAction<Group | MenuItem | MenuItem[] | null>>;
    editItem: CartItem | null;
    setEditItem: Dispatch<SetStateAction<CartItem | null>>;
    editMode: boolean;
    setEditMode: Dispatch<SetStateAction<boolean>>;
    closedPopup: boolean;
    setClosedPopupOpen: Dispatch<SetStateAction<boolean>>;
    cartOpen: boolean;
    setCartOpen: Dispatch<SetStateAction<boolean>>;
}

export function useCart(menuData: MenuItem[], isAdmin: boolean): UseCartResult {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [upsellPopupOpen, setUpsellPopupOpen] = useState(false);
    const [upsellItem, setUpsellItem] = useState<CartItem | null>(null);
    const [upsellType, setUpsellType] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<CartItem | CartItem[] | null>(null);
    const [comboOfferPhoto, setComboOfferPhoto] = useState<string | null>(null);
    const [comboPrice, setComboPrice] = useState<number | null>(null);
    const [pizzaPopupOpen, setPizzaPopupOpen] = useState(false);
    const [comboPopupOpen, setComboPopupOpen] = useState(false);
    const [pizzaComboPopupOpen, setPizzaComboPopupOpen] = useState(false);
    const [detroitComboPopupOpen, setDetroitComboPopupOpen] = useState(false);
    const [genericPopupOpen, setGenericPopupOpen] = useState(false);
    const [baguettePizzaPopupOpen, setBaguettePizzaPopupOpen] = useState(false);
    const [popupGroup, setPopupGroup] = useState<Group | MenuItem | MenuItem[] | null>(null);
    const [editItem, setEditItem] = useState<CartItem | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [closedPopup, setClosedPopupOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);

    const totalPrice = cartItems.reduce((acc, i) => {
        return acc + i.amount * (1 - (i.discountAmount || 0) / 100) * i.quantity;
    }, 0).toFixed(2);

    function handleDiscountChange(item: CartItem, newDiscount: number): void {
        setCartItems(prev => prev.map(i => i === item ? { ...i, discountAmount: newDiscount } : i));
    }

    function handleAddToCart(items: CartItem | CartItem[], upsellDeclined?: boolean): void {
        const arr = Array.isArray(items) ? items : [items];

        // Editing an existing line: replace the original item in place by reference.
        // Editing must NOT go through the upsell prompt or the name+discount merge below —
        // otherwise the edited item is counted onto a sibling line and its quantity doubles.
        if (editMode && editItem && arr.length > 0) {
            const original = editItem;
            const [edited, ...extras] = arr;
            setCartItems(prev => {
                const idx = prev.findIndex((it: CartItem) => it === original);
                const next = [...prev];
                if (idx === -1) next.push({ ...edited });
                else next[idx] = { ...edited };
                extras.forEach((ex: CartItem) => next.push({ ...ex }));
                return next;
            });
            setEditItem(null);
            setEditMode(false);
            setPizzaPopupOpen(false);
            setPizzaComboPopupOpen(false);
            setDetroitComboPopupOpen(false);
            setBaguettePizzaPopupOpen(false);
            setPopupGroup(null);
            return;
        }

        const pizzaItem = arr.find((it: CartItem) => it.category === "Pizzas");
        const brickItem = arr.find((it: CartItem) => it.category === "Brick Pizzas");

        if (pizzaItem && !upsellDeclined) {
            const combo = menuData.find((it: MenuItem) => it.name === "Pizza Combo" && it.size === pizzaItem.size);
            setComboOfferPhoto(combo?.photo ?? null);
            setComboPrice(combo?.price ?? null);
            setPendingItems(items);
            setUpsellItem(pizzaItem);
            setUpsellType("pizza");
            setUpsellPopupOpen(true);
            return;
        }
        if (brickItem && !upsellDeclined) {
            const combo = menuData.find((it: MenuItem) => it.name === "Detroit Combo");
            setComboOfferPhoto(combo?.photo ?? null);
            setComboPrice(combo?.price ?? null);
            setPendingItems(items);
            setUpsellItem(brickItem);
            setUpsellType("brick");
            setUpsellPopupOpen(true);
            return;
        }

        setCartItems(prev => {
            const updated = [...prev];
            arr.forEach((item: CartItem) => {
                const idx = updated.findIndex((it: CartItem) =>
                    it.name === item.name && (it.discountAmount || 0) === (item.discountAmount || 0)
                );
                if (idx === -1) { updated.push({ ...item }); return; }
                const existing = updated[idx];

                if (item.category !== "Combo Deals" && item.category !== "Pizzas") {
                    // Brick pizzas carry note/removal customizations like pizzas do — different
                    // customizations must stay separate lines instead of merging by name. The
                    // note left `description` for its own field, so it needs its own comparison.
                    if (item.category === "Brick Pizzas" &&
                        (existing.description !== item.description ||
                            existing.note !== item.note ||
                            !sameRemovals(existing.customizations, item.customizations))) {
                        updated.push({ ...item });
                        return;
                    }
                    updated[idx] = { ...existing, quantity: existing.quantity + item.quantity };
                    return;
                }
                if (item.category === "Combo Deals" && item.name === "Detroit Combo") {
                    // The brick's removal tokens live on comboItems[0].description and its note on
                    // comboItems[0].note — different customizations must stay separate lines
                    // (structural check as the safety net).
                    const same = existing.comboItems?.[0]?.name === item.comboItems?.[0]?.name &&
                        existing.comboItems?.[0]?.description === item.comboItems?.[0]?.description &&
                        existing.comboItems?.[0]?.note === item.comboItems?.[0]?.note &&
                        sameRemovals(existing.comboItems?.[0]?.customizations, item.comboItems?.[0]?.customizations) &&
                        existing.comboItems?.[1]?.name === item.comboItems?.[1]?.name &&
                        existing.comboItems?.[2]?.name === item.comboItems?.[2]?.name;
                    if (same) updated[idx] = { ...existing, quantity: existing.quantity + item.quantity };
                    else updated.push({ ...item });
                    return;
                }
                if (item.category === "Combo Deals" && item.name === "Pizza Combo") {
                    if (existing.description !== item.description || existing.size !== item.size) { updated.push({ ...item }); return; }
                    const same = existing.comboItems?.[0]?.name === item.comboItems?.[0]?.name &&
                        existing.comboItems?.[0]?.isGarlicCrust === item.comboItems?.[0]?.isGarlicCrust &&
                        existing.comboItems?.[0]?.isThinDough === item.comboItems?.[0]?.isThinDough &&
                        existing.comboItems?.[0]?.description === item.comboItems?.[0]?.description &&
                        existing.comboItems?.[0]?.note === item.comboItems?.[0]?.note &&
                        sameRemovals(existing.comboItems?.[0]?.customizations, item.comboItems?.[0]?.customizations) &&
                        existing.comboItems?.[1]?.name === item.comboItems?.[1]?.name &&
                        existing.comboItems?.[2]?.name === item.comboItems?.[2]?.name;
                    if (same) updated[idx] = { ...existing, quantity: existing.quantity + item.quantity };
                    else updated.push({ ...item });
                    return;
                }
                if (item.category === "Pizzas") {
                    // Removal tokens live in description, so baseChanged already splits different
                    // removals; the structural check guards against description drift. The note
                    // left `description` for its own field, so it needs its own comparison.
                    const baseChanged = existing.description !== item.description || existing.size !== item.size ||
                        existing.isThinDough !== item.isThinDough || existing.isGarlicCrust !== item.isGarlicCrust ||
                        existing.note !== item.note ||
                        !sameRemovals(existing.customizations, item.customizations);
                    if (baseChanged) { updated.push({ ...item }); return; }
                    const ee = existing.extraIngredients || [];
                    const ne = item.extraIngredients || [];
                    if (ee.length === 0 && ne.length === 0) { updated[idx] = { ...existing, quantity: existing.quantity + item.quantity }; return; }
                    if (ee.length !== ne.length) { updated.push({ ...item }); return; }
                    if (!ee.every((ing: ExtraIngr) => ne.some((it: ExtraIngr) => it.name === ing.name))) { updated.push({ ...item }); return; }
                    updated[idx] = { ...existing, quantity: existing.quantity + item.quantity, amount: existing.amount + item.amount };
                    return;
                }
                updated.push({ ...item });
            });
            return updated;
        });

        setPizzaPopupOpen(false);
        setPopupGroup(null);
        setEditMode(false);
        const firstItem = arr[0];
        if (firstItem) {
            window.ttq?.track('AddToCart', { content_id: firstItem.name, content_type: 'product', value: firstItem.amount, currency: 'BHD' });
            window.fbq?.('track', 'AddToCart', { content_ids: [firstItem.id ?? firstItem.name], content_name: firstItem.name, content_type: 'product', value: firstItem.amount, currency: 'BHD' });
        }
        setPendingItems(null);
    }

    function removeFromCart(name: string, amount: number, quantity: number): void {
        setCartItems(prev => prev.filter((item: CartItem) =>
            !(item.name === name && item.amount === amount && item.quantity === quantity)
        ));
    }

    function handleRemoveItemFromCart(item: CartItem): void {
        setCartItems(prev => prev.filter((it: CartItem) => it !== item));
    }

    function handleChangeQuantity(item: CartItem, newQty: number): void {
        if (newQty < 1) return;
        if (!isAdmin && item.discountAmount === 100 && newQty > item.quantity) return;
        setCartItems(prev => prev.map((it: CartItem) => it === item ? { ...it, quantity: newQty } : it));
    }

    function handleChangeSize(item: CartItem, newSize: string): void {
        const sameItems = menuData.filter((m: MenuItem) => m.name === item.name);
        const matched = sameItems.find((it: MenuItem) => it.size === newSize);
        const newBasePrice = matched ? matched.price : item.amount;
        const newId = matched ? matched.id : item.id;
        setCartItems(prev => prev.map((it: CartItem) => it === item ? { ...it, id: newId, amount: newBasePrice, size: newSize } : it));
    }

    function handleUpsellDecline(): void {
        if (upsellItem && pendingItems) handleAddToCart(pendingItems, true);
        setUpsellPopupOpen(false);
        setComboOfferPhoto(null);
        setComboPrice(null);
        setUpsellItem(null);
        setUpsellType(null);
    }

    function handleUpsellAccept(item: CartItem | null, type: string | null): void {
        if (type === "pizza") {
            const pizzaCombos = menuData.filter((m: MenuItem) => m.name === "Pizza Combo");
            if (pizzaCombos.length > 0) { setPopupGroup(pizzaCombos); setPizzaComboPopupOpen(true); }
        } else if (type === "brick") {
            const detroitCombo = menuData.filter((m: MenuItem) => m.name === "Detroit Combo");
            if (detroitCombo.length > 0) { setPopupGroup(detroitCombo); setDetroitComboPopupOpen(true); }
        }
        setComboOfferPhoto(null);
        setComboPrice(null);
        setUpsellPopupOpen(false);
    }

    return {
        cartItems, setCartItems, handleAddToCart, removeFromCart, handleRemoveItemFromCart,
        handleChangeQuantity, handleChangeSize, handleDiscountChange, totalPrice,
        upsellPopupOpen, setUpsellPopupOpen, upsellItem, upsellType, comboOfferPhoto, comboPrice,
        pendingItems, handleUpsellDecline, handleUpsellAccept,
        pizzaPopupOpen, setPizzaPopupOpen, comboPopupOpen, setComboPopupOpen,
        pizzaComboPopupOpen, setPizzaComboPopupOpen, detroitComboPopupOpen, setDetroitComboPopupOpen,
        genericPopupOpen, setGenericPopupOpen, baguettePizzaPopupOpen, setBaguettePizzaPopupOpen,
        popupGroup, setPopupGroup, editItem, setEditItem, editMode, setEditMode,
        closedPopup, setClosedPopupOpen, cartOpen, setCartOpen,
    };
}
