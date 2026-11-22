import type { BaseAppInfoResponse, Order } from "../../../../order/types";
import type { MenuItem } from "../../../../menu/types";

/** An order with one medium Pepperoni and two Coca Colas — 4.500 BD. */
export function makeEditableOrder(overrides: Partial<Order> = {}): Order {
    return {
        id: "77",
        order_no: 2041,
        tel: "97333334444",
        customer_name: "Sara",
        delivery_method: "Pick Up",
        payment_type: "Cash",
        address: "",
        notes: "ring the bell",
        items: [
            { id: 20, name: "Pepperoni", category: "Pizzas", size: "M", quantity: 1, amount: 3.5, description: "", isThinDough: false, isGarlicCrust: false, discountAmount: 0, customizations: [] },
            { id: 31, name: "Coca Cola", category: "Beverages", size: "", quantity: 2, amount: 0.5, description: "", discountAmount: 0 },
        ],
        amount_paid: 4.5,
        order_type: "Pick Up",
        external_id: null,
        phone_number: "97333334444",
        order_created: new Date().toISOString(),
        status: "Kitchen Phase",
        isPaid: false,
        branch_id: "branch-7",
        ...overrides,
    };
}

function menuItem(overrides: Partial<MenuItem> & Pick<MenuItem, "id" | "name" | "category" | "price">): MenuItem {
    return {
        available: true,
        description: "A description staff never need to read",
        is_best_seller: false,
        photo: "https://example.test/photo.webp",
        size: "",
        recipe_components: [],
        ...overrides,
    };
}

const PEPPERONI_RECIPE = [
    { id: 70, name: "Mozzarella", deletable: false },
    { id: 71, name: "Oregano", deletable: true },
];

export const EDIT_MENU: MenuItem[] = [
    menuItem({ id: 19, name: "Pepperoni", category: "Pizzas", size: "S", price: 2.5, recipe_components: PEPPERONI_RECIPE }),
    menuItem({ id: 20, name: "Pepperoni", category: "Pizzas", size: "M", price: 3.5, recipe_components: PEPPERONI_RECIPE }),
    menuItem({ id: 21, name: "Pepperoni", category: "Pizzas", size: "L", price: 4.5, recipe_components: PEPPERONI_RECIPE }),
    menuItem({ id: 31, name: "Coca Cola", category: "Beverages", price: 0.5 }),
    menuItem({ id: 32, name: "Sprite", category: "Beverages", price: 0.5 }),
    menuItem({ id: 33, name: "Water", category: "Beverages", price: 0.3, available: false }),
    menuItem({ id: 41, name: "Garlic Sauce", category: "Sauces", price: 0.2 }),
];

export function makeBaseAppInfo(menu: MenuItem[] = EDIT_MENU): BaseAppInfoResponse {
    return { menu, extraIngr: [], toppings: [], isSDoughAvailable: true, userInfo: null };
}
