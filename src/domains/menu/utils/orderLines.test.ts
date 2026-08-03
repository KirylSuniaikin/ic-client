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

    it("does not emit a second crust row when isGarlicCrust also folds it into the description", () => {
        const source: TicketSource = { isGarlicCrust: true, description: "+(garlic crust, Mushroom)" };

        expect(buildTicketLines(source)).toEqual(["+ Garlic Crust", "+ Mushroom"]);
    });

    it("still emits a crust row from the description when the isGarlicCrust flag is not set (legacy data)", () => {
        const source: TicketSource = { description: "+(garlic crust, Mushroom)" };

        expect(buildTicketLines(source)).toEqual(["+ garlic crust", "+ Mushroom"]);
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

describe("buildTicketLines — loose description fallback (aggregator / pre-grammar orders)", () => {
    it("emits one row per comma-separated name for a Keeta description that matches no grammar", () => {
        const source: TicketSource = { description: "Cheddar x1, Darblu Cheese x1" };

        expect(buildTicketLines(source)).toEqual(["+ Cheddar", "+ Darblu Cheese"]);
    });

    it("keeps a count above one so the kitchen sees the quantity", () => {
        const source: TicketSource = { description: "Cheddar x2" };

        expect(buildTicketLines(source)).toEqual(["+ Cheddar x2"]);
    });

    it("does not repeat dough/crust rows the flags already emitted", () => {
        const source: TicketSource = {
            isThinDough: true,
            isGarlicCrust: true,
            description: "Cheddar x1, Thin, Garlic",
        };

        expect(buildTicketLines(source)).toEqual(["+ Thin Dough", "+ Garlic Crust", "+ Cheddar"]);
    });

    it("still emits dough/crust names from the description when the flags are not set (legacy data)", () => {
        const source: TicketSource = { description: "Cheddar x1, Thin, Garlic" };

        expect(buildTicketLines(source)).toEqual(["+ Cheddar", "+ Thin", "+ Garlic"]);
    });

    it("emits nothing when the description holds only the free-text note", () => {
        const source: TicketSource = { description: "+extra napkins", note: "extra napkins" };

        expect(buildTicketLines(source)).toEqual([]);
    });

    it("drops a token that duplicates the resolved kitchen note", () => {
        const source: TicketSource = { description: "Cheddar x1, extra napkins", note: "extra napkins" };

        expect(buildTicketLines(source)).toEqual(["+ Cheddar"]);
    });

    it("emits only the dough row for a bare '+Thin' description when the flag is set", () => {
        const source: TicketSource = { isThinDough: true, description: "+Thin" };

        expect(buildTicketLines(source)).toEqual(["+ Thin Dough"]);
    });

    it("does not fire when the grammar parsers already produced rows", () => {
        const source: TicketSource = { description: "+(Mushroom) trailing junk" };

        expect(buildTicketLines(source)).toEqual(["+ Mushroom"]);
    });

    it("does not fire when structured customizations are present", () => {
        const customizations: Customization[] = [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }];
        const source: TicketSource = { customizations, description: "Cheddar x1, Darblu Cheese x1" };

        expect(buildTicketLines(source)).toEqual(["+ Mushroom"]);
    });
});

describe("buildTicketLines — Keeta scraper output", () => {
    // Exact description the scraper emits for a medium Four Cheese with garlic crust, thin dough,
    // one Cheddar, two Darblu Cheese and the remark "extra napkins" (verified by dry-running
    // parse_order_items against a real Keeta product). Guards the contract between the two repos.
    const KEETA_DESCRIPTION = "+(Cheddar, Darblu Cheese x2) +extra napkins";

    it("renders the modifiers through the grammar tier, not the loose tier", () => {
        const source: TicketSource = {
            isThinDough: true,
            isGarlicCrust: true,
            description: KEETA_DESCRIPTION,
        };

        expect(buildTicketLines(source)).toEqual([
            "+ Thin Dough",
            "+ Garlic Crust",
            "+ Cheddar",
            "+ Darblu Cheese x2",
        ]);
    });

    it("surfaces the customer remark as the kitchen note", () => {
        expect(resolveKitchenNote({ description: KEETA_DESCRIPTION })).toBe("extra napkins");
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
