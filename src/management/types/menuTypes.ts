export type MenuItem = {
    available: boolean;
    category: string;
    description: string;
    id: number;
    is_best_seller: boolean;
    name: string;
    photo: string;
    price: number;
    size: string;
}

export type CartItem = {
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
    discount_amount: number;
    comboItems: ComboItem[];
    photo: string;
}

export type ExtraIngr = {
    name: string;
}

export type Topping = {
    name: string;
}

export type ComboItem = {
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