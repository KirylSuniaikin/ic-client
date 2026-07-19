import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// PizzaComboPopup renders its copy (drizzles heading, Add button) via useTranslation("menu") —
// initialize the real i18n instance (side-effect import) so keys resolve to English, mirroring
// PickUpReminderPopup.test.tsx / RecipeComponentsLine.test.tsx.
import "../../../../../shared/i18n";

import { PizzaComboPopup } from "./PizzaComboPopup";
import type {
    CartItem,
    ComboItem,
    Customization,
    ExtraIngr,
    Group,
    MenuItem,
    Topping,
} from "../../../types";

// The topping/extra-ingredient catalogs carry a `price` (and extras also carry a `size`) at
// runtime that the shared Topping/ExtraIngr types omit — see the "the backend has always sent
// the id; the type just omitted it" comments in menu/types.ts. PizzaComboPopup itself reads
// these fields via `as unknown as Record<string, number>`, so the fixtures below mirror that
// same runtime shape and are cast the same way when passed as props.
type ToppingFixture = Topping & { photo: string; price: number; available: boolean };
type ExtraIngrFixture = ExtraIngr & { size: string; price: number };

function makeTopping(overrides: Partial<ToppingFixture> = {}): ToppingFixture {
    return { id: 900, name: "Garlic", photo: "", price: 0.75, available: true, ...overrides };
}

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

const PIZZA_M = makeMenuItem();
const PIZZA_L = makeMenuItem({ size: "L", price: 4.5 });
const PIZZAS: Group[] = [{ name: "Pizzas", items: [PIZZA_M, PIZZA_L] }];

const DRINK = makeMenuItem({ id: 2, name: "Cola", category: "Beverages", size: "", price: 0.5, recipe_components: undefined });
const SAUCE = makeMenuItem({ id: 3, name: "Ranch", category: "Sauces", size: "", price: 0.3, recipe_components: undefined });
const DRINKS: Group[] = [{ name: "Beverages", items: [DRINK] }];
const SAUCES: Group[] = [{ name: "Sauces", items: [SAUCE] }];

const COMBO_GROUP: MenuItem[] = [
    makeMenuItem({ id: 10, name: "Pizza Combo", category: "Combo Deals", size: "M", price: 6, recipe_components: undefined }),
    makeMenuItem({ id: 11, name: "Pizza Combo", category: "Combo Deals", size: "L", price: 8, recipe_components: undefined }),
];

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
    return {
        id: 1,
        name: "Margherita",
        size: "M",
        category: "Pizzas",
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

function makeComboEditItem(overrides: {
    pizzaDescription?: string;
    pizzaCustomizations?: Customization[];
} = {}): CartItem {
    const comboItems: ComboItem[] = [
        {
            id: PIZZA_M.id,
            category: "Pizzas",
            name: PIZZA_M.name,
            size: "M",
            isGarlicCrust: false,
            isThinDough: false,
            description: overrides.pizzaDescription ?? "",
            quantity: 1,
            customizations: overrides.pizzaCustomizations ?? [],
        },
        { id: DRINK.id, category: "Beverages", name: DRINK.name, size: "", isGarlicCrust: false, isThinDough: false, description: "", quantity: 1 },
        { id: SAUCE.id, category: "Sauces", name: SAUCE.name, size: "", isGarlicCrust: false, isThinDough: false, description: "", quantity: 1 },
    ];
    return makeCartItem({
        id: 10,
        name: "Pizza Combo",
        category: "Combo Deals",
        size: "M",
        amount: 6,
        comboItems,
    });
}

interface RenderOverrides {
    toppings?: ToppingFixture[];
    extraIngredients?: ExtraIngrFixture[];
    selectedPizza?: CartItem | null;
    editItem?: CartItem | null;
    isEditMode?: boolean;
}

function renderPopup(overrides: RenderOverrides = {}) {
    const onAddToCart = jest.fn<void, [CartItem]>();
    const onClose = jest.fn<void, []>();
    const toppings = overrides.toppings ?? [makeTopping()];
    const extraIngredients = overrides.extraIngredients ?? [];

    render(
        <PizzaComboPopup
            open
            onClose={onClose}
            comboGroup={COMBO_GROUP}
            pizzas={PIZZAS}
            drinks={DRINKS}
            sauces={SAUCES}
            onAddToCart={onAddToCart}
            selectedPizza={overrides.selectedPizza}
            editItem={overrides.editItem}
            isEditMode={overrides.isEditMode}
            isSDoughAvailable={false}
            extraIngredients={extraIngredients as unknown as ExtraIngr[]}
            toppings={toppings as unknown as Topping[]}
        />,
    );

    return { onAddToCart, onClose };
}

function clickAdd(): void {
    fireEvent.click(screen.getByRole("button", { name: /^Add ·/ }));
}

describe("PizzaComboPopup — selecting a drizzle", () => {
    it("folds a selected drizzle into comboItems[0].description as a '+(Name Topping)' addition and into customizations as an ADD toppingId", () => {
        const { onAddToCart } = renderPopup();

        fireEvent.click(screen.getByText("Garlic"));
        clickAdd();

        expect(onAddToCart).toHaveBeenCalledTimes(1);
        const added = onAddToCart.mock.calls[0][0];

        expect(added.comboItems?.[0]?.description).toBe("+(Garlic Topping)");
        expect(added.comboItems?.[0]?.customizations).toContainEqual(
            expect.objectContaining({ action: "ADD", toppingId: 900, name: "Garlic" }),
        );
    });

    it("does not select any drizzle by default (no toppingId ADD customization) when nothing is tapped", () => {
        const { onAddToCart } = renderPopup();

        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.description).toBe("");
        expect(
            (added.comboItems?.[0]?.customizations ?? []).some(c => c.action === "ADD" && c.toppingId != null),
        ).toBe(false);
    });
});

describe("PizzaComboPopup — upsell carry-over", () => {
    it("carries a standalone pizza's drizzle into the combo's built comboItems[0] without re-tapping it", () => {
        // selectedPizza.toppings carries plain name strings at runtime (same convention the
        // component's own selectedToppings initializer documents for selectedPizza.toppings /
        // selectedPizza.extraIngredients) — the CartItem type says Topping[], but the popup
        // reads it as string[].
        const standalonePizza = makeCartItem({
            name: "Margherita",
            size: "M",
            category: "Pizzas",
            toppings: (["Garlic"] as unknown) as Topping[],
        });

        const { onAddToCart } = renderPopup({ selectedPizza: standalonePizza });

        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.description).toContain("Garlic Topping");
        expect(added.comboItems?.[0]?.customizations).toContainEqual(
            expect.objectContaining({ action: "ADD", toppingId: 900, name: "Garlic" }),
        );
    });

    it("drops a carried-over drizzle name that is not in the combo's topping catalog", () => {
        const standalonePizza = makeCartItem({
            toppings: (["Truffle Oil"] as unknown) as Topping[], // not in the fixture catalog
        });

        const { onAddToCart } = renderPopup({ selectedPizza: standalonePizza });

        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.description).toBe("");
    });
});

describe("PizzaComboPopup — edit-mode rehydration", () => {
    it("re-selects a drizzle from a structural toppingId ADD customization on comboItems[0]", () => {
        const editItem = makeComboEditItem({
            pizzaDescription: "+(Garlic Topping)",
            pizzaCustomizations: [{ action: "ADD", toppingId: 900, quantity: 1, name: "Garlic" }],
        });

        const { onAddToCart } = renderPopup({ isEditMode: true, editItem });

        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.description).toBe("+(Garlic Topping)");
        expect(added.comboItems?.[0]?.customizations).toContainEqual(
            expect.objectContaining({ action: "ADD", toppingId: 900, name: "Garlic" }),
        );
    });

    it("falls back to parsing the drizzle name out of the legacy '+(...)' addition group when there is no structural toppingId ADD", () => {
        const editItem = makeComboEditItem({
            pizzaDescription: "+(Garlic Topping)",
            pizzaCustomizations: [], // legacy line: no structured customizations at all
        });

        const { onAddToCart } = renderPopup({ isEditMode: true, editItem });

        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.description).toBe("+(Garlic Topping)");
        expect(added.comboItems?.[0]?.customizations).toContainEqual(
            expect.objectContaining({ action: "ADD", toppingId: 900, name: "Garlic" }),
        );
    });
});

// Task RW: the combo pizza's free-text note is now its own field (comboItems[0].note),
// never folded into comboItems[0].description.
describe("PizzaComboPopup — combo child note is its own field (task RW)", () => {
    it("puts a typed note on comboItems[0].note and keeps it out of comboItems[0].description", () => {
        const { onAddToCart } = renderPopup();

        fireEvent.change(screen.getByLabelText("Add a note"), {
            target: { value: "cut into 4 slices" },
        });
        fireEvent.click(screen.getByText("Garlic"));
        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.note).toBe("cut into 4 slices");
        expect(added.comboItems?.[0]?.description).toBe("+(Garlic Topping)");
        expect(added.comboItems?.[0]?.description).not.toContain("cut into 4 slices");
    });

    it("defaults comboItems[0].note to an empty string when nothing is typed", () => {
        const { onAddToCart } = renderPopup();

        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.note).toBe("");
    });

    it("rehydrates the note textfield from comboItems[0].note in edit mode and preserves it unchanged on re-add", () => {
        const editItem = makeComboEditItem({ pizzaDescription: "" });
        editItem.comboItems![0].note = "no ice in the drink please";

        const { onAddToCart } = renderPopup({ isEditMode: true, editItem });

        expect((screen.getByLabelText("Add a note") as HTMLTextAreaElement).value).toBe("no ice in the drink please");

        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.comboItems?.[0]?.note).toBe("no ice in the drink please");
    });
});

describe("PizzaComboPopup — pricing", () => {
    it("adds a selected paid drizzle's price into the final combo price (button label reflects it before Add is tapped)", () => {
        renderPopup({ toppings: [makeTopping({ price: 0.75 })] });

        // Base M combo price is 6 (COMBO_GROUP) with nothing selected.
        expect(screen.getByRole("button", { name: "Add · 6.00" })).toBeTruthy();

        fireEvent.click(screen.getByText("Garlic"));

        expect(screen.getByRole("button", { name: "Add · 6.75" })).toBeTruthy();
    });

    it("carries the raised price onto the cart item's amount when a paid drizzle is selected", () => {
        const { onAddToCart } = renderPopup({ toppings: [makeTopping({ price: 0.75 })] });

        fireEvent.click(screen.getByText("Garlic"));
        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.amount).toBe(6.75);
    });

    it("does not change the price for a free (0-price) drizzle", () => {
        const { onAddToCart } = renderPopup({ toppings: [makeTopping({ price: 0 })] });

        fireEvent.click(screen.getByText("Garlic"));
        clickAdd();

        const added = onAddToCart.mock.calls[0][0];
        expect(added.amount).toBe(6);
    });
});
