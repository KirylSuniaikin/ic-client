import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// The Add label comes from useTranslation("menu") and the PC close label from
// useTranslation("customerAuth") — initialize the real i18n instance so both resolve to English.
import "../../../../../shared/i18n";

import ItemEditorPopup from "./ItemEditorPopup";
import type { MenuItem } from "../../../types";
import { clearMatchMedia, stubMatchMedia } from "../../../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../../../management/couriers/components/emotionRules.testutil";

type OnSave = ComponentProps<typeof ItemEditorPopup>["onSave"];

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
    return {
        id: 2, name: "Cola", category: "Beverages", size: "", price: 0.5,
        available: true, is_best_seller: false, photo: "cola.webp", description: "",
        recipe_components: undefined, ...overrides,
    };
}

const COLA = makeMenuItem();
const FANTA = makeMenuItem({ id: 5, name: "Fanta", photo: "fanta.webp" });

interface RenderedEditor {
    overlay: Element;
    sheet: Element;
}

function renderEditor(onSave: OnSave, onClose: () => void): RenderedEditor {
    const { container } = render(
        <ItemEditorPopup open onClose={onClose} items={[COLA, FANTA]} onSave={onSave} target="drink"/>
    );

    const overlay = container.firstElementChild;
    const sheet = overlay?.firstElementChild;
    if (!overlay || !sheet) throw new Error("ItemEditorPopup rendered no overlay/sheet");
    return { overlay, sheet };
}

afterEach(() => {
    clearMatchMedia();
});

describe("ItemEditorPopup — phone", () => {
    it("saves the tapped item with the default size, dough and crust, then closes", () => {
        const onSave = jest.fn<void, Parameters<OnSave>>();
        const onClose = jest.fn<void, []>();
        renderEditor(onSave, onClose);

        fireEvent.click(screen.getByText("Fanta"));
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith({ item: FANTA, size: "", dough: "Traditional", crust: "Classic Crust" });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
    });

    it("closes on a backdrop click but not on a click inside the sheet", () => {
        const onClose = jest.fn<void, []>();
        const { overlay, sheet } = renderEditor(jest.fn<void, Parameters<OnSave>>(), onClose);

        fireEvent.click(sheet);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe("ItemEditorPopup — PC", () => {
    it("centres the sheet, lays the tiles out in three columns and labels the close button", () => {
        stubMatchMedia(true);
        const onClose = jest.fn<void, []>();
        const { sheet } = renderEditor(jest.fn<void, Parameters<OnSave>>(), onClose);

        expect(emotionRulesFor(sheet)).toContain("translate(-50%, -50%)");

        // Typography → tile → grid.
        const grid = screen.getByText("Cola").parentElement?.parentElement;
        if (!grid) throw new Error("tile has no grid container");
        expect(emotionRulesFor(grid)).toContain("repeat(3, 1fr)");

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
