import { describe, it, expect } from "@jest/globals";
import type { CartItem, Customization } from "../../../../menu/types";
import { diffOrderLines, orderLineSignature } from "./diffOrderLines";

function line(overrides: Partial<CartItem> = {}): CartItem {
    return {
        id: 1,
        name: "Coca Cola",
        size: "",
        category: "Beverages",
        isThinDough: false,
        isGarlicCrust: false,
        extraIngredients: [],
        toppings: [],
        note: "",
        quantity: 1,
        description: "",
        amount: 0.5,
        discountAmount: 0,
        comboItems: null,
        photo: "",
        ...overrides,
    };
}

const NO_OREGANO: Customization = { action: "REMOVE", componentId: 7, quantity: 1, name: "Oregano" };

function pepperoni(overrides: Partial<CartItem> = {}): CartItem {
    return line({ id: 20, name: "Pepperoni", category: "Pizzas", size: "M", amount: 3.5, ...overrides });
}

describe("diffOrderLines", () => {
    it("reports a line that was not in the order as added", () => {
        const sprite = line({ name: "Sprite" });
        const result = diffOrderLines([line()], [line(), sprite]);
        expect(result.removed).toEqual([]);
        expect(result.added).toEqual([{ item: sprite, quantity: 1 }]);
    });

    it("reports a line that is gone as removed", () => {
        const garlic = line({ name: "Garlic Sauce", category: "Sauces" });
        const result = diffOrderLines([line(), garlic], [line()]);
        expect(result.added).toEqual([]);
        expect(result.removed).toEqual([{ item: garlic, quantity: 1 }]);
    });

    it("reports only the difference when a quantity goes up", () => {
        const result = diffOrderLines([line({ quantity: 1 })], [line({ quantity: 3 })]);
        expect(result.added.map(c => c.quantity)).toEqual([2]);
        expect(result.removed).toEqual([]);
    });

    it("reports only the difference when a quantity goes down: 2 → 1 Coca Cola is 1 removed", () => {
        const result = diffOrderLines([line({ quantity: 2 })], [line({ quantity: 1 })]);
        expect(result.added).toEqual([]);
        expect(result.removed).toHaveLength(1);
        expect(result.removed[0].quantity).toBe(1);
        expect(result.removed[0].item.name).toBe("Coca Cola");
    });

    it("treats the same item with different options as two different lines", () => {
        const medium = pepperoni();
        const largeThinNoOregano = pepperoni({ size: "L", isThinDough: true, customizations: [NO_OREGANO] });
        const result = diffOrderLines([medium], [largeThinNoOregano]);
        expect(result.removed).toEqual([{ item: medium, quantity: 1 }]);
        expect(result.added).toEqual([{ item: largeThinNoOregano, quantity: 1 }]);
    });

    it("reports nothing when nothing changed", () => {
        const order = [pepperoni({ quantity: 2 }), line()];
        expect(diffOrderLines(order, order.map(item => ({ ...item })))).toEqual({ added: [], removed: [] });
    });

    it("adds up split lines of the same item before comparing", () => {
        const result = diffOrderLines([line({ quantity: 2 })], [line({ quantity: 1 }), line({ quantity: 1 })]);
        expect(result).toEqual({ added: [], removed: [] });
    });
});

describe("orderLineSignature", () => {
    it("ignores the menu id, which differs between the order response and the menu", () => {
        expect(orderLineSignature(line({ id: 1 }))).toBe(orderLineSignature(line({ id: 999 })));
    });

    it("ignores the order of customizations and their server-stamped names", () => {
        const extra: Customization = { action: "ADD", extraIngrId: 3, quantity: 1, name: "Jalapeño" };
        const a = pepperoni({ customizations: [NO_OREGANO, extra] });
        const b = pepperoni({ customizations: [{ ...extra, name: null }, NO_OREGANO] });
        expect(orderLineSignature(a)).toBe(orderLineSignature(b));
    });

    it("keeps a free line apart from a paid one", () => {
        expect(orderLineSignature(line({ discountAmount: 100 }))).not.toBe(orderLineSignature(line()));
    });

    it("tells combos apart by their pizza", () => {
        const combo = (pizza: string): CartItem => line({
            name: "Pizza Combo", category: "Combo Deals", size: "M",
            comboItems: [{ id: 1, name: pizza, category: "Pizzas", size: "M", isThinDough: false, isGarlicCrust: false, description: "", quantity: 1 }],
        });
        expect(orderLineSignature(combo("Pepperoni"))).not.toBe(orderLineSignature(combo("Margherita")));
    });
});
