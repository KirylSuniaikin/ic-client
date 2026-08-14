import { describe, it, expect } from "@jest/globals";
import { buildOrderItems, computeAmountPaid } from "./orderPayload";
import type { CartItem, ComboItem } from "../../menu/types";

// Extracted verbatim from useCheckout.ts's handleCheckout order-object literal (task-spec.md §14
// item 6) -- these tests pin the exact shape/values so the Phase 7 rewiring can be verified
// byte-identical against the code it replaces.

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
    return {
        id: 1,
        name: "Margherita",
        size: "M",
        category: "Pizza",
        isThinDough: false,
        isGarlicCrust: false,
        extraIngredients: [],
        toppings: [],
        note: "",
        quantity: 1,
        description: "",
        amount: 3,
        discountAmount: 0,
        comboItems: null,
        photo: "",
        ...overrides,
    };
}

describe("buildOrderItems", () => {
    it("maps a plain cart item to the OrderItemRequest shape", () => {
        const items = buildOrderItems([makeItem()]);

        expect(items).toEqual([
            {
                id: 1,
                name: "Margherita",
                quantity: 1,
                amount: 3,
                size: "M",
                category: "Pizza",
                description: "",
                note: "",
                isGarlicCrust: false,
                isThinDough: false,
                discountAmount: 0,
                customizations: [],
                comboItems: [],
            },
        ]);
    });

    // The `as unknown as X` casts below deliberately inject runtime-shaped values that
    // `CartItem`'s compile-time type forbids (a string where a number is typed, a null where a
    // number is typed, etc). This pins the ported `parseFloat`/`!!`/`?? 0` coercions from the
    // original useCheckout.ts literal, which exist precisely because the runtime data is not
    // always as clean as the type declares.
    it("coerces a string amount to a number", () => {
        const items = buildOrderItems([makeItem({ amount: "4.5" as unknown as number })]);

        expect(items[0].amount).toBe(4.5);
    });

    it("defaults a missing size/description/note to sane fallbacks", () => {
        const items = buildOrderItems([
            // size/description are genuinely falsy empty strings (exercises the `||` fallback);
            // note is cast to inject `undefined`, since CartItem.note is a required string and
            // the `??` fallback (unlike `||`) only triggers on null/undefined, not "".
            makeItem({ size: "", description: "", note: undefined as unknown as string }),
        ]);

        expect(items[0].size).toBe("");
        expect(items[0].description).toBe("");
        expect(items[0].note).toBe("");
    });

    it("coerces isGarlicCrust/isThinDough to booleans", () => {
        const items = buildOrderItems([
            makeItem({ isGarlicCrust: 1 as unknown as boolean, isThinDough: 0 as unknown as boolean }),
        ]);

        expect(items[0].isGarlicCrust).toBe(true);
        expect(items[0].isThinDough).toBe(false);
    });

    it("defaults a null discountAmount to 0", () => {
        const items = buildOrderItems([makeItem({ discountAmount: null as unknown as number })]);

        expect(items[0].discountAmount).toBe(0);
    });

    it("passes through structured customizations unchanged", () => {
        const items = buildOrderItems([
            makeItem({
                customizations: [{ action: "ADD", toppingId: 5, quantity: 1 }],
            }),
        ]);

        expect(items[0].customizations).toEqual([{ action: "ADD", toppingId: 5, quantity: 1 }]);
    });

    it("defaults missing customizations to an empty array", () => {
        const items = buildOrderItems([makeItem({ customizations: undefined })]);

        expect(items[0].customizations).toEqual([]);
    });

    it("maps combo children with the same fallback rules and defaults quantity to 1", () => {
        const comboChild: ComboItem = {
            id: 9,
            name: "Coke",
            category: "Drink",
            size: "",
            isThinDough: false,
            isGarlicCrust: false,
            description: "",
            quantity: 0,
        };
        const items = buildOrderItems([makeItem({ comboItems: [comboChild] })]);

        expect(items[0].comboItems).toEqual([
            {
                id: 9,
                name: "Coke",
                category: "Drink",
                size: "",
                quantity: 1,
                isGarlicCrust: false,
                isThinDough: false,
                description: "",
                note: "",
                customizations: [],
            },
        ]);
    });

    it("defaults a null comboItems array to an empty array", () => {
        const items = buildOrderItems([makeItem({ comboItems: null })]);

        expect(items[0].comboItems).toEqual([]);
    });

    it("maps every item in a multi-item cart", () => {
        const items = buildOrderItems([makeItem({ id: 1 }), makeItem({ id: 2, name: "Pepperoni" })]);

        expect(items).toHaveLength(2);
        expect(items.map(i => i.name)).toEqual(["Margherita", "Pepperoni"]);
    });

    it("returns an empty array for an empty cart", () => {
        expect(buildOrderItems([])).toEqual([]);
    });
});

describe("computeAmountPaid", () => {
    it("sums amount * quantity across a simple cart", () => {
        const total = computeAmountPaid([
            makeItem({ amount: 3, quantity: 2 }),
            makeItem({ amount: 1.5, quantity: 1 }),
        ]);

        expect(total).toBe(7.5);
    });

    it("applies a percentage discountAmount before multiplying by quantity", () => {
        // 10 * (1 - 20/100) * 2 = 16
        const total = computeAmountPaid([makeItem({ amount: 10, discountAmount: 20, quantity: 2 })]);

        expect(total).toBe(16);
    });

    it("rounds to exactly 3 decimal places (BHD fils)", () => {
        const total = computeAmountPaid([makeItem({ amount: 0.333, quantity: 3 })]);

        expect(total).toBe(0.999);
        expect(total.toFixed(3)).toBe(String(total));
    });

    it("truncates floating-point noise to 3dp rather than leaking it into the payload", () => {
        const total = computeAmountPaid([makeItem({ amount: 0.1, quantity: 1 }), makeItem({ amount: 0.2, quantity: 1 })]);

        expect(total).toBe(0.3);
    });

    it("returns 0 for an empty cart", () => {
        expect(computeAmountPaid([])).toBe(0);
    });

    it("treats a missing discountAmount as 0% off", () => {
        const total = computeAmountPaid([makeItem({ amount: 5, quantity: 1, discountAmount: null as unknown as number })]);

        expect(total).toBe(5);
    });
});
