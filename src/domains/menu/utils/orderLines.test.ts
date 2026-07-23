import { describe, it, expect } from "@jest/globals";
import { buildTicketLines, resolveKitchenNote } from "./orderLines";
import type { TicketSource } from "./orderLines";
import type { Customization } from "../types";

describe("buildTicketLines — empty source", () => {
    it("returns an empty array when nothing is set", () => {
        expect(buildTicketLines({})).toEqual([]);
    });

    it("returns an empty array for an empty customizations array and no description", () => {
        const source: TicketSource = { customizations: [] };

        expect(buildTicketLines(source)).toEqual([]);
    });
});

describe("buildTicketLines — dough/crust flags", () => {
    it("emits '+ Thin Dough' when isThinDough is true", () => {
        expect(buildTicketLines({ isThinDough: true })).toEqual(["+ Thin Dough"]);
    });

    it("emits '+ Garlic Crust' when isGarlicCrust is true", () => {
        expect(buildTicketLines({ isGarlicCrust: true })).toEqual(["+ Garlic Crust"]);
    });

    it("emits dough before crust, first in the row list, ahead of structured customizations", () => {
        const customizations: Customization[] = [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }];

        expect(buildTicketLines({ isThinDough: true, isGarlicCrust: true, customizations })).toEqual([
            "+ Thin Dough",
            "+ Garlic Crust",
            "+ Mushroom",
        ]);
    });

    it("emits nothing for dough/crust when both flags are false", () => {
        expect(buildTicketLines({ isThinDough: false, isGarlicCrust: false })).toEqual([]);
    });
});

describe("buildTicketLines — structured customizations", () => {
    it("renders an ADD topping row with the ' Topping' suffix", () => {
        const customizations: Customization[] = [{ action: "ADD", toppingId: 900, name: "Garlic" }];

        expect(buildTicketLines({ customizations })).toEqual(["+ Garlic Topping"]);
    });

    it("renders an ADD extra-ingredient row without a suffix", () => {
        const customizations: Customization[] = [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }];

        expect(buildTicketLines({ customizations })).toEqual(["+ Mushroom"]);
    });

    it("renders a REMOVE row as '- NO {name}'", () => {
        const customizations: Customization[] = [{ action: "REMOVE", componentId: 7, name: "Onion" }];

        expect(buildTicketLines({ customizations })).toEqual(["- NO Onion"]);
    });

    it("preserves array order across mixed ADD topping / ADD extra / REMOVE rows", () => {
        const customizations: Customization[] = [
            { action: "REMOVE", componentId: 7, name: "Onion" },
            { action: "ADD", extraIngrId: 5, name: "Mushroom" },
            { action: "ADD", toppingId: 900, name: "Garlic" },
        ];

        expect(buildTicketLines({ customizations })).toEqual([
            "- NO Onion",
            "+ Mushroom",
            "+ Garlic Topping",
        ]);
    });

    it("does not fall back to the legacy description parser when customizations is a non-empty array", () => {
        const customizations: Customization[] = [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }];

        expect(buildTicketLines({ customizations, description: "+(Olives) -(Basil)" })).toEqual(["+ Mushroom"]);
    });
});

describe("buildTicketLines — legacy description fallback (new grouped grammar)", () => {
    it("emits one row per addition/removal name from '+(a, b) -(x)', preserving parser order", () => {
        const source: TicketSource = { description: "+(Mushroom, Garlic Topping) -(Onion)" };

        expect(buildTicketLines(source)).toEqual(["+ Mushroom", "+ Garlic Topping", "- NO Onion"]);
    });

    it("falls back to the description parsers when customizations is present but empty", () => {
        const source: TicketSource = { customizations: [], description: "+(Mushroom) -(Onion)" };

        expect(buildTicketLines(source)).toEqual(["+ Mushroom", "- NO Onion"]);
    });

    it("does not emit a dough row from a bare '+Thin' token in the description", () => {
        const source: TicketSource = { description: "+Thin +(Mushroom)" };

        expect(buildTicketLines(source)).toEqual(["+ Mushroom"]);
    });
});

describe("buildTicketLines — legacy description fallback (old grammar)", () => {
    it("parses the old '(+X +Y)' addition grammar into one row per name", () => {
        const source: TicketSource = { description: "(+Mushroom +Olives)" };

        expect(buildTicketLines(source)).toEqual(["+ Mushroom", "+ Olives"]);
    });

    it("combines the old addition grammar with a removal group", () => {
        const source: TicketSource = { description: "(+Mushroom) -(Onion)" };

        expect(buildTicketLines(source)).toEqual(["+ Mushroom", "- NO Onion"]);
    });
});

describe("resolveKitchenNote — precedence", () => {
    it("prefers noteTranslated when non-blank", () => {
        expect(
            resolveKitchenNote({ noteTranslated: "extra crispy", note: "raw note", description: "+extra note" })
        ).toBe("extra crispy");
    });

    it("falls back to note when noteTranslated is blank", () => {
        expect(resolveKitchenNote({ noteTranslated: "   ", note: "raw note" })).toBe("raw note");
    });

    it("falls back to note when noteTranslated is undefined", () => {
        expect(resolveKitchenNote({ note: "raw note" })).toBe("raw note");
    });

    it("falls back to splitNote(description).noteText when neither note field is set", () => {
        expect(resolveKitchenNote({ description: "+(Mushroom) +extra crispy" })).toBe("extra crispy");
    });

    it("returns an empty string when nothing applies", () => {
        expect(resolveKitchenNote({})).toBe("");
    });

    it("returns an empty string when note/noteTranslated are blank and description has no note text", () => {
        expect(resolveKitchenNote({ note: "", noteTranslated: "", description: "+(Mushroom)" })).toBe("");
    });
});
