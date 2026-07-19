export type MenuItem = {
    available: boolean;
    category: string;
    description: string;
    id: number;
    is_best_seller: boolean;
    name: string;
    // Arabic display variants (nullable — fall back to name/description). Display-only:
    // the canonical English `name` is what goes into the cart and the order payload, so the
    // kitchen/admin board always shows English. See shared/hooks/useLocalizedItem.
    name_ar?: string | null;
    description_ar?: string | null;
    photo: string;
    price: number;
    size: string;
    // Per-size recipe components (backend recipe_ingredients); deletable ones can be
    // removed by the customer in the pizza popups. Absent for items without a recipe.
    recipe_components?: RecipeComponent[];
}

export type RecipeComponent = {
    id: number;
    name: string;
    deletable: boolean;
    // Customer-facing display label (nullable — falls back to `name`). Display-only:
    // `name` remains the value carried into the order (see utils/customizations.ts).
    label?: string;
    label_ar?: string;
}

// Structured order-line customization mirrored from backend OrderItemCustomizationTO.
// Exactly one of toppingId/extraIngrId/componentId is set: ADD targets a topping or
// extra ingredient, REMOVE targets a recipe component. name/price are server-stamped
// echoes on responses; requests only need the ids.
export type Customization = {
    action: "ADD" | "REMOVE";
    toppingId?: number | null;
    extraIngrId?: number | null;
    componentId?: number | null;
    quantity?: number | null;
    name?: string | null;
    price?: number | null;
}

export type CartItem = {
    id: number;
    name: string;
    size: string;
    category: string;
    isThinDough: boolean;
    isGarlicCrust: boolean;
    extraIngredients: ExtraIngr[];
    toppings: Topping[];
    note: string;
    quantity: number;
    description: string;
    amount: number;
    discountAmount: number;
    comboItems: ComboItem[] | null;
    photo: string;
    // Structured customizations (removed components + added toppings/extras) sent to the
    // backend alongside the human-readable description string.
    customizations?: Customization[];
}

export type ExtraIngr = {
    // The backend has always sent the id; the type just omitted it.
    id: number;
    name: string;
    // Arabic display name (nullable — falls back to `name`). Display-only; see useLocalizedItem.
    name_ar?: string | null;
}

export type Topping = {
    // The backend has always sent the id; the type just omitted it.
    id: number;
    name: string;
    // Arabic display name (nullable — falls back to `name`). Display-only; see useLocalizedItem.
    name_ar?: string | null;
}

export type ComboItem = {
    id: number;
    name: string;
    category: string;
    size: string;
    isThinDough: boolean;
    isGarlicCrust: boolean;
    description: string;
    // Combo child's own free-text note, kept separate from `description` (was previously baked
    // into the parent combo's description string). Optional so pre-migration cart/order shapes
    // that never carried it still satisfy this type.
    note?: string;
    quantity: number;
    customizations?: Customization[];
}

export type MiniPizza = {
    name: string;
    quantity: number;
}

export type Group = {
    name: string;
    items: MenuItem[];
}
