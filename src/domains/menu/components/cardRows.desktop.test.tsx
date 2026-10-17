import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";

// ExtraIngrScroll and BetterTogetherComponent read their headings through useTranslation —
// initialize the real i18n instance so the keys resolve instead of warning.
import "../../../shared/i18n";

import { ToppingsScroll } from "./ToppingsScroll";
import { ExtraIngrScroll } from "./ExtraIngrScroll";
import { BetterTogetherComponent } from "../../order/components/BetterTogetherComponent";
import type { ExtraIngr, MenuItem } from "../types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

const DRIZZLES = [
    { id: 1, photo: "", name: "Honey", price: 0.3, available: true },
    { id: 2, photo: "", name: "Ranch", price: 0.3, available: true },
];

const EXTRAS: ExtraIngr[] = [
    { id: 1, name: "Mushroom", size: "M", price: 0.5 },
    { id: 2, name: "Olives", size: "M", price: 0.5 },
];

const BETTER_TOGETHER: MenuItem[] = [
    {
        available: true, category: "Beverages", description: "", id: 10, is_best_seller: false,
        name: "Water", photo: "", price: 0.2, size: "",
    },
    {
        available: true, category: "Sauces", description: "", id: 11, is_best_seller: false,
        name: "Marinara", photo: "", price: 0.3, size: "",
    },
];

type RowCase = { label: string; cardName: string; renderRow: () => void };

const CASES: RowCase[] = [
    {
        label: "ToppingsScroll",
        cardName: "Honey",
        renderRow: () => {
            render(
                <ToppingsScroll
                    toppings={DRIZZLES}
                    selectedToppings={[]}
                    onUpdateSelectedToppings={jest.fn<void, [(prev: string[]) => string[]]>()}
                />
            );
        },
    },
    {
        label: "ExtraIngrScroll",
        cardName: "Mushroom",
        renderRow: () => {
            render(<ExtraIngrScroll ingredients={EXTRAS} selected={[]} onToggle={jest.fn<void, [string]>()} />);
        },
    },
    {
        label: "BetterTogetherComponent",
        cardName: "Water",
        renderRow: () => {
            render(
                <BetterTogetherComponent
                    betterTogether={BETTER_TOGETHER}
                    selectedItems={{}}
                    increaseQuantityOnCrossSell={jest.fn<void, [string]>()}
                    decreaseQuantityOnCrossSell={jest.fn<void, [string]>()}
                />
            );
        },
    },
];

/** The row is the card's parent: the card name's Typography → its card Box → the row Box. */
function rowOf(cardName: string): HTMLElement {
    const row = screen.getByText(cardName).parentElement?.parentElement;
    if (row == null) throw new Error(`no card row around "${cardName}"`);
    return row;
}

afterEach(() => {
    clearMatchMedia();
});

describe.each(CASES)("$label card row", ({ cardName, renderRow }) => {
    it("scrolls horizontally and does not wrap on the phone", () => {
        renderRow();

        const rules = emotionRulesFor(rowOf(cardName));
        expect(rules).toContain("overflow-x:auto");
        expect(rules).not.toContain("flex-wrap");
    });

    it("wraps its cards on PC", () => {
        stubMatchMedia(true);
        renderRow();

        expect(emotionRulesFor(rowOf(cardName))).toContain("flex-wrap:wrap");
    });
});
