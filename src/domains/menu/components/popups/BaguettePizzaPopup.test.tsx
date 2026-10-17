import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// BaguettePizzaPopup renders its copy (About heading, Add button) via useTranslation("menu") —
// initialize the real i18n instance so keys resolve to English.
import "../../../../shared/i18n";

import { BaguettePizzaPopup } from "./BaguettePizzaPopup";
import type { CartItem, MenuItem } from "../../types";
import { clearMatchMedia, stubMatchMedia } from "../../../../shared/hooks/stubMatchMedia.testutil";

const BAGUETTE: MenuItem = {
    id: 30,
    name: "Pepperoni Baguette",
    category: "Baguette Pizzas",
    size: "M",
    price: 2.5,
    available: true,
    is_best_seller: false,
    photo: "baguette.webp",
    description: "Pepperoni, mozzarella, marinara on a baguette",
    recipe_components: [],
};

function renderPopup() {
    const onAddToCart = jest.fn<void, [CartItem[]]>();
    const removeFromCart = jest.fn<void, [string, number, number]>();

    render(
        <BaguettePizzaPopup
            menuItem={BAGUETTE}
            open
            onClose={jest.fn()}
            onAddToCart={onAddToCart}
            crossSellItems={[]}
            removeFromCart={removeFromCart}
        />
    );

    return { onAddToCart, removeFromCart };
}

describe("BaguettePizzaPopup — phone layout", () => {
    it("labels Add with the price in BHD and removes the old line before adding the new one", () => {
        const { onAddToCart, removeFromCart } = renderPopup();

        const add = screen.getByRole("button", { name: /^Add ·/ });
        expect(add.textContent).toBe("Add · 2.50 BHD");

        fireEvent.click(add);

        // Characterizes existing behaviour (removeFromCart runs on every Add, not only on edit).
        expect(removeFromCart).toHaveBeenCalledTimes(1);
        expect(removeFromCart).toHaveBeenCalledWith("Pepperoni Baguette", 2.5, 1);
        expect(onAddToCart).toHaveBeenCalledTimes(1);
        expect(removeFromCart.mock.invocationCallOrder[0])
            .toBeLessThan(onAddToCart.mock.invocationCallOrder[0]);
    });

    it("shows the About block and no PC dialog", () => {
        renderPopup();

        expect(screen.getByText("About")).toBeTruthy();
        expect(screen.getByText(BAGUETTE.description)).toBeTruthy();
        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
    });
});

describe("BaguettePizzaPopup — PC layout", () => {
    beforeEach(() => {
        stubMatchMedia(true);
    });

    afterEach(() => {
        clearMatchMedia();
    });

    it("renders the dialog with the description directly under the title and no About block", () => {
        renderPopup();

        expect(screen.getByTestId("item-popup-dialog")).toBeTruthy();
        expect(screen.getByTestId("item-popup-photo")).toBeTruthy();
        expect(screen.getAllByAltText("Pepperoni Baguette")).toHaveLength(1);

        const title = screen.getByRole("heading", { name: "Pepperoni Baguette" });
        const description = screen.getByText(BAGUETTE.description);
        expect(title.nextElementSibling).toBe(description);
        expect(screen.queryByText("About")).toBeNull();
    });

    it("adds the same payload from the PC dialog", () => {
        const { onAddToCart, removeFromCart } = renderPopup();

        fireEvent.click(screen.getByRole("button", { name: /^Add ·/ }));

        expect(removeFromCart).toHaveBeenCalledWith("Pepperoni Baguette", 2.5, 1);
        const [products] = onAddToCart.mock.calls[0];
        expect(products[0]).toEqual(expect.objectContaining({
            name: "Pepperoni Baguette", quantity: 1, amount: 2.5, note: "", description: "",
        }));
    });
});
