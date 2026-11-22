import { describe, it, expect } from "@jest/globals";
import type { CartItem, MenuItem } from "../../../../menu/types";
import { buildEditCategories, cheapestAvailable, lineEditKind, popupKindFor } from "./orderEditMenu";

function item(overrides: Partial<MenuItem> & Pick<MenuItem, "id" | "name" | "category">): MenuItem {
    return { available: true, description: "", is_best_seller: false, photo: "", price: 1, size: "", ...overrides };
}

describe("buildEditCategories", () => {
    it("orders the known categories as the spec lists them, then the rest in menu order", () => {
        const menu = [
            item({ id: 1, name: "Water", category: "Beverages" }),
            item({ id: 2, name: "Ramadan Box", category: "Ramadan" }),
            item({ id: 3, name: "Garlic Sauce", category: "Sauces" }),
            item({ id: 4, name: "Pepperoni", category: "Pizzas", size: "M" }),
            item({ id: 5, name: "Pepperoni", category: "Pizzas", size: "L" }),
            item({ id: 6, name: "Pizza Combo", category: "Combo Deals", size: "M" }),
            item({ id: 7, name: "Wings", category: "Sides" }),
        ];

        const categories = buildEditCategories(menu);

        expect(categories.map(c => c.name)).toEqual(["Pizzas", "Combo Deals", "Sides", "Sauces", "Beverages", "Ramadan"]);
        expect(categories[0].groups.map(g => [g.name, g.items.length])).toEqual([["Pepperoni", 2]]);
    });

    it("keeps a stopped item stopped instead of forcing it available", () => {
        const stopped = item({ id: 1, name: "Water", category: "Beverages", available: false });
        buildEditCategories([stopped]);
        expect(stopped.available).toBe(false);
    });
});

describe("cheapestAvailable", () => {
    it("skips stopped sizes", () => {
        const group = { name: "Pepperoni", items: [
            item({ id: 1, name: "Pepperoni", category: "Pizzas", size: "S", price: 2.5, available: false }),
            item({ id: 2, name: "Pepperoni", category: "Pizzas", size: "M", price: 3.5 }),
        ] };
        expect(cheapestAvailable(group)?.size).toBe("M");
    });
});

describe("popupKindFor", () => {
    const kind = (name: string, category: string): string =>
        popupKindFor({ name, items: [item({ id: 1, name, category })] });

    it("opens the same popup the menu page opens", () => {
        expect(kind("Pepperoni", "Pizzas")).toBe("pizza");
        expect(kind("Pepperoni Baguette", "Baguette Pizzas")).toBe("baguette");
        expect(kind("Brick Pepperoni", "Brick Pizzas")).toBe("generic");
        expect(kind("Pizza Combo", "Combo Deals")).toBe("pizzaCombo");
        expect(kind("Detroit Combo", "Combo Deals")).toBe("detroitCombo");
        expect(kind("Pizza Rolls", "Sides")).toBe("generic");
    });

    it("adds items with no options in one tap", () => {
        expect(kind("Coca Cola", "Beverages")).toBe("simple");
        expect(kind("Garlic Sauce", "Sauces")).toBe("simple");
        expect(kind("Wings", "Sides")).toBe("simple");
    });
});

describe("lineEditKind", () => {
    const line = (overrides: Partial<CartItem>): CartItem => ({
        id: 1, name: "Pepperoni", size: "M", category: "Pizzas", isThinDough: false, isGarlicCrust: false,
        extraIngredients: [], toppings: [], note: "", quantity: 1, description: "", amount: 3.5,
        discountAmount: 0, comboItems: null, photo: "", ...overrides,
    });

    it("reopens pizzas and combos, the lines whose popup has an edit mode", () => {
        expect(lineEditKind(line({}))).toBe("pizza");
        expect(lineEditKind(line({ name: "Detroit Combo", category: "Combo Deals" }))).toBe("detroitCombo");
        expect(lineEditKind(line({
            name: "Pizza Combo", category: "Combo Deals",
            comboItems: [{ id: 1, name: "Pepperoni", category: "Pizzas", size: "M", isThinDough: false, isGarlicCrust: false, description: "", quantity: 1 }],
        }))).toBe("pizzaCombo");
    });

    it("offers nothing for lines without options", () => {
        expect(lineEditKind(line({ name: "Coca Cola", category: "Beverages", size: "" }))).toBeNull();
        expect(lineEditKind(line({ name: "Pizza Combo", category: "Combo Deals", comboItems: [] }))).toBeNull();
    });
});
