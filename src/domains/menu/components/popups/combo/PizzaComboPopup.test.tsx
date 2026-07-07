import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../../../../../shared/i18n";

jest.mock("../../../../../shared/api/public");

import { getQuickPicks } from "../../../../../shared/api/public";
import { PizzaComboPopup } from "./PizzaComboPopup";
import type { CartItem, Group, MenuItem, QuickPickDto } from "../../../types";

const mockGetQuickPicks = jest.mocked(getQuickPicks);

function makeItem(overrides: Partial<MenuItem>): MenuItem {
    return {
        available: true,
        category: "Combo Deals",
        description: "",
        id: 1,
        is_best_seller: false,
        name: "Item",
        photo: "photo.png",
        price: 5,
        size: "",
        ...overrides,
    };
}

const comboGroup: MenuItem[] = [
    makeItem({ id: 1, name: "Pizza Combo", size: "M", price: 5, available: true }),
    makeItem({ id: 2, name: "Pizza Combo", size: "L", price: 6, available: true }),
];

const pizzas: Group[] = [
    {
        name: "Pizzas",
        items: [
            makeItem({ id: 101, name: "Margherita", size: "M", category: "Pizzas", available: true }),
            makeItem({ id: 102, name: "Margherita", size: "L", category: "Pizzas", available: true }),
        ],
    },
];

const drinks: Group[] = [
    { name: "Drinks", items: [makeItem({ id: 301, name: "Cola", category: "Beverages" })] },
];

const sauces: Group[] = [
    { name: "Sauces", items: [makeItem({ id: 401, name: "Ranch", category: "Sauces" })] },
];

beforeEach(() => {
    mockGetQuickPicks.mockReset();
});

describe("PizzaComboPopup quick-pick wiring", () => {
    it("resets the quick-pick selection when the customized pizza's menu_item_id changes on size toggle", async () => {
        mockGetQuickPicks.mockImplementation((menuItemId: number) => {
            if (menuItemId === 101) {
                return Promise.resolve([{ id: 1, label: "Extra Cheese", labelAr: null, isPopular: false }]);
            }
            return Promise.resolve([]);
        });
        const onAddToCart = jest.fn<void, [CartItem]>();

        render(
            <PizzaComboPopup
                open={true}
                onClose={jest.fn()}
                comboGroup={comboGroup}
                pizzas={pizzas}
                drinks={drinks}
                sauces={sauces}
                onAddToCart={onAddToCart}
            />
        );

        const chip = await screen.findByText("Extra Cheese");
        fireEvent.click(chip);

        const lToggle = await screen.findByRole("button", { name: "L" });
        fireEvent.click(lToggle);

        await waitFor(() => expect(screen.queryByText("Extra Cheese")).toBeNull());

        const addButton = await screen.findByRole("button", { name: /Add ·/ });
        fireEvent.click(addButton);

        await waitFor(() => expect(onAddToCart).toHaveBeenCalled());
        const orderItem = onAddToCart.mock.calls[0][0];
        expect(orderItem.comboItems![0].description).not.toContain("Extra Cheese");
    });

    it("computes description from the typed note joined with the raw (non-starred) quick-pick label", async () => {
        mockGetQuickPicks.mockResolvedValueOnce([{ id: 1, label: "No Onion", labelAr: null, isPopular: true }]);
        const onAddToCart = jest.fn<void, [CartItem]>();

        render(
            <PizzaComboPopup
                open={true}
                onClose={jest.fn()}
                comboGroup={comboGroup}
                pizzas={pizzas}
                drinks={drinks}
                sauces={sauces}
                onAddToCart={onAddToCart}
            />
        );

        const noteField = await screen.findByLabelText("Add a note");
        fireEvent.change(noteField, { target: { value: "Extra sauce please" } });

        const chip = await screen.findByText("⭐ No Onion");
        fireEvent.click(chip);

        const addButton = await screen.findByRole("button", { name: /Add ·/ });
        fireEvent.click(addButton);

        await waitFor(() => expect(onAddToCart).toHaveBeenCalled());
        const orderItem = onAddToCart.mock.calls[0][0];
        expect(orderItem.comboItems![0].description).toBe("Extra sauce please, No Onion");
    });
});
