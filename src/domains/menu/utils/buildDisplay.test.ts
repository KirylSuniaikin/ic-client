import { describe, it, expect } from "@jest/globals";
import { buildDisplay } from "./buildDisplay";
import type { BuildDisplayMenuData, DisplaySource } from "./buildDisplay";
import type { Customization, ExtraIngr, MenuItem, Topping } from "../types";

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
    return {
        id: 1,
        name: "Margherita",
        category: "Pizzas",
        size: "M",
        price: 3,
        available: true,
        is_best_seller: false,
        photo: "",
        description: "",
        recipe_components: [],
        ...overrides,
    };
}

const EMPTY_MENU: BuildDisplayMenuData = {
    toppings: [],
    extras: [],
    menuItems: [],
    doughLabels: {},
};

describe("buildDisplay — empty source", () => {
    it("returns an empty string when no customizations/dough/crust are set", () => {
        expect(buildDisplay({}, EMPTY_MENU, false)).toBe("");
    });

    it("returns an empty string for an empty customizations array", () => {
        const source: DisplaySource = { customizations: [] };

        expect(buildDisplay(source, EMPTY_MENU, false)).toBe("");
    });
});

describe("buildDisplay — dough/crust tokens", () => {
    it("emits the Thin Dough token (localized via doughLabels) when isThinDough is true", () => {
        const menu: BuildDisplayMenuData = { ...EMPTY_MENU, doughLabels: { "Thin Dough": "Thin Dough (localized)" } };

        expect(buildDisplay({ isThinDough: true }, menu, false)).toBe("+Thin Dough (localized)");
    });

    it("emits the Garlic Crust token (localized via doughLabels) when isGarlicCrust is true", () => {
        const menu: BuildDisplayMenuData = { ...EMPTY_MENU, doughLabels: { "Garlic Crust": "Garlic Crust (localized)" } };

        expect(buildDisplay({ isGarlicCrust: true }, menu, false)).toBe("+Garlic Crust (localized)");
    });

    it("falls back to the raw English value when doughLabels has no entry for the key", () => {
        expect(buildDisplay({ isThinDough: true }, EMPTY_MENU, false)).toBe("+Thin Dough");
    });

    it("emits both dough and crust tokens, dough first, when both flags are set", () => {
        const menu: BuildDisplayMenuData = {
            ...EMPTY_MENU,
            doughLabels: { "Thin Dough": "Thin Dough", "Garlic Crust": "Garlic Crust" },
        };

        expect(buildDisplay({ isThinDough: true, isGarlicCrust: true }, menu, false)).toBe("+Thin Dough +Garlic Crust");
    });

    it("emits nothing for dough/crust when both flags are false", () => {
        expect(buildDisplay({ isThinDough: false, isGarlicCrust: false }, EMPTY_MENU, false)).toBe("");
    });
});

describe("buildDisplay — ADD toppingId (drizzle), localized name + ' Topping' suffix", () => {
    const menu: BuildDisplayMenuData = {
        ...EMPTY_MENU,
        toppings: [{ id: 900, name: "Garlic", name_ar: "ثوم" } as Topping],
    };

    it("uses the row's own English name snapshot in English mode (ignores the catalog name)", () => {
        const customizations: Customization[] = [{ action: "ADD", toppingId: 900, name: "Garlic" }];

        expect(buildDisplay({ customizations }, menu, false)).toBe("+(Garlic Topping)");
    });

    it("resolves the catalog's name_ar by id in Arabic mode", () => {
        const customizations: Customization[] = [{ action: "ADD", toppingId: 900, name: "Garlic" }];

        expect(buildDisplay({ customizations }, menu, true)).toBe("+(ثوم Topping)");
    });

    it("falls back to the row's name snapshot in Arabic mode when the catalog entry has no name_ar", () => {
        const menuNoAr: BuildDisplayMenuData = {
            ...EMPTY_MENU,
            toppings: [{ id: 901, name: "Chili Oil" } as Topping],
        };
        const customizations: Customization[] = [{ action: "ADD", toppingId: 901, name: "Chili Oil" }];

        expect(buildDisplay({ customizations }, menuNoAr, true)).toBe("+(Chili Oil Topping)");
    });

    it("falls back to the row's name snapshot in Arabic mode when the toppingId is not in the current menu", () => {
        const customizations: Customization[] = [{ action: "ADD", toppingId: 12345, name: "Discontinued Drizzle" }];

        expect(buildDisplay({ customizations }, menu, true)).toBe("+(Discontinued Drizzle Topping)");
    });

    it("keeps the ' Topping' suffix when combined with a regular extra in the same additions group", () => {
        const menuWithExtras: BuildDisplayMenuData = {
            ...menu,
            extras: [{ id: 5, name: "Mushroom" } as ExtraIngr],
        };
        const customizations: Customization[] = [
            { action: "ADD", extraIngrId: 5, name: "Mushroom" },
            { action: "ADD", toppingId: 900, name: "Garlic" },
        ];

        expect(buildDisplay({ customizations }, menuWithExtras, false)).toBe("+(Mushroom, Garlic Topping)");
    });
});

describe("buildDisplay — ADD extraIngrId, localized name (no suffix)", () => {
    const menu: BuildDisplayMenuData = {
        ...EMPTY_MENU,
        extras: [{ id: 5, name: "Mushroom", name_ar: "فطر" } as ExtraIngr],
    };

    it("uses the row's own English name snapshot in English mode", () => {
        const customizations: Customization[] = [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }];

        expect(buildDisplay({ customizations }, menu, false)).toBe("+(Mushroom)");
    });

    it("resolves the catalog's name_ar by id in Arabic mode", () => {
        const customizations: Customization[] = [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }];

        expect(buildDisplay({ customizations }, menu, true)).toBe("+(فطر)");
    });

    it("falls back to the row's name snapshot in Arabic mode when the extraIngrId is not in the current menu", () => {
        const customizations: Customization[] = [{ action: "ADD", extraIngrId: 99999, name: "Discontinued Extra" }];

        expect(buildDisplay({ customizations }, menu, true)).toBe("+(Discontinued Extra)");
    });

    it("builds a multi-name group joined with a comma", () => {
        const menuTwoExtras: BuildDisplayMenuData = {
            ...EMPTY_MENU,
            extras: [
                { id: 5, name: "Mushroom" } as ExtraIngr,
                { id: 6, name: "Olives" } as ExtraIngr,
            ],
        };
        const customizations: Customization[] = [
            { action: "ADD", extraIngrId: 5, name: "Mushroom" },
            { action: "ADD", extraIngrId: 6, name: "Olives" },
        ];

        expect(buildDisplay({ customizations }, menuTwoExtras, false)).toBe("+(Mushroom, Olives)");
    });
});

describe("buildDisplay — REMOVE componentId, localized label", () => {
    const menu: BuildDisplayMenuData = {
        ...EMPTY_MENU,
        menuItems: [
            makeMenuItem({
                recipe_components: [
                    { id: 7, name: "Red Onion", deletable: true, label: "Onion", label_ar: "بصل" },
                    { id: 8, name: "Basil Leaf", deletable: true, label: "Basil" },
                    { id: 9, name: "Dough Base", deletable: false },
                ],
            }),
        ],
    };

    it("uses the component's label in English mode", () => {
        const customizations: Customization[] = [{ action: "REMOVE", componentId: 7, name: "Red Onion" }];

        expect(buildDisplay({ customizations }, menu, false)).toBe("-(Onion)");
    });

    it("uses label_ar in Arabic mode", () => {
        const customizations: Customization[] = [{ action: "REMOVE", componentId: 7, name: "Red Onion" }];

        expect(buildDisplay({ customizations }, menu, true)).toBe("-(بصل)");
    });

    it("falls back to label when label_ar is unset and the locale is Arabic", () => {
        const customizations: Customization[] = [{ action: "REMOVE", componentId: 8, name: "Basil Leaf" }];

        expect(buildDisplay({ customizations }, menu, true)).toBe("-(Basil)");
    });

    it("falls back to the row's name snapshot when neither label nor label_ar is set", () => {
        const customizations: Customization[] = [{ action: "REMOVE", componentId: 9, name: "Dough Base" }];

        expect(buildDisplay({ customizations }, menu, false)).toBe("-(Dough Base)");
    });

    it("falls back to the row's name snapshot when the componentId is not in the current menu", () => {
        const customizations: Customization[] = [{ action: "REMOVE", componentId: 424242, name: "Vanished Component" }];

        expect(buildDisplay({ customizations }, menu, false)).toBe("-(Vanished Component)");
        expect(buildDisplay({ customizations }, menu, true)).toBe("-(Vanished Component)");
    });

    it("builds a multi-name removal group joined with a comma", () => {
        const customizations: Customization[] = [
            { action: "REMOVE", componentId: 7, name: "Red Onion" },
            { action: "REMOVE", componentId: 8, name: "Basil Leaf" },
        ];

        expect(buildDisplay({ customizations }, menu, false)).toBe("-(Onion, Basil)");
    });

    it("ignores a REMOVE row with a null componentId", () => {
        const customizations: Customization[] = [{ action: "REMOVE", componentId: null, name: "Broken Row" }];

        expect(buildDisplay({ customizations }, menu, false)).toBe("");
    });
});

describe("buildDisplay — combined dough + additions + removals ordering", () => {
    it("orders dough token(s), then the additions group, then the removals group, space-separated", () => {
        const menu: BuildDisplayMenuData = {
            toppings: [],
            extras: [{ id: 5, name: "Mushroom" } as ExtraIngr],
            menuItems: [makeMenuItem({ recipe_components: [{ id: 7, name: "Red Onion", deletable: true }] })],
            doughLabels: { "Thin Dough": "Thin Dough" },
        };
        const customizations: Customization[] = [
            { action: "ADD", extraIngrId: 5, name: "Mushroom" },
            { action: "REMOVE", componentId: 7, name: "Red Onion" },
        ];

        expect(buildDisplay({ isThinDough: true, customizations }, menu, false)).toBe(
            "+Thin Dough +(Mushroom) -(Red Onion)"
        );
    });
});
