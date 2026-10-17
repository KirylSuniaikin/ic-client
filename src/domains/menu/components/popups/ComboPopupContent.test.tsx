import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ComboPopup renders its copy (heading, Add button) via useTranslation("menu") — initialize the
// real i18n instance so keys resolve to English.
import "../../../../shared/i18n";

import ComboPopup from "./ComboPopupContent";
import type { CartItem, Group, MenuItem } from "../../types";
import { clearMatchMedia, stubMatchMedia } from "../../../../shared/hooks/stubMatchMedia.testutil";

// PizzaLoader (rendered while ComboPopup is "loading") pulls in lottie-react, which needs a real
// <canvas> 2D context jsdom doesn't implement — same mock PizzaPopupContent.test.tsx uses.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

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
        ...overrides,
    };
}

const COMBO: Group = {
    name: "Two Pizza Combo",
    items: [makeMenuItem({ id: 40, name: "Two Pizza Combo", category: "Combo Deals", price: 6, photo: "combo.webp" })],
};

const PIZZAS: Group[] = [
    { name: "Margherita", items: [makeMenuItem({ id: 1, name: "Margherita" })] },
    { name: "Pepperoni", items: [makeMenuItem({ id: 2, name: "Pepperoni" })] },
];

function renderPopup() {
    const onAddToCart = jest.fn<void, [CartItem]>();

    render(
        <ComboPopup
            open
            onClose={jest.fn()}
            group={COMBO}
            uniquePizzas={PIZZAS}
            onAddToCart={onAddToCart}
        />
    );

    return { onAddToCart };
}

function addButton(): HTMLButtonElement {
    const button = screen.getByRole("button", { name: /^Add ·/ });
    if (!(button instanceof HTMLButtonElement)) throw new Error("Add is not a <button>");
    return button;
}

/** Add stays disabled until exactly two pizzas are picked, then adds one combo line. */
async function pickTwoPizzasAndAdd(onAddToCart: ReturnType<typeof renderPopup>["onAddToCart"]): Promise<void> {
    await screen.findByText("Pick 2 Pizzas");
    expect(addButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Margherita" }));
    expect(addButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Pepperoni" }));
    expect(addButton().disabled).toBe(false);

    fireEvent.click(addButton());

    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart.mock.calls[0][0]).toEqual(expect.objectContaining({
        name: "Two Pizza Combo",
        size: "M",
        amount: 6,
        description: "Margherita; Pepperoni",
    }));
}

// The mount effect bootstraps the TikTok pixel SDK when window.ttq is absent, via
// document.getElementsByTagName("script")[0].parentNode — jsdom has no <script> tag, so that
// lookup throws. Pre-seeding window.ttq skips that branch.
beforeEach(() => {
    window.ttq = { track: jest.fn() };
});

describe("ComboPopupContent — phone layout", () => {
    it("renders the legacy sheet and enables Add only once two pizzas are picked", async () => {
        const { onAddToCart } = renderPopup();

        await pickTwoPizzasAndAdd(onAddToCart);
        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
    });
});

describe("ComboPopupContent — PC layout", () => {
    beforeEach(() => {
        stubMatchMedia(true);
    });

    afterEach(() => {
        clearMatchMedia();
    });

    it("renders the PC dialog with the combo photo and enables Add only once two pizzas are picked", async () => {
        const { onAddToCart } = renderPopup();

        expect(await screen.findByTestId("item-popup-dialog")).toBeTruthy();
        expect(screen.getByTestId("item-popup-photo")).toBeTruthy();
        expect(screen.getAllByAltText("Two Pizza Combo")).toHaveLength(1);

        await pickTwoPizzasAndAdd(onAddToCart);
    });
});
