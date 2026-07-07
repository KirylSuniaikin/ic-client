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
}

export type ExtraIngr = {
    name: string;
    // Arabic display name (nullable — falls back to `name`). Display-only; see useLocalizedItem.
    name_ar?: string | null;
}

export type Topping = {
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
    quantity: number;
}

export type MiniPizza = {
    name: string;
    quantity: number;
}

export type Group = {
    name: string;
    items: MenuItem[];
}

export type QuickPickDto = {
    id: number;
    label: string;
    labelAr: string | null;
    isPopular: boolean;
}
