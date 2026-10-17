import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// The offer and the Yes/No labels come from useTranslation("checkout") — initialize the real
// i18n instance so the keys resolve to English.
import "../../../shared/i18n";

import { UpsellPopup } from "./UpSellPopup";
import type { CartItem } from "../../menu/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

const ITEM: CartItem = {
    id: 7,
    name: "Margherita",
    size: "M",
    category: "Pizzas",
    isThinDough: false,
    isGarlicCrust: false,
    extraIngredients: [],
    toppings: [],
    note: "",
    quantity: 1,
    description: "",
    amount: 3.5,
    discountAmount: 0,
    comboItems: null,
    photo: "",
};

const OFFER = "Pizza + Sauce + Drink just for 4.5";

type PopupMocks = {
    onClose: ReturnType<typeof jest.fn<void, []>>;
    onAccept: ReturnType<typeof jest.fn<void, [CartItem, string]>>;
    onDecline: ReturnType<typeof jest.fn<void, []>>;
};

function renderPopup(upsellItem: CartItem | null = ITEM): PopupMocks & { container: HTMLElement } {
    const onClose = jest.fn<void, []>();
    const onAccept = jest.fn<void, [CartItem, string]>();
    const onDecline = jest.fn<void, []>();
    const { container } = render(
        <UpsellPopup
            open
            onClose={onClose}
            upsellItem={upsellItem}
            upsellType="pizza"
            onAccept={onAccept}
            onDecline={onDecline}
            photo="combo-offer.webp"
            comboPrice={4.5}
        />
    );
    return { onClose, onAccept, onDecline, container };
}

function buttonLabels(): string[] {
    return screen.getAllByRole("button").map((button) => button.textContent ?? "");
}

function modalRoot(): Element {
    const root = document.querySelector(".MuiModal-root");
    if (root === null) throw new Error("no Modal is mounted");
    return root;
}

afterEach(() => {
    clearMatchMedia();
});

describe("UpsellPopup — phone", () => {
    it("renders nothing when there is no upsell item", () => {
        const { container } = renderPopup(null);

        expect(container.innerHTML).toBe("");
        expect(document.querySelector(".MuiModal-root")).toBeNull();
    });

    it("shows the offer with only the Yes/No buttons and the blurred backdrop", () => {
        renderPopup();

        expect(screen.getByText(OFFER)).toBeTruthy();
        expect(buttonLabels()).toEqual(["No", "Yes"]);
        expect(emotionRulesFor(modalRoot())).toContain("backdrop-filter:blur(6px)");
        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
    });

    it("declines, then closes", () => {
        const { onClose, onAccept, onDecline } = renderPopup();

        fireEvent.click(screen.getByRole("button", { name: "No" }));

        expect(onDecline).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onDecline.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
        expect(onAccept).not.toHaveBeenCalled();
    });

    it("accepts with the item and its type, then closes", () => {
        const { onClose, onAccept, onDecline } = renderPopup();

        fireEvent.click(screen.getByRole("button", { name: "Yes" }));

        expect(onAccept).toHaveBeenCalledTimes(1);
        expect(onAccept).toHaveBeenCalledWith(ITEM, "pizza");
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onAccept.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
        expect(onDecline).not.toHaveBeenCalled();
    });
});

describe("UpsellPopup — PC", () => {
    it("is a 520px centred dialog with no close button, keeping the blurred backdrop", () => {
        stubMatchMedia(true);
        renderPopup();

        const dialog = screen.getByTestId("item-popup-dialog");
        expect(emotionRulesFor(dialog)).toContain("width:min(520px, 92vw)");
        expect(buttonLabels()).toEqual(["No", "Yes"]);
        expect(emotionRulesFor(modalRoot())).toContain("backdrop-filter:blur(6px)");
        expect(dialog.contains(screen.getByAltText("Margherita"))).toBe(true);
        expect(dialog.contains(screen.getByText(OFFER))).toBe(true);
    });

    it("accepts with the item and its type, then closes, as on the phone", () => {
        stubMatchMedia(true);
        const { onClose, onAccept, onDecline } = renderPopup();

        fireEvent.click(screen.getByRole("button", { name: "Yes" }));

        expect(onAccept).toHaveBeenCalledWith(ITEM, "pizza");
        expect(onAccept.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
        expect(onDecline).not.toHaveBeenCalled();
    });
});
