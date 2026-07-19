import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, within, act } from "@testing-library/react";

// CartItemHorizontal renders its copy (discount label, extras labels) via useTranslation("cart")
// and useOptionLabel (menu namespace) — initialize the real i18n instance so keys resolve,
// mirroring RecipeComponentsLine.test.tsx / useCheckout.test.ts.
import i18n, { DEFAULT_LANGUAGE } from "../../../shared/i18n";

import CartItemHorizontal from "./CartItemHorizontal";
import type { CartItem, ComboItem, ExtraIngr, MenuItem, Topping } from "../../menu/types";

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
        description: "Classic tomato and mozzarella",
        recipe_components: [],
        ...overrides,
    };
}

const NOOP_HANDLERS = {
    onChangeQuantity: jest.fn(),
    onChangeSize: jest.fn(),
    onRemoveItem: jest.fn(),
    openPizzaEditPopUp: jest.fn(),
    openPizzaComboEditPopup: jest.fn(),
    openDetroitComboEditPopup: jest.fn(),
    handleDiscountChange: jest.fn(),
};

function renderLine(
    item: CartItem,
    options: { menuData?: MenuItem[]; toppings?: Topping[]; extras?: ExtraIngr[] } = {}
) {
    return render(
        <CartItemHorizontal
            item={item}
            isAdmin={false}
            menuData={options.menuData ?? []}
            toppings={options.toppings ?? []}
            extras={options.extras ?? []}
            {...NOOP_HANDLERS}
        />
    );
}

afterEach(async () => {
    // Reset the shared i18n singleton so a language change in one test doesn't leak into others.
    await act(async () => {
        await i18n.changeLanguage(DEFAULT_LANGUAGE);
    });
});

describe("CartItemHorizontal — structural display + note as a separate line (task RW)", () => {
    it("builds the ingredient text from customizations and renders the note as its own (separate) line, not inside the ingredient text", () => {
        const item = makeCartItem({
            description: "+(Mushroom)",
            note: "cut in triangles please",
            customizations: [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }],
        });

        renderLine(item, {
            menuData: [makeMenuItem({ description: "Classic recipe" })],
            extras: [{ id: 5, name: "Mushroom", name_ar: "فطر" }],
        });

        expect(screen.getByText(/Mushroom/)).toBeTruthy();
        expect(screen.getByText("cut in triangles please")).toBeTruthy();
        // The note text must not be embedded inside the ingredient-text node.
        expect(screen.getByText(/Mushroom/).textContent).not.toContain("cut in triangles please");
    });

    it("localizes the addition name via name_ar when the locale is Arabic (id lookup)", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });

        const item = makeCartItem({
            description: "+(Garlic Topping)",
            customizations: [{ action: "ADD", toppingId: 900, name: "Garlic" }],
        });

        renderLine(item, {
            menuData: [makeMenuItem({ description: "Classic recipe" })],
            toppings: [{ id: 900, name: "Garlic", name_ar: "ثوم" }],
        });

        expect(screen.getByText(/ثوم/)).toBeTruthy();
    });

    it("shows the stored description as-is (legacy fallback) when there are no customizations and no dough/crust flags", () => {
        const item = makeCartItem({
            description: "-(Onion) old-style legacy line",
            customizations: undefined,
            isThinDough: false,
            isGarlicCrust: false,
        });

        renderLine(item, { menuData: [makeMenuItem({ description: "A different base description" })] });

        expect(screen.getByText("-(Onion) old-style legacy line")).toBeTruthy();
    });

    it("routes a dough-only item (isThinDough true, zero customizations) through the structural builder, not the legacy fallback", () => {
        const item = makeCartItem({
            description: "LEGACY-RAW-TEXT-SHOULD-NOT-RENDER",
            customizations: [],
            isThinDough: true,
        });

        renderLine(item, { menuData: [makeMenuItem({ description: "A different base description" })] });

        expect(screen.queryByText("LEGACY-RAW-TEXT-SHOULD-NOT-RENDER")).toBeNull();
        expect(screen.getByText(/Thin Dough/)).toBeTruthy();
    });

    it("renders a combo child's structural ingredient text and its own note as a separate line", () => {
        const comboItems: ComboItem[] = [
            {
                id: 1,
                category: "Pizzas",
                name: "Margherita",
                size: "M",
                isGarlicCrust: false,
                isThinDough: false,
                description: "+(Mushroom)",
                note: "less cheese",
                quantity: 1,
                customizations: [{ action: "ADD", extraIngrId: 5, name: "Mushroom" }],
            },
            { id: 2, category: "Beverages", name: "Cola", size: "", isGarlicCrust: false, isThinDough: false, description: "", quantity: 1 },
            { id: 3, category: "Sauces", name: "Ranch", size: "", isGarlicCrust: false, isThinDough: false, description: "", quantity: 1 },
        ];
        const item = makeCartItem({
            id: 10,
            name: "Pizza Combo",
            category: "Combo Deals",
            comboItems,
            amount: 6,
        });

        const { container } = renderLine(item, { extras: [{ id: 5, name: "Mushroom" }] });

        expect(within(container).getByText(/Mushroom/)).toBeTruthy();
        expect(within(container).getByText("less cheese")).toBeTruthy();
    });

    // Regression test for the review-flagged bug: the combo-child branch used to push a
    // t("extras.thinDough")/t("extras.garlicCrust") badge AND THEN also render buildDisplay's
    // own dough/crust token, doubling the text (e.g. "+ Thin Dough + Thin Dough"). buildDisplay
    // must now be the sole source of that token, so it renders exactly once, in both languages.
    it("renders a thin-dough + garlic-crust combo child's dough/crust token exactly once (not doubled)", () => {
        const comboItems: ComboItem[] = [
            {
                id: 1,
                category: "Pizzas",
                name: "Margherita",
                size: "M",
                isGarlicCrust: true,
                isThinDough: true,
                description: "",
                quantity: 1,
                customizations: [],
            },
        ];
        const item = makeCartItem({
            id: 11,
            name: "Pizza Combo",
            category: "Combo Deals",
            comboItems,
            amount: 6,
        });

        const { container } = renderLine(item);

        const text = container.textContent ?? "";
        expect(text.match(/Thin Dough/g)?.length ?? 0).toBe(1);
        expect(text.match(/Garlic Crust/g)?.length ?? 0).toBe(1);
    });

    it("renders a thin-dough + garlic-crust combo child's dough/crust token exactly once in Arabic (not doubled, and not the mismatched cart.extras.* copy)", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });

        const comboItems: ComboItem[] = [
            {
                id: 1,
                category: "Pizzas",
                name: "Margherita",
                size: "M",
                isGarlicCrust: true,
                isThinDough: true,
                description: "",
                quantity: 1,
                customizations: [],
            },
        ];
        const item = makeCartItem({
            id: 12,
            name: "Pizza Combo",
            category: "Combo Deals",
            comboItems,
            amount: 6,
        });

        const { container } = renderLine(item);

        const text = container.textContent ?? "";
        // Canonical copy from menu.options (buildDisplay's source), not the old cart.extras.* badge.
        expect(text.match(/عجينة رفيعة/g)?.length ?? 0).toBe(1);
        expect(text.match(/حافة بالثوم/g)?.length ?? 0).toBe(1);
    });
});
