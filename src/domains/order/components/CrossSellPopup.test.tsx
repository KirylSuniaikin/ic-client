import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

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

function renderPopup(crossSellItems: MenuItem[] = ITEMS): PopupMocks {
    const onAddToCart = jest.fn<void, [CartItem[]]>();
    const onCheckout = jest.fn<void, []>();
    const onClose = jest.fn<void, []>();
    render(
        <CrossSellPopup
            open
            onClose={onClose}
            onAddToCart={onAddToCart}
            crossSellItems={crossSellItems}
            onCheckout={onCheckout}
        />
    );
    return { onAddToCart, onCheckout, onClose };
}

/** A card is the direct parent of its item's name. */
function cardOf(name: string): HTMLElement {
    const card = screen.getByText(name).parentElement;
    if (card === null) throw new Error(`"${name}" has no card`);
    return card;
}

function gridOf(name: string): HTMLElement {
    const grid = cardOf(name).parentElement;
    if (grid === null) throw new Error(`"${name}" has no grid`);
    return grid;
}

/** The slot under the name that holds the price, or the -/qty/+ stepper once the card is picked. */
function bottomSlotOf(name: string): HTMLElement {
    const slot = cardOf(name).lastElementChild;
    if (!(slot instanceof HTMLElement)) throw new Error(`"${name}" has an empty card`);
    return slot;
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

        // Pinned: the footer sits outside the scrolling body that holds the title and the cards.
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

// Owner, 21 Oct 2026 (iPhone, 393pt): rows of three fixed 140px cards scrolled sideways, so the third
// card was cut off at the right edge, and a name wrapping to two lines pushed its price lower.
describe("CrossSellPopup — card grid", () => {
    it.each([
        ["phone", false],
        ["PC", true],
    ])("%s: all six cards share one grid, two columns below 600px and three from 600px up, with no sideways scroll", (_surface, desktop) => {
        stubMatchMedia(desktop);
        renderPopup();

        const grid = gridOf(NAMES[0]);
        expect(grid.children).toHaveLength(6);
        NAMES.slice(0, 6).forEach((name) => {
            expect(gridOf(name)).toBe(grid);
        });

        const rules = emotionRulesFor(grid);
        expect(rules).toContain("display:grid");
        expect(rules).toContain("grid-template-columns:repeat(2, minmax(0, 1fr))");
        expect(rules).toMatch(/@media \(min-width:600px\) \{[^}]*grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/);
        expect(rules).not.toContain("overflow-x");
    });

    it("cards take their column's width and pin the price to the bottom, so a row lines up whatever the name's length", () => {
        renderPopup();

        // Grid items stretch to their row's height unless told otherwise; nothing here may opt out.
        expect(emotionRulesFor(gridOf(NAMES[0]))).not.toContain("align-items");
        NAMES.slice(0, 6).forEach((name) => {
            const cardRules = emotionRulesFor(cardOf(name));
            expect(cardRules).toContain("display:flex");
            expect(cardRules).toContain("flex-direction:column");
            expect(cardRules).toContain("min-width:0");
            expect(cardRules).not.toMatch(/[\s;{]width:/);
            expect(cardRules).not.toContain("flex-shrink");

            expect(emotionRulesFor(screen.getByText(name))).toContain("flex-grow:1");
            expect(bottomSlotOf(name).textContent).toBe("+1.5");
        });
    });

    it("keeps a photo's aspect in a fixed-height box, as tall as a photo-less card's placeholder", () => {
        renderPopup([{ ...menuItem(1, "Hot Honey Sauce"), photo: "hot-honey.webp" }, menuItem(2, "Water")]);

        const photo = screen.getByRole("img", { name: "Hot Honey Sauce" });
        expect(photo.style.display).toBe("block");
        expect(photo.style.width).toBe("100%");
        expect(photo.style.height).toBe("120px");
        expect(photo.style.objectFit).toBe("contain");

        const placeholder = cardOf("Water").firstElementChild;
        if (placeholder === null) throw new Error("Water has an empty card");
        expect(emotionRulesFor(placeholder)).toContain("height:120px");
    });

    it("a picked card swaps its price for the -/qty/+ stepper in the same one-line slot at the bottom", () => {
        const mocks = renderPopup();
        const slot = bottomSlotOf("Garlic Bread");
        const slotRules = emotionRulesFor(slot);
        expect(slotRules).toContain("height:30px");
        expect(slotRules).toContain("white-space:nowrap");

        fireEvent.click(screen.getByText("Garlic Bread"));

        expect(bottomSlotOf("Garlic Bread")).toBe(slot);
        expect(within(slot).getAllByRole("button").map((button) => button.textContent)).toEqual(["–", "+"]);
        expect(slot.textContent).toBe("–1+");
        expect(bottomSlotOf("Pizza Rolls").textContent).toBe("+1.5");

        fireEvent.click(within(slot).getByRole("button", { name: "+" }));
        expect(slot.textContent).toBe("–2+");
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(mocks.onAddToCart.mock.calls[0][0]).toEqual([
            expect.objectContaining({ name: "Garlic Bread", quantity: 2 }),
        ]);
    });
});
