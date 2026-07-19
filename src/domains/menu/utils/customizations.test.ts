import { describe, it, expect } from "@jest/globals";
import {
    buildRemovalTokens,
    buildAdditionTokens,
    stripRemovalTokens,
    parseRemovalNames,
    removedFromCustomizations,
    extrasFromCustomizations,
    parseExtrasNames,
    stripExtrasParts,
    toRemoveCustomizations,
    sameRemovals,
    intersectRemovals,
    matchRemovalNames,
} from "./customizations";
import type { Customization, RecipeComponent } from "../types";

const onion = { id: 7, name: "Red Onion" };
const olives = { id: 9, name: "Olives" };

describe("buildRemovalTokens (new grammar: single grouped -(a, b) token)", () => {
    it("builds a single grouped token for multiple removals", () => {
        expect(buildRemovalTokens([onion, olives])).toBe("-(Red Onion, Olives)");
    });

    it("builds a single-name token for one removal", () => {
        expect(buildRemovalTokens([onion])).toBe("-(Red Onion)");
    });

    it("returns an empty string for no removals", () => {
        expect(buildRemovalTokens([])).toBe("");
    });
});

describe("buildAdditionTokens (new grammar: +(a, b) sign outside the paren)", () => {
    it("returns an empty string for an empty name list", () => {
        expect(buildAdditionTokens([])).toBe("");
    });

    it("builds a single-name group", () => {
        expect(buildAdditionTokens(["Mushroom"])).toBe("+(Mushroom)");
    });

    it("builds a multi-name group combining extras and drizzle names (drizzle keeps the ' Topping' suffix)", () => {
        expect(buildAdditionTokens(["Mushroom", "Olives", "Garlic Topping"])).toBe(
            "+(Mushroom, Olives, Garlic Topping)"
        );
    });
});

describe("parseRemovalNames — accepts both new grouped and legacy per-item tokens", () => {
    it("parses the new grouped -(a, b) token", () => {
        expect(parseRemovalNames("-(Marinara, Onion)")).toEqual(["Marinara", "Onion"]);
    });

    it("parses legacy per-item -(x) -(y) tokens to the same result", () => {
        expect(parseRemovalNames("-(Marinara) -(Onion)")).toEqual(["Marinara", "Onion"]);
    });

    it("round-trips build -> parse including names with spaces (new grammar)", () => {
        const tokens = buildRemovalTokens([onion, olives]);

        expect(parseRemovalNames(tokens)).toEqual(["Red Onion", "Olives"]);
    });
});

describe("stripRemovalTokens — strips both new grouped and legacy per-item tokens", () => {
    it("strips a new grouped token without touching the rest of the description", () => {
        const desc = "+Thin (garlic crust +Mushrooms) -(Red Onion, Olives) +extra crispy";

        expect(stripRemovalTokens(desc)).toBe("+Thin (garlic crust +Mushrooms) +extra crispy");
    });

    it("strips legacy per-item tokens without touching the rest of the description", () => {
        const desc = "+Thin (garlic crust +Mushrooms) -(Red Onion) -(Olives) +extra crispy";

        expect(stripRemovalTokens(desc)).toBe("+Thin (garlic crust +Mushrooms) +extra crispy");
    });

    it("leaves token-free descriptions unchanged apart from trimming", () => {
        expect(stripRemovalTokens("+Thin (garlic crust)")).toBe("+Thin (garlic crust)");
    });
});

describe("removedFromCustomizations / toRemoveCustomizations", () => {
    it("extracts only REMOVE entries with component ids", () => {
        const customizations: Customization[] = [
            { action: "REMOVE", componentId: 7, name: "Red Onion" },
            { action: "ADD", toppingId: 3, name: "Ranch" },
            { action: "REMOVE", componentId: null, name: "broken" },
        ];

        expect(removedFromCustomizations(customizations)).toEqual([{ id: 7, name: "Red Onion" }]);
        expect(removedFromCustomizations(undefined)).toEqual([]);
    });

    it("builds REMOVE customizations from removal state", () => {
        expect(toRemoveCustomizations([onion])).toEqual([
            { action: "REMOVE", componentId: 7, quantity: 1, name: "Red Onion" },
        ]);
    });
});

describe("extras helpers", () => {
    it("extracts added extra names from customizations", () => {
        const customizations: Customization[] = [
            { action: "ADD", extraIngrId: 4, name: "Mushrooms" },
            { action: "ADD", toppingId: 3, name: "Ranch" },
            { action: "REMOVE", componentId: 7, name: "Red Onion" },
        ];

        expect(extrasFromCustomizations(customizations)).toEqual(["Mushrooms"]);
        expect(extrasFromCustomizations(undefined)).toEqual([]);
    });

    it("parses names out of the new grouped +(a, b) group", () => {
        const desc = "+(Mushroom, Olives), call me (late), -(Red Onion)";

        expect(parseExtrasNames(desc)).toEqual(["Mushroom", "Olives"]);
    });

    it("parses names out of the legacy (+X +Y) group", () => {
        const desc = "(+Mushrooms +Extra Cheese), call me (late), -(Red Onion)";

        expect(parseExtrasNames(desc)).toEqual(["Mushrooms", "Extra Cheese"]);
    });

    it("strips the new grouped +(a, b) group but keeps customer parens", () => {
        const desc = "+(Mushroom, Olives), call me (late)";

        expect(stripExtrasParts(desc)).toBe("call me (late)");
    });

    it("strips the legacy (+X +Y) group but keeps customer parens", () => {
        const desc = "(+Mushrooms +Extra Cheese), call me (late)";

        expect(stripExtrasParts(desc)).toBe("call me (late)");
    });
});

describe("sameRemovals", () => {
    it("treats different removal sets as different", () => {
        const a: Customization[] = [{ action: "REMOVE", componentId: 7 }];
        const b: Customization[] = [{ action: "REMOVE", componentId: 9 }];

        expect(sameRemovals(a, b)).toBe(false);
    });

    it("ignores order and ADD entries", () => {
        const a: Customization[] = [
            { action: "REMOVE", componentId: 7 },
            { action: "REMOVE", componentId: 9 },
            { action: "ADD", toppingId: 1 },
        ];
        const b: Customization[] = [
            { action: "REMOVE", componentId: 9 },
            { action: "REMOVE", componentId: 7 },
        ];

        expect(sameRemovals(a, b)).toBe(true);
        expect(sameRemovals(undefined, [])).toBe(true);
    });
});

describe("intersectRemovals / matchRemovalNames", () => {
    const recipe: RecipeComponent[] = [
        { id: 7, name: "Red Onion", deletable: true },
        { id: 8, name: "Dough", deletable: false },
    ];

    it("keeps only removals whose component exists in the recipe", () => {
        expect(intersectRemovals([onion, olives], recipe)).toEqual([onion]);
    });

    it("matches legacy token names case-insensitively against the recipe", () => {
        expect(matchRemovalNames(["red onion", "Unknown"], recipe)).toEqual([
            { id: 7, name: "Red Onion" },
        ]);
    });
});
