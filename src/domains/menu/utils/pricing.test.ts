import { describe, it, expect } from "@jest/globals";
import { extrasCost, toppingsCost, pizzaUnitPrice } from "./pricing";
import type { ExtraIngr, Topping } from "../types";

const EXTRAS: ExtraIngr[] = [
    { id: 1, name: "Mushroom", size: "M", price: 0.6 },
    { id: 2, name: "Mushroom", size: "L", price: 0.9 },
    { id: 3, name: "Olives", size: "M", price: 0.5 },
];

const TOPPINGS: Topping[] = [
    { id: 10, name: "Garlic", price: 0.3 },
    { id: 11, name: "Ranch", price: 0.4 },
];

describe("extrasCost", () => {
    it("should sum only the rows of the selected size when the same extra exists per size", () => {
        expect(extrasCost(["Mushroom"], EXTRAS, "M")).toBe(0.6);
        expect(extrasCost(["Mushroom"], EXTRAS, "L")).toBe(0.9);
    });

    it("should sum every selected extra of that size", () => {
        expect(extrasCost(["Mushroom", "Olives"], EXTRAS, "M")).toBeCloseTo(1.1);
    });

    it("should contribute nothing for a free pseudo-ingredient that has no catalog row", () => {
        expect(extrasCost(["garlic crust", "cherry"], EXTRAS, "M")).toBe(0);
    });

    it("should contribute nothing when the extra has no row for the selected size", () => {
        expect(extrasCost(["Olives"], EXTRAS, "L")).toBe(0);
    });

    it("should treat a null catalog price as free instead of producing NaN", () => {
        const withNullPrice: ExtraIngr[] = [{ id: 4, name: "Basil", size: "M", price: null }];

        expect(extrasCost(["Basil"], withNullPrice, "M")).toBe(0);
    });
});

describe("toppingsCost", () => {
    it("should sum drizzle prices without any size scoping", () => {
        expect(toppingsCost(["Garlic", "Ranch"], TOPPINGS)).toBeCloseTo(0.7);
    });

    it("should ignore an unknown drizzle name", () => {
        expect(toppingsCost(["Nonexistent"], TOPPINGS)).toBe(0);
    });
});

describe("pizzaUnitPrice", () => {
    it("should add extras and drizzles to the base price of the size", () => {
        const price = pizzaUnitPrice({
            basePrice: 3,
            size: "M",
            extraIngredients: ["Mushroom"],
            toppings: ["Garlic"],
            extrasCatalog: EXTRAS,
            toppingsCatalog: TOPPINGS,
        });

        expect(price).toBeCloseTo(3.9);
    });

    it("should re-resolve extras against the new size rather than reusing the old price", () => {
        const price = pizzaUnitPrice({
            basePrice: 4,
            size: "L",
            extraIngredients: ["Mushroom"],
            toppings: [],
            extrasCatalog: EXTRAS,
            toppingsCatalog: TOPPINGS,
        });

        expect(price).toBeCloseTo(4.9);
    });

    it("should accept catalog objects as well as plain name strings", () => {
        const price = pizzaUnitPrice({
            basePrice: 3,
            size: "M",
            extraIngredients: [{ name: "Mushroom" }],
            toppings: [{ name: "Garlic" }],
            extrasCatalog: EXTRAS,
            toppingsCatalog: TOPPINGS,
        });

        expect(price).toBeCloseTo(3.9);
    });

    it("should fall back to the base price when the line carries no customizations", () => {
        const price = pizzaUnitPrice({
            basePrice: 3,
            size: "M",
            extraIngredients: null,
            toppings: undefined,
            extrasCatalog: EXTRAS,
            toppingsCatalog: TOPPINGS,
        });

        expect(price).toBe(3);
    });
});
