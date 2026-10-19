import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// The card reads its labels through useTranslation — initialize the real i18n instance.
import "../../../shared/i18n";

import MenuItemCardHorizontal from "./MenuItemCardHorizontal";
import type { GroupWithCategory } from "./MenuItemCardHorizontal";
import type { CartItem, MenuItem } from "../types";
import {
    installPointerEvent,
    removePointerEvent,
    tap,
    elapse,
} from "../../../shared/hooks/tapGesture.testutil";

// Customers scrolling the menu on iPhone saw item popups open by themselves: the touch that stops
// a scroll was arriving as a tap on whatever card sat under the finger.

function makeGroup(name: string, category: string): GroupWithCategory {
    const item: MenuItem = {
        available: true, category, description: "", id: 1, is_best_seller: false,
        name, photo: "", price: 1.5, size: "S",
    };
    return { name, category, isAvailable: true, items: [item] };
}

const PIZZA = makeGroup("Margherita", "Pizzas");
const FRIES = makeGroup("Fries", "Sides");

const FRIES_IN_CART: CartItem = {
    id: 1, name: "Fries", size: "S", category: "Sides", isThinDough: false, isGarlicCrust: false,
    extraIngredients: [], toppings: [], note: "", quantity: 1, description: "", amount: 1.5,
    discountAmount: 0, comboItems: null, photo: "",
};

const onSelect = jest.fn<void, [GroupWithCategory, MenuItem?]>();
const handleAddToCart = jest.fn<void, [CartItem]>();
const handleRemoveItemFromCart = jest.fn<void, [CartItem]>();
const handleChangeQuantity = jest.fn<void, [CartItem, number]>();

// The row stands in for the category strip that scrolls sideways; the page around it for <body>,
// which is the menu's vertical scroller.
function renderCard(group: GroupWithCategory, cartItems: CartItem[] = []): void {
    render(
        <div data-testid="page">
            <div data-testid="row">
                <MenuItemCardHorizontal
                    group={group}
                    onSelect={onSelect}
                    handleAddToCart={handleAddToCart}
                    handleRemoveItemFromCart={handleRemoveItemFromCart}
                    handleChangeQuantity={handleChangeQuantity}
                    cartItems={cartItems}
                    isAdmin={false}
                />
            </div>
        </div>
    );
}

beforeAll(() => {
    installPointerEvent();
});

afterAll(() => {
    removePointerEvent();
});

beforeEach(() => {
    jest.useFakeTimers();
    onSelect.mockReset();
    handleAddToCart.mockReset();
    handleRemoveItemFromCart.mockReset();
    handleChangeQuantity.mockReset();
});

afterEach(() => {
    jest.useRealTimers();
});

describe("MenuItemCardHorizontal — taps left behind by scrolling", () => {
    it("opens the item popup on a plain tap", () => {
        renderCard(PIZZA);

        tap(screen.getByText("Margherita"));

        expect(onSelect).toHaveBeenCalledWith(PIZZA);
    });

    it("does not open the popup for the touch that stops a sideways-scrolling row", () => {
        renderCard(PIZZA);

        fireEvent.scroll(screen.getByTestId("row"));
        tap(screen.getByText("Margherita"));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it("does not open the popup for the touch that stops the page scrolling", () => {
        renderCard(PIZZA);

        fireEvent.scroll(screen.getByTestId("page"));
        tap(screen.getByText("Margherita"));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it("does not open the popup when the finger travelled across the card", () => {
        renderCard(PIZZA);

        tap(screen.getByText("Margherita"), { travelPx: 14 });

        expect(onSelect).not.toHaveBeenCalled();
    });

    it("opens the popup on a tap once the row has settled", () => {
        renderCard(PIZZA);

        fireEvent.scroll(screen.getByTestId("row"));
        elapse(200);
        tap(screen.getByText("Margherita"));

        expect(onSelect).toHaveBeenCalledWith(PIZZA);
    });

    it("opens the popup on a desktop mouse click", () => {
        renderCard(PIZZA);

        fireEvent.scroll(screen.getByTestId("page"));
        tap(screen.getByText("Margherita"), { pointerType: "mouse" });

        expect(onSelect).toHaveBeenCalledWith(PIZZA);
    });

    it("does not add a side to the cart for a tap left behind by scrolling", () => {
        renderCard(FRIES);

        fireEvent.scroll(screen.getByTestId("row"));
        tap(screen.getByText("Fries"));

        expect(handleAddToCart).not.toHaveBeenCalled();
    });

    it("adds a side to the cart on a plain tap", () => {
        renderCard(FRIES);

        tap(screen.getByText("Fries"));

        expect(handleAddToCart).toHaveBeenCalledWith(expect.objectContaining({ name: "Fries", quantity: 1 }));
    });

    it("leaves the quantity buttons working, and still kept from the card", () => {
        renderCard(FRIES, [FRIES_IN_CART]);

        tap(screen.getByTestId("AddIcon"));
        tap(screen.getByTestId("RemoveIcon"));

        expect(handleChangeQuantity).toHaveBeenCalledWith(FRIES_IN_CART, 2);
        expect(handleRemoveItemFromCart).toHaveBeenCalledWith(FRIES_IN_CART);
        expect(handleAddToCart).not.toHaveBeenCalled();
        expect(onSelect).not.toHaveBeenCalled();
    });
});
