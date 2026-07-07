import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "../../../../../shared/i18n";

jest.mock("../../../../../shared/api/public");

import { getQuickPicks } from "../../../../../shared/api/public";
import { DetroitComboPopup } from "./DetroitComboPopup";
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

const combo: Group = {
    name: "Detroit Combo",
    items: [makeItem({ id: 900, name: "Detroit Combo", price: 6.5 })],
};

const bricks: Group[] = [
    { name: "Bricks", items: [makeItem({ id: 201, name: "Pepperoni Brick", category: "Brick Pizzas" })] },
];

const drinks: Group[] = [
    { name: "Drinks", items: [makeItem({ id: 301, name: "Cola", category: "Beverages" })] },
];

const sauces: Group[] = [
    { name: "Sauces", items: [makeItem({ id: 401, name: "Ranch", category: "Sauces" })] },
];

const picks: QuickPickDto[] = [
    { id: 1, label: "No Tomato", labelAr: null, isPopular: false },
];

beforeEach(() => {
    mockGetQuickPicks.mockReset();
});

describe("DetroitComboPopup quick-pick wiring", () => {
    it("appends the joined quick-pick label to the brick's description sent to onAddToCart", async () => {
        mockGetQuickPicks.mockResolvedValueOnce(picks);
        const onAddToCart = jest.fn<void, [CartItem]>();

        render(
            <DetroitComboPopup
                open={true}
                onClose={jest.fn()}
                combo={combo}
                bricks={bricks}
                drinks={drinks}
                sauces={sauces}
                onAddToCart={onAddToCart}
            />
        );

        const chip = await screen.findByText("No Tomato");
        fireEvent.click(chip);

        const addButton = await screen.findByRole("button", { name: /comboPopup.add|·/ });
        fireEvent.click(addButton);

        await waitFor(() => expect(onAddToCart).toHaveBeenCalled());
        const orderItem = onAddToCart.mock.calls[0][0];
        expect(orderItem.comboItems![0].description).toBe("No Tomato");
    });
});
