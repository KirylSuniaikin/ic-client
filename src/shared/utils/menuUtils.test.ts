import { describe, it, expect } from "@jest/globals";
import type { MenuItem, Group } from "../../domains/menu/types";
import { groupItemsByName, groupAvailableItemsByName, groupItemsByCategory } from "./menuUtils";

// GroupWithMeta matches the internal MenuGroup shape returned at runtime,
// which is a superset of Group (cast in the source via `as Group[]`).
type GroupWithMeta = Group & {
    category: string;
    is_best_seller: boolean;
    isAvailable: boolean;
};

const makeItem = (
    id: number,
    name: string,
    category: string,
    available: boolean,
    is_best_seller = false
): MenuItem =>
    ({
        id,
        name,
        category,
        available,
        is_best_seller,
        photo: "",
        price: 10,
        size: "M",
        description: "",
    } satisfies MenuItem);

describe("groupItemsByName", () => {
    describe("empty / invalid input", () => {
        it("returns [] for an empty array", () => {
            expect(groupItemsByName([])).toEqual([]);
        });

        it("returns [] for null input", () => {
            // Null guard: tests the runtime fallback branch for non-array input.
            expect(groupItemsByName(null as unknown as MenuItem[])).toEqual([]);
        });

        it("returns [] for undefined input", () => {
            // Undefined guard: tests the runtime fallback branch for non-array input.
            expect(groupItemsByName(undefined as unknown as MenuItem[])).toEqual([]);
        });
    });

    describe("grouping logic", () => {
        it("groups items with the same name into one Group", () => {
            const items = [
                makeItem(1, "Margherita", "Pizzas", true),
                makeItem(2, "Margherita", "Pizzas", false),
            ];

            const result = groupItemsByName(items);

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("Margherita");
            expect(result[0].items).toHaveLength(2);
        });

        it("creates separate groups for items with different names", () => {
            const items = [
                makeItem(1, "Margherita", "Pizzas", true),
                makeItem(2, "Pepperoni", "Pizzas", true),
            ];

            const result = groupItemsByName(items);

            expect(result).toHaveLength(2);
        });

        it("marks group isAvailable=true when at least one item is available", () => {
            const items = [
                makeItem(1, "Margherita", "Pizzas", false),
                makeItem(2, "Margherita", "Pizzas", true),
            ];

            // Runtime objects carry isAvailable even though Group type doesn't expose it.
            const group = groupItemsByName(items)[0] as GroupWithMeta;

            expect(group.isAvailable).toBe(true);
        });

        it("marks group isAvailable=false when no items are available", () => {
            const items = [
                makeItem(1, "Margherita", "Pizzas", false),
                makeItem(2, "Margherita", "Pizzas", false),
            ];

            const group = groupItemsByName(items)[0] as GroupWithMeta;

            expect(group.isAvailable).toBe(false);
        });

        it("includes unavailable items (does not filter them out)", () => {
            const items = [makeItem(1, "Margherita", "Pizzas", false)];

            const result = groupItemsByName(items);

            expect(result).toHaveLength(1);
            expect(result[0].items).toHaveLength(1);
        });

        it("all items in a group belong to the same name key", () => {
            const items = [
                makeItem(1, "Pepperoni", "Pizzas", true),
                makeItem(2, "Margherita", "Pizzas", true),
                makeItem(3, "Pepperoni", "Pizzas", false),
            ];

            const result = groupItemsByName(items);
            const pepperoni = result.find(g => g.name === "Pepperoni");

            expect(pepperoni?.items).toHaveLength(2);
        });
    });
});

describe("groupAvailableItemsByName", () => {
    it("returns [] for an empty array", () => {
        expect(groupAvailableItemsByName([])).toEqual([]);
    });

    it("groups items with the same name into one group", () => {
        const items = [
            makeItem(1, "Margherita", "Pizzas", false),
            makeItem(2, "Margherita", "Pizzas", true),
        ];

        const result = groupAvailableItemsByName(items);

        expect(result).toHaveLength(1);
        expect(result[0].items).toHaveLength(2);
    });

    it("returns all named groups regardless of availability", () => {
        const items = [
            makeItem(1, "Margherita", "Pizzas", false),
            makeItem(2, "Pepperoni", "Pizzas", false),
        ];

        const result = groupAvailableItemsByName(items);

        expect(result).toHaveLength(2);
    });

    it("marks group isAvailable=true when at least one item is available", () => {
        const items = [
            makeItem(1, "Pepperoni", "Pizzas", false),
            makeItem(2, "Pepperoni", "Pizzas", true),
        ];

        const group = groupAvailableItemsByName(items)[0] as GroupWithMeta;

        expect(group.isAvailable).toBe(true);
    });
});

describe("groupItemsByCategory", () => {
    const makeGroup = (
        name: string,
        category: string,
        is_best_seller = false
    ): GroupWithMeta => ({
        name,
        category,
        is_best_seller,
        isAvailable: true,
        items: [],
    });

    it("puts best-seller-flagged groups in bestsellers", () => {
        const groups = [
            makeGroup("Margherita", "Pizzas", true),
            makeGroup("Pepperoni", "Pizzas", false),
        ];

        const result = groupItemsByCategory(groups);

        expect(result.bestsellers).toHaveLength(1);
        expect(result.bestsellers[0].name).toBe("Margherita");
    });

    it("puts Pizzas category into result.pizzas", () => {
        const result = groupItemsByCategory([makeGroup("Pepperoni", "Pizzas")]);

        expect(result.pizzas).toHaveLength(1);
    });

    it("puts Combo Deals category into result.combos", () => {
        const result = groupItemsByCategory([makeGroup("Family Deal", "Combo Deals")]);

        expect(result.combos).toHaveLength(1);
    });

    it("puts Brick Pizzas category into result.brickPizzas", () => {
        const result = groupItemsByCategory([makeGroup("Detroit", "Brick Pizzas")]);

        expect(result.brickPizzas).toHaveLength(1);
    });

    it("puts Baguette Pizzas category into result.pizzaBaguettes", () => {
        const result = groupItemsByCategory([makeGroup("Baguette", "Baguette Pizzas")]);

        expect(result.pizzaBaguettes).toHaveLength(1);
    });

    it("puts Beverages category into result.beverages", () => {
        const result = groupItemsByCategory([makeGroup("Water", "Beverages")]);

        expect(result.beverages).toHaveLength(1);
    });

    it("puts Sides category into result.sides", () => {
        const result = groupItemsByCategory([makeGroup("Fries", "Sides")]);

        expect(result.sides).toHaveLength(1);
    });

    it("puts Sauces category into result.sauces", () => {
        const result = groupItemsByCategory([makeGroup("Ketchup", "Sauces")]);

        expect(result.sauces).toHaveLength(1);
    });

    it("returns empty arrays for all categories when input is empty", () => {
        const result = groupItemsByCategory([]);

        expect(result.pizzas).toHaveLength(0);
        expect(result.combos).toHaveLength(0);
        expect(result.bestsellers).toHaveLength(0);
        expect(result.sides).toHaveLength(0);
    });

    it("a bestseller group also appears in its own category array", () => {
        const groups = [makeGroup("Margherita", "Pizzas", true)];

        const result = groupItemsByCategory(groups);

        expect(result.bestsellers).toHaveLength(1);
        expect(result.pizzas).toHaveLength(1);
    });
});
