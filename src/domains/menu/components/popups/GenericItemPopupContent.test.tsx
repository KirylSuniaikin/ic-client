import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// GenericItemPopupContent renders its copy (note label, Add button) via useTranslation("menu") —
// initialize the real i18n instance so keys resolve to English, mirroring PizzaComboPopup.test.tsx.
import "../../../../shared/i18n";

import GenericItemPopupContent from "./GenericItemPopupContent";
import type { CartItem, Group, MenuItem } from "../../types";
import { clearMatchMedia, stubMatchMedia } from "../../../../shared/hooks/stubMatchMedia.testutil";

function makeBrickItem(overrides: Partial<MenuItem> = {}): MenuItem {
    return {
        id: 20,
        name: "Pepperoni Detroit Brick",
        category: "Brick Pizzas",
        size: "M",
        price: 5,
        available: true,
        is_best_seller: false,
        photo: "",
        description: "Pepperoni, mozzarella, marinara",
        recipe_components: [{ id: 7, name: "Red Onion", deletable: true }],
        ...overrides,
    };
}

const BRICK = makeBrickItem();
const GROUP: Group = { name: "Detroit Brick Pizzas", items: [BRICK] };

function renderPopup() {
    const onAddToCart = jest.fn<void, [CartItem[]]>();

    render(
        <GenericItemPopupContent
            open
            onClose={jest.fn()}
            group={GROUP}
            onAddToCart={onAddToCart}
            crossSellItems={[]}
        />
    );

    return { onAddToCart };
}

function clickAdd(): void {
    fireEvent.click(screen.getByRole("button", { name: /^Add ·/ }));
}

// GenericItemPopupContent's mount effect bootstraps the TikTok pixel SDK when window.ttq is
// absent, via document.getElementsByTagName("script")[0].parentNode — jsdom has no <script> tag
// in the test document, so that lookup throws. Pre-seeding window.ttq skips that branch.
beforeEach(() => {
    window.ttq = { track: jest.fn() };
});

describe("GenericItemPopupContent — Brick Pizza note bug fix (task RW)", () => {
    it("assigns a typed note to CartItem.note for a Brick Pizza (previously silently dropped)", async () => {
        const { onAddToCart } = renderPopup();

        fireEvent.change(await screen.findByLabelText("Add a note"), {
            target: { value: "extra crispy edges" },
        });
        clickAdd();

        expect(onAddToCart).toHaveBeenCalledTimes(1);
        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].note).toBe("extra crispy edges");
    });

    it("keeps the note out of the built description (removal tokens only)", async () => {
        const { onAddToCart } = renderPopup();

        fireEvent.change(await screen.findByLabelText("Add a note"), {
            target: { value: "extra crispy edges" },
        });
        fireEvent.click(screen.getByText("Red Onion"));
        clickAdd();

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].description).toBe("-(Red Onion)");
        expect(products[0].description).not.toContain("extra crispy edges");
    });

    it("defaults note to an empty string when nothing is typed", async () => {
        const { onAddToCart } = renderPopup();
        await screen.findByLabelText("Add a note");

        clickAdd();

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].note).toBe("");
        expect(products[0].description).toBe("");
    });

    it("does not assign a note for a non-Brick item (no note field is even rendered)", async () => {
        const nonBrick = makeBrickItem({ category: "Sides", recipe_components: undefined });
        const onAddToCart = jest.fn<void, [CartItem[]]>();

        render(
            <GenericItemPopupContent
                open
                onClose={jest.fn()}
                group={{ name: "Sides", items: [nonBrick] }}
                onAddToCart={onAddToCart}
                crossSellItems={[]}
            />
        );

        expect(screen.queryByLabelText("Add a note")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /^Add ·/ }));

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].note).toBe("");
    });
});

// The PC dialog is the same component with a different shell, so the payload must not change with it.
describe("GenericItemPopupContent — PC layout", () => {
    beforeEach(() => {
        stubMatchMedia(true);
    });

    afterEach(() => {
        clearMatchMedia();
    });

    it("keeps the Brick Pizza note and removal payload inside the PC dialog", async () => {
        const { onAddToCart } = renderPopup();

        expect(await screen.findByTestId("item-popup-dialog")).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Add a note"), {
            target: { value: "extra crispy edges" },
        });
        fireEvent.click(screen.getByText("Red Onion"));
        clickAdd();

        expect(onAddToCart).toHaveBeenCalledTimes(1);
        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].note).toBe("extra crispy edges");
        expect(products[0].description).toBe("-(Red Onion)");
        expect(products[0].customizations).toEqual([
            { action: "REMOVE", componentId: 7, quantity: 1, name: "Red Onion" },
        ]);
    });

    it("renders no note field for a non-Brick item and adds it with an empty note", async () => {
        const nonBrick = makeBrickItem({ category: "Sides", recipe_components: undefined });
        const onAddToCart = jest.fn<void, [CartItem[]]>();

        render(
            <GenericItemPopupContent
                open
                onClose={jest.fn()}
                group={{ name: "Sides", items: [nonBrick] }}
                onAddToCart={onAddToCart}
                crossSellItems={[]}
            />
        );

        expect(await screen.findByTestId("item-popup-dialog")).toBeTruthy();
        expect(screen.queryByLabelText("Add a note")).toBeNull();

        clickAdd();

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].note).toBe("");
    });
});
