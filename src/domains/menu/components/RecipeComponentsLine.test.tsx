import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RecipeComponentsLine } from "./RecipeComponentsLine";
import type { RecipeComponent } from "../types";
// displayLabel reads i18n.language — initialize the real i18n instance and drive it with
// changeLanguage, the same pattern useCheckout.test.ts uses for locale-dependent behavior.
import i18n, { DEFAULT_LANGUAGE } from "../../../shared/i18n";

const components: RecipeComponent[] = [
    { id: 1, name: "Tomato sauce", deletable: false },
    { id: 2, name: "Red Onion", deletable: true },
];

describe("RecipeComponentsLine", () => {
    it("renders nothing when there are no components", () => {
        const { container } = render(
            <RecipeComponentsLine components={[]} removedIds={[]} onToggle={jest.fn()} />
        );

        expect(container.firstChild).toBeNull();
    });

    it("underlines only deletable components and gives them a remove icon", () => {
        render(<RecipeComponentsLine components={components} removedIds={[]} onToggle={jest.fn()} />);

        const sauce = screen.getByText(/Tomato sauce/);
        const onion = screen.getByText("Red Onion");
        expect(window.getComputedStyle(onion.closest("span") as Element).textDecoration).toContain("underline");
        expect(sauce.closest("span")?.querySelector("svg")).toBeFalsy();
        expect(onion.closest("span")?.querySelector("svg")).toBeTruthy();
    });

    it("calls onToggle with the component when a deletable name is clicked", () => {
        const onToggle = jest.fn();
        render(<RecipeComponentsLine components={components} removedIds={[]} onToggle={onToggle} />);

        fireEvent.click(screen.getByText("Red Onion"));

        expect(onToggle).toHaveBeenCalledWith(components[1]);
    });

    it("strikes removed components through and swaps to the restore icon", () => {
        render(<RecipeComponentsLine components={components} removedIds={[2]} onToggle={jest.fn()} />);

        const onion = screen.getByText("Red Onion");
        const span = onion.closest("span") as Element;
        expect(window.getComputedStyle(span).textDecoration).toContain("line-through");
        expect(span.querySelector("svg[data-testid='ReplayOutlinedIcon']")).toBeTruthy();
    });

    it("does not toggle non-deletable components on click", () => {
        const onToggle = jest.fn();
        render(<RecipeComponentsLine components={components} removedIds={[]} onToggle={onToggle} />);

        fireEvent.click(screen.getByText(/Tomato sauce/));

        expect(onToggle).not.toHaveBeenCalled();
    });
});

// Customer-facing label swap: `name` stays the internal/prep-plan identifier, `label`/`label_ar`
// are the display text shown to customers (Arabic prefers label_ar, both fall back to `name`).
describe("RecipeComponentsLine — customer-facing label localization", () => {
    const withEnglishAndArabicLabel: RecipeComponent = {
        id: 3,
        name: "Fior di Latte",
        deletable: false,
        label: "Fresh Mozzarella",
        label_ar: "موزاريلا طازجة",
    };
    const withLabelButNoArabicLabel: RecipeComponent = {
        id: 4,
        name: "Basil Leaf",
        deletable: false,
        label: "Basil",
    };
    const withNoLabelAtAll: RecipeComponent = {
        id: 5,
        name: "Dough Base",
        deletable: false,
    };
    const deletableWithLabel: RecipeComponent = {
        id: 6,
        name: "Red Onion Raw",
        deletable: true,
        label: "Onion",
    };

    afterEach(async () => {
        // Reset the shared i18n singleton so language changes don't leak into other test files.
        await act(async () => {
            await i18n.changeLanguage(DEFAULT_LANGUAGE);
        });
    });

    it("renders the label instead of name when label is set (English locale)", () => {
        render(
            <RecipeComponentsLine components={[withEnglishAndArabicLabel]} removedIds={[]} onToggle={jest.fn()} />
        );

        expect(screen.getByText("Fresh Mozzarella")).toBeTruthy();
        expect(screen.queryByText("Fior di Latte")).toBeNull();
    });

    it("renders label_ar instead of label when the locale is Arabic", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });

        render(
            <RecipeComponentsLine components={[withEnglishAndArabicLabel]} removedIds={[]} onToggle={jest.fn()} />
        );

        expect(screen.getByText("موزاريلا طازجة")).toBeTruthy();
        expect(screen.queryByText("Fresh Mozzarella")).toBeNull();
        expect(screen.queryByText("Fior di Latte")).toBeNull();
    });

    it("falls back to name when both label and label_ar are unset (English locale)", () => {
        render(<RecipeComponentsLine components={[withNoLabelAtAll]} removedIds={[]} onToggle={jest.fn()} />);

        expect(screen.getByText("Dough Base")).toBeTruthy();
    });

    it("falls back to label when label_ar is unset and the locale is Arabic", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });

        render(
            <RecipeComponentsLine components={[withLabelButNoArabicLabel]} removedIds={[]} onToggle={jest.fn()} />
        );

        expect(screen.getByText("Basil")).toBeTruthy();
        expect(screen.queryByText("Basil Leaf")).toBeNull();
    });

    it("falls back to name when both label and label_ar are unset and the locale is Arabic", async () => {
        await act(async () => {
            await i18n.changeLanguage("ar");
        });

        render(<RecipeComponentsLine components={[withNoLabelAtAll]} removedIds={[]} onToggle={jest.fn()} />);

        expect(screen.getByText("Dough Base")).toBeTruthy();
    });

    it("passes the canonical `name` (not the label) to onToggle when a labeled deletable component is tapped", () => {
        const onToggle = jest.fn<void, [RecipeComponent]>();
        render(
            <RecipeComponentsLine components={[deletableWithLabel]} removedIds={[]} onToggle={onToggle} />
        );

        fireEvent.click(screen.getByText("Onion"));

        expect(onToggle).toHaveBeenCalledWith(deletableWithLabel);
        expect(onToggle.mock.calls[0][0].name).toBe("Red Onion Raw");
    });
});
