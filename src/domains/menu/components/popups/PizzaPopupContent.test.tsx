import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// PizzaPopupContent renders its copy (note label, Add button) via useTranslation("menu") —
// initialize the real i18n instance so keys resolve to English, mirroring PizzaComboPopup.test.tsx.
import "../../../../shared/i18n";

// PizzaLoader (rendered while PizzaPopupContent is "loading") pulls in lottie-react, which needs
// a real <canvas> 2D context jsdom doesn't implement — same mock OrderStatusPage.test.tsx uses.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

import PizzaPopup from "./PizzaPopupContent";
import type { CartItem, ExtraIngr, Group, MenuItem } from "../../types";

type ExtraIngrFixture = ExtraIngr & { size: string; price: number };

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

const PIZZA_M = makeMenuItem();
const GROUP: Group = { name: "Pizzas", items: [PIZZA_M] };

function makeExtra(overrides: Partial<ExtraIngrFixture> = {}): ExtraIngrFixture {
    return { id: 5, name: "Mushroom", size: "M", price: 0.5, ...overrides };
}

function renderPopup(extraIngredients: ExtraIngrFixture[] = []) {
    const onAddToCart = jest.fn<void, [CartItem[]]>();
    const removeFromCart = jest.fn<void, [string, number, number]>();

    render(
        <PizzaPopup
            open
            onClose={jest.fn()}
            group={GROUP}
            onAddToCart={onAddToCart}
            removeFromCart={removeFromCart}
            extraIngredients={extraIngredients as unknown as ExtraIngr[]}
        />
    );

    return { onAddToCart };
}

function clickAdd(): void {
    fireEvent.click(screen.getByRole("button", { name: /^Add ·/ }));
}

// PizzaPopupContent's mount effect bootstraps the TikTok pixel SDK when window.ttq is absent,
// via document.getElementsByTagName("script")[0].parentNode — jsdom has no <script> tag in the
// test document, so that lookup throws. Pre-seeding window.ttq (as production would have it
// after the real bootstrap runs once) skips that branch entirely, same as a real second mount.
beforeEach(() => {
    window.ttq = { track: jest.fn() };
});

describe("PizzaPopupContent — note is its own field, never folded into description", () => {
    it("puts a typed note on CartItem.note and keeps it out of the built description", async () => {
        const { onAddToCart } = renderPopup([makeExtra()]);

        fireEvent.change(await screen.findByLabelText("Add a note"), {
            target: { value: "cut in triangles please" },
        });
        fireEvent.click(screen.getByText("Mushroom"));
        clickAdd();

        expect(onAddToCart).toHaveBeenCalledTimes(1);
        const [products] = onAddToCart.mock.calls[0];
        const added = products[0];

        expect(added.note).toBe("cut in triangles please");
        expect(added.description).not.toContain("cut in triangles please");
    });

    it("builds the description from structural additions only (extras group), with no note text mixed in", async () => {
        const { onAddToCart } = renderPopup([makeExtra()]);

        fireEvent.change(await screen.findByLabelText("Add a note"), {
            target: { value: "no garlic please" },
        });
        fireEvent.click(screen.getByText("Mushroom"));
        clickAdd();

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].description).toBe("+(Mushroom)");
    });

    it("still assigns CartItem.note when the pizza has no extras at all", async () => {
        const { onAddToCart } = renderPopup();

        fireEvent.change(await screen.findByLabelText("Add a note"), {
            target: { value: "well done crust" },
        });
        clickAdd();

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].note).toBe("well done crust");
        expect(products[0].description).toBe("");
    });

    it("defaults note to an empty string when nothing is typed", async () => {
        const { onAddToCart } = renderPopup();
        await screen.findByLabelText("Add a note");

        clickAdd();

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].note).toBe("");
    });
});
