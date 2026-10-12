import { describe, it, expect } from "@jest/globals";
import { filterCatalogForIssuer, findCatalogItem } from "./catalog";
import { makeCategory, makeItem } from "./testFixtures";

const categories = [
    makeCategory(1, [makeItem(10, "A"), makeItem(11, "B")]),
    makeCategory(8, [makeItem(80, "C", 8), makeItem(81, "D", 8)]), // mixed
    makeCategory(9, [makeItem(90, "D", 9)]), // D only
    makeCategory(17, [makeItem(170, "D", 17), makeItem(171, "D", 17)]),
];

describe("filterCatalogForIssuer", () => {
    it("drops class D items, mixed-category D items and empty categories", () => {
        const result = filterCatalogForIssuer(categories, false);

        expect(result.map((c) => c.id)).toEqual([1, 8]);
        expect(result.flatMap((c) => c.items).some((i) => i.violationClass === "D")).toBe(false);
        expect(result[1].items.map((i) => i.id)).toEqual([80]);
    });

    it("returns the input unchanged when class D may be issued", () => {
        expect(filterCatalogForIssuer(categories, true)).toEqual(categories);
    });

    it("does not mutate the input", () => {
        filterCatalogForIssuer(categories, false);
        expect(categories[1].items).toHaveLength(2);
    });

    it("handles an empty catalog", () => {
        expect(filterCatalogForIssuer([], false)).toEqual([]);
    });
});

describe("findCatalogItem", () => {
    it("finds an item in any category", () => {
        expect(findCatalogItem(categories, 81)?.id).toBe(81);
    });

    it("returns null for an unknown id", () => {
        expect(findCatalogItem(categories, 999)).toBeNull();
    });
});
