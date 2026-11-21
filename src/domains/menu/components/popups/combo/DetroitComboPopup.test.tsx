import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import "../../../../../shared/i18n";

import { DetroitComboPopup } from "./DetroitComboPopup";
import { clearMatchMedia, stubMatchMedia } from "../../../../../shared/hooks/stubMatchMedia.testutil";
import type { CartItem, ComboItem, Group, MenuItem } from "../../../types";

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
    return {
        id: 1, name: "Pepperoni Brick", category: "Brick Pizzas", size: "", price: 5,
        available: true, is_best_seller: false, photo: "", description: "",
        recipe_components: [], ...overrides,
    };
}

const BRICK = makeMenuItem();
const BRICK_2 = makeMenuItem({ id: 4, name: "Cheese Brick" });
const DRINK = makeMenuItem({ id: 2, name: "Cola", category: "Beverages", recipe_components: undefined });
const DRINK_2 = makeMenuItem({ id: 5, name: "Fanta", category: "Beverages", recipe_components: undefined });
const SAUCE = makeMenuItem({ id: 3, name: "Ranch", category: "Sauces", recipe_components: undefined });
const SAUCE_2 = makeMenuItem({ id: 6, name: "Garlic", category: "Sauces", recipe_components: undefined });
const BRICKS: Group[] = [{ name: "Brick Pizzas", items: [BRICK, BRICK_2] }];
const DRINKS: Group[] = [{ name: "Beverages", items: [DRINK, DRINK_2] }];
const SAUCES: Group[] = [{ name: "Sauces", items: [SAUCE, SAUCE_2] }];
const COMBO: MenuItem[] = [makeMenuItem({ id: 20, name: "Detroit Combo", category: "Combo Deals", recipe_components: undefined })];

function makeComboItem(name: string, category: string): ComboItem {
    return {
        id: 1, name, category, size: "", isThinDough: false, isGarlicCrust: false,
        description: "", quantity: 1,
    };
}

function makeEditItem(comboItems: ComboItem[] | null): CartItem {
    return {
        id: 20, name: "Detroit Combo", size: "", category: "Combo Deals", isThinDough: false,
        isGarlicCrust: false, extraIngredients: [], toppings: [], note: "", quantity: 1,
        description: "", amount: 10, discountAmount: 0, comboItems, photo: "",
    };
}

function renderEdit(editItem: CartItem): void {
    render(
        <DetroitComboPopup
            open
            onClose={jest.fn()}
            combo={COMBO}
            bricks={BRICKS}
            drinks={DRINKS}
            sauces={SAUCES}
            onAddToCart={jest.fn()}
            editItem={editItem}
            isEditMode
        />
    );
}

describe("DetroitComboPopup — edit mode with missing combo items", () => {
    it("renders without throwing for comboItems: []", () => {
        expect(() => renderEdit(makeEditItem([]))).not.toThrow();
    });

    it("renders without throwing for comboItems: null", () => {
        expect(() => renderEdit(makeEditItem(null))).not.toThrow();
    });

    it("still pre-selects the edited brick, drink and sauce for a valid 3-line edit item", () => {
        renderEdit(makeEditItem([
            makeComboItem("Cheese Brick", "Brick Pizzas"),
            makeComboItem("Fanta", "Beverages"),
            makeComboItem("Garlic", "Sauces"),
        ]));
        const text = document.body.textContent ?? "";
        expect(text).toContain("Cheese Brick");
        expect(text).toContain("Fanta");
        expect(text).toContain("Garlic");
        expect(text).not.toContain("Pepperoni Brick");
    });
});

describe("DetroitComboPopup — PC layout", () => {
    afterEach(() => {
        clearMatchMedia();
    });

    it("still pre-selects the edited brick, drink and sauce in the PC dialog", () => {
        stubMatchMedia(true);
        renderEdit(makeEditItem([
            makeComboItem("Cheese Brick", "Brick Pizzas"),
            makeComboItem("Fanta", "Beverages"),
            makeComboItem("Garlic", "Sauces"),
        ]));

        expect(screen.getByTestId("item-popup-dialog")).toBeTruthy();
        const text = document.body.textContent ?? "";
        expect(text).toContain("Cheese Brick");
        expect(text).toContain("Fanta");
        expect(text).toContain("Garlic");
        expect(text).not.toContain("Pepperoni Brick");
    });
});

describe("DetroitComboPopup — text-only mode (staff order edit)", () => {
    it("renders no pictures for the combo, its brick, drink and sauce, nor in the Change picker", () => {
        render(
            <DetroitComboPopup
                open
                hidePhoto
                onClose={jest.fn()}
                combo={[{ ...COMBO[0], photo: "/detroit.png" }]}
                bricks={[{ name: "Brick Pizzas", items: [{ ...BRICK, photo: "/brick.png" }, BRICK_2] }]}
                drinks={[{ name: "Beverages", items: [{ ...DRINK, photo: "/cola.png" }, DRINK_2] }]}
                sauces={[{ name: "Sauces", items: [{ ...SAUCE, photo: "/ranch.png" }, SAUCE_2] }]}
                onAddToCart={jest.fn()}
            />
        );
        expect(document.body.querySelectorAll("img")).toHaveLength(0);

        fireEvent.click(screen.getAllByRole("button", { name: "Change" })[0]);

        expect(screen.getAllByText("Cheese Brick").length).toBeGreaterThan(0);
        expect(document.body.querySelectorAll("img")).toHaveLength(0);
    });
});
