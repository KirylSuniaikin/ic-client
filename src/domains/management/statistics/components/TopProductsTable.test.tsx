import {describe, it, expect} from "@jest/globals";
import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import type {TopFiveProducts} from "../types";
// Column headers resolve their copy through useTranslation("statistics").
import "../../../../shared/i18n";

// jsdom's test environment lacks TextEncoder/TextDecoder, which @mui/x-data-grid needs at import
// time. A plain `import` of TopProductsTable would be hoisted by Babel's commonjs transform ABOVE
// this polyfill, so the component is loaded via require() below -- same as RevenueByHourTable.test.tsx.
type TopProductsTableModule = typeof import("./TopProductsTable");
const nodeUtil: typeof import("util") = require("util");
if (typeof (global as {TextEncoder?: unknown}).TextEncoder === "undefined") {
    // Node's util.TextEncoder/TextDecoder are structurally compatible with the DOM lib globals
    // jsdom expects here, just not nominally typed as the same interfaces.
    global.TextEncoder = nodeUtil.TextEncoder as unknown as typeof TextEncoder;
    global.TextDecoder = nodeUtil.TextDecoder as unknown as typeof TextDecoder;
}
const {TopProductsTable}: TopProductsTableModule = require("./TopProductsTable");

// Twelve items already in the backend's descending-total order: "Item 01" sold most, "Item 12"
// is a zero-sale menu item that must still be listed.
const ITEMS: TopFiveProducts[] = Array.from({length: 12}, (_, index) => {
    const quantity = 12 - index - 1;
    return {
        name: `Item ${String(index + 1).padStart(2, "0")}`,
        quantity,
        singleQuantity: quantity,
        comboQuantity: 0,
    };
});

function cellText(container: HTMLElement, rowName: string, field: string): string | null {
    const row = container.querySelector<HTMLElement>(`.MuiDataGrid-row[data-id="${rowName}"]`);
    if (!row) {
        throw new Error(`No row rendered for "${rowName}"`);
    }
    return row.querySelector<HTMLElement>(`[data-field="${field}"]`)?.textContent ?? null;
}

describe("TopProductsTable", () => {
    it("shows single, combo and total columns for each item", () => {
        const items: TopFiveProducts[] = [
            {name: "Pepperoni", quantity: 7, singleQuantity: 3, comboQuantity: 4},
        ];

        const {container} = render(<TopProductsTable topProducts={items}/>);

        expect(screen.getByText("Item Name")).toBeTruthy();
        expect(screen.getByText("Single")).toBeTruthy();
        expect(screen.getByText("In Combo")).toBeTruthy();
        expect(screen.getByText("Total")).toBeTruthy();
        expect(cellText(container, "Pepperoni", "singleQuantity")).toBe("3");
        expect(cellText(container, "Pepperoni", "comboQuantity")).toBe("4");
        expect(cellText(container, "Pepperoni", "quantity")).toBe("7");
    });

    it("shows the first 10 items on the first page", () => {
        render(<TopProductsTable topProducts={ITEMS}/>);

        expect(screen.getByText("Item 01")).toBeTruthy();
        expect(screen.getByText("Item 10")).toBeTruthy();
        expect(screen.queryByText("Item 11")).toBeNull();
        expect(screen.getByText("1–10 of 12")).toBeTruthy();
    });

    it("pages to the remaining items, including a zero-sale one", () => {
        const {container} = render(<TopProductsTable topProducts={ITEMS}/>);

        fireEvent.click(screen.getByRole("button", {name: "Go to next page"}));

        expect(screen.queryByText("Item 01")).toBeNull();
        expect(screen.getByText("Item 11")).toBeTruthy();
        expect(cellText(container, "Item 12", "quantity")).toBe("0");
    });
});
