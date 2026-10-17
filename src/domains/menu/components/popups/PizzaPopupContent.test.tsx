import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { clearMatchMedia, stubMatchMedia } from "../../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../../management/couriers/components/emotionRules.testutil";

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

type PopupOverrides = Partial<Omit<ComponentProps<typeof PizzaPopup>, "onClose" | "onAddToCart" | "removeFromCart">>;

function renderPopup(extraIngredients: ExtraIngrFixture[] = [], overrides: PopupOverrides = {}) {
    const onAddToCart = jest.fn<void, [CartItem[]]>();
    const removeFromCart = jest.fn<void, [string, number, number]>();
    const onClose = jest.fn<void, []>();

    render(
        <PizzaPopup
            open
            onClose={onClose}
            group={GROUP}
            onAddToCart={onAddToCart}
            removeFromCart={removeFromCart}
            extraIngredients={extraIngredients as unknown as ExtraIngr[]}
            {...overrides}
        />
    );

    return { onAddToCart, onClose };
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

// A cart line as it comes back into the popup for editing: its description is the built
// customization string, never the menu copy.
const EDIT_ITEM: CartItem = {
    id: 1,
    name: "Margherita",
    size: "M",
    category: "Pizzas",
    isThinDough: false,
    isGarlicCrust: false,
    extraIngredients: [],
    toppings: [],
    note: "",
    quantity: 1,
    description: "+(Mushroom)",
    amount: 3.5,
    discountAmount: 0,
    comboItems: [],
    photo: "",
};

describe("PC layout", () => {
    beforeEach(() => {
        stubMatchMedia(true);
    });

    afterEach(() => {
        clearMatchMedia();
    });

    it("renders one dialog with a single note field and Add button, and still builds the description", async () => {
        const { onAddToCart } = renderPopup([makeExtra()]);
        await screen.findByLabelText("Add a note");

        expect(screen.getByTestId("item-popup-dialog")).toBeTruthy();
        expect(screen.getAllByLabelText("Add a note")).toHaveLength(1);
        expect(screen.getAllByRole("button", { name: /^Add ·/ })).toHaveLength(1);

        fireEvent.click(screen.getByText("Mushroom"));
        clickAdd();

        const [products] = onAddToCart.mock.calls[0];
        expect(products[0].description).toBe("+(Mushroom)");
    });

    it("puts the description directly under the title, with no About block", async () => {
        renderPopup();
        await screen.findByLabelText("Add a note");

        const title = screen.getByRole("heading", { name: "Margherita" });
        expect(title.nextElementSibling).toBe(screen.getByText("Classic tomato and mozzarella"));
        expect(screen.queryByText("About")).toBeNull();
    });

    it("shows no description in edit mode", async () => {
        renderPopup([], { isEditMode: true, editItem: EDIT_ITEM });
        await screen.findByLabelText("Add a note");

        expect(screen.getByTestId("item-popup-dialog")).toBeTruthy();
        expect(screen.queryByText("+(Mushroom)")).toBeNull();
        expect(screen.queryByText("Classic tomato and mozzarella")).toBeNull();
    });

    it("closes the popup with the labelled close button", async () => {
        const { onClose } = renderPopup();
        await screen.findByLabelText("Add a note");

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("wraps the extras row instead of scrolling it", async () => {
        renderPopup([makeExtra()]);
        await screen.findByLabelText("Add a note");

        const card = screen.getByText("Mushroom").parentElement;
        const row = card?.parentElement;
        if (row === null || row === undefined) throw new Error("Mushroom card has no row");

        expect(emotionRulesFor(row)).toContain("flex-wrap:wrap");
    });
});
