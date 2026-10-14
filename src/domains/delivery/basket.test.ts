import { describe, it, expect } from "@jest/globals";
import { basketSignature, toDeliveryBasket } from "./basket";
import type { CartItem } from "../menu/types";

const line = (overrides: Partial<CartItem>): CartItem => ({
    id: 7, name: "Pepperoni", size: "L", category: "Pizza", isThinDough: false, isGarlicCrust: false,
    extraIngredients: [], toppings: [], note: "", quantity: 1, description: "", amount: 5,
    discountAmount: 0, comboItems: null, photo: "", ...overrides,
});

describe("toDeliveryBasket", () => {
    it("keeps only id, quantity and dough — never category or size", () => {
        expect(toDeliveryBasket([line({ quantity: 3, isThinDough: true })]))
            .toEqual([{ id: 7, quantity: 3, isThinDough: true }]);
    });

    it("carries combo children with their own quantity and dough", () => {
        const combo = line({
            id: 9, category: "Combo Deals",
            comboItems: [{ id: 40, name: "P", category: "Pizza", size: "L", isThinDough: true,
                isGarlicCrust: false, description: "", quantity: 2 }],
        });

        expect(toDeliveryBasket([combo])).toEqual([
            { id: 9, quantity: 1, isThinDough: false, comboItems: [{ id: 40, quantity: 2, isThinDough: true }] },
        ]);
    });
});

describe("basketSignature", () => {
    it("changes when a quantity or a combo child changes, and not otherwise", () => {
        const a = basketSignature(toDeliveryBasket([line({ quantity: 2 })]));

        expect(basketSignature(toDeliveryBasket([line({ quantity: 2 })]))).toBe(a);
        expect(basketSignature(toDeliveryBasket([line({ quantity: 3 })]))).not.toBe(a);
    });
});
