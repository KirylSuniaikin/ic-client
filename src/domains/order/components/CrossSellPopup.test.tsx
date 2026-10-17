import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// The title and the "Next" label come from useTranslation("checkout") — initialize the real
// i18n instance so the keys resolve to English.
import "../../../shared/i18n";

import CrossSellPopup from "./CrossSellPopup";
import type { CartItem, MenuItem } from "../../menu/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

const NAMES = ["Garlic Bread", "Pizza Rolls", "Cheese Sticks", "Chicken Wings", "Brownie", "Cookie", "Cola"];

function menuItem(id: number, name: string): MenuItem {
    return {
        available: true,
        category: "Sides",
        description: "",
        id,
        is_best_seller: false,
        name,
        photo: "",
        price: 1.5,
        size: "",
    };
}

const ITEMS = NAMES.map((name, index) => menuItem(index + 1, name));

type PopupMocks = {
    onAddToCart: ReturnType<typeof jest.fn<void, [CartItem[]]>>;
    onCheckout: ReturnType<typeof jest.fn<void, []>>;
    onClose: ReturnType<typeof jest.fn<void, []>>;
};

function renderPopup(): PopupMocks {
    const onAddToCart = jest.fn<void, [CartItem[]]>();
    const onCheckout = jest.fn<void, []>();
    const onClose = jest.fn<void, []>();
    render(
        <CrossSellPopup
            open
            onClose={onClose}
            onAddToCart={onAddToCart}
            crossSellItems={ITEMS}
            onCheckout={onCheckout}
        />
    );
    return { onAddToCart, onCheckout, onClose };
}

function buttonLabels(): string[] {
    return screen.getAllByRole("button").map((button) => button.textContent ?? "");
}

/** Picks "Garlic Bread", presses Next, and checks the add → checkout → close sequence. */
function expectNextAddsThenChecksOutThenCloses(mocks: PopupMocks): void {
    fireEvent.click(screen.getByText("Garlic Bread"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(mocks.onAddToCart).toHaveBeenCalledTimes(1);
    expect(mocks.onAddToCart.mock.calls[0][0]).toEqual([
        expect.objectContaining({ name: "Garlic Bread", quantity: 1, amount: 1.5 }),
    ]);
    expect(mocks.onCheckout).toHaveBeenCalledTimes(1);
    expect(mocks.onClose).toHaveBeenCalledTimes(1);

    const [addOrder] = mocks.onAddToCart.mock.invocationCallOrder;
    const [checkoutOrder] = mocks.onCheckout.mock.invocationCallOrder;
    const [closeOrder] = mocks.onClose.mock.invocationCallOrder;
    expect(addOrder).toBeLessThan(checkoutOrder);
    expect(checkoutOrder).toBeLessThan(closeOrder);
}

afterEach(() => {
    clearMatchMedia();
});

describe("CrossSellPopup — phone", () => {
    it("has no close button and shows only the first six items", () => {
        renderPopup();

        expect(buttonLabels()).toEqual(["Next"]);
        NAMES.slice(0, 6).forEach((name) => {
            expect(screen.getByText(name)).toBeTruthy();
        });
        expect(screen.queryByText(NAMES[6])).toBeNull();
        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
    });

    it("adds the picked items, then checks out, then closes on Next", () => {
        expectNextAddsThenChecksOutThenCloses(renderPopup());
    });
});

describe("CrossSellPopup — PC", () => {
    it("is a 560px centred dialog with no close button and a pinned Next", () => {
        stubMatchMedia(true);
        renderPopup();

        const dialog = screen.getByTestId("item-popup-dialog");
        expect(emotionRulesFor(dialog)).toContain("width:min(560px, 92vw)");
        expect(buttonLabels()).toEqual(["Next"]);

        // Pinned: the footer sits outside the scrolling body that holds the title and the rows.
        const body = screen.getByText("Customers also buy").parentElement;
        if (body === null) throw new Error("title has no parent");
        expect(emotionRulesFor(body)).toContain("overflow-y:auto");
        expect(body.contains(screen.getByRole("button", { name: "Next" }))).toBe(false);
        expect(dialog.contains(screen.getByRole("button", { name: "Next" }))).toBe(true);
    });

    it("adds the picked items, then checks out, then closes on Next", () => {
        stubMatchMedia(true);

        expectNextAddsThenChecksOutThenCloses(renderPopup());
    });
});
