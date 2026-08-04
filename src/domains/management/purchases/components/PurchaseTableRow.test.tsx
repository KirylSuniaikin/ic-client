import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PurchaseTableRow } from "./PurchaseTableRow";
import type { PurchaseRow } from "../types";
import type { ProductTO } from "../../inventory/types";

const noop = () => {};

function makeProduct(overrides: Partial<ProductTO> = {}): ProductTO {
    return {
        id: 1,
        name: "Flour",
        targetPrice: 2,
        price: 2,
        isInventory: true,
        isPurchasable: true,
        isBundle: false,
        topVendor: "",
        ...overrides,
    };
}

function makeRow(overrides: Partial<PurchaseRow> = {}): PurchaseRow {
    return {
        id: "r-0",
        purchaseDate: "2026-08-01",
        productId: 1,
        price: 2,
        quantity: 5,
        finalPrice: 10,
        vendorName: "Acme",
        ...overrides,
    };
}

function renderRow(row: PurchaseRow, product: ProductTO | null) {
    return render(
        <table>
            <tbody>
                <PurchaseTableRow
                    row={row}
                    products={product ? [product] : []}
                    vendors={[]}
                    product={product}
                    onUpdateRow={noop}
                    onCommitNumeric={noop}
                    onApplyProduct={noop}
                    onDelete={noop}
                />
            </tbody>
        </table>
    );
}

// Pill tones in DOM order: quantity, total price, unit price, target price.
function tones(container: HTMLElement): (string | null)[] {
    return Array.from(container.querySelectorAll("[data-tone]")).map((el) => el.getAttribute("data-tone"));
}

function cellText(testId: string): string {
    return screen.getByTestId(testId).textContent ?? "";
}

describe("PurchaseTableRow price columns", () => {
    it("shows the product's target price separately from the paid unit price", () => {
        // Paid 12.500 for 5 units => 2.500 per unit, against a 2.000 target.
        renderRow(makeRow({ price: 2.5, quantity: 5, finalPrice: 12.5 }), makeProduct({ targetPrice: 2 }));

        expect(cellText("unit-price-cell")).toBe("2.500");
        expect(cellText("target-price-cell")).toBe("2.000");
    });

    it("renders a dash in the target price cell when no product is selected", () => {
        renderRow(makeRow({ productId: null, price: null, quantity: null, finalPrice: null }), null);

        expect(cellText("target-price-cell")).toBe("—");
        expect(cellText("unit-price-cell")).toBe("—");
    });

    it("reddens only the unit price when it exceeds the target", () => {
        const { container } = renderRow(
            makeRow({ price: 2.5, quantity: 5, finalPrice: 12.5 }),
            makeProduct({ targetPrice: 2 })
        );

        // Total price must stay neutral so the red points at exactly one number.
        expect(tones(container)).toEqual(["neutral", "neutral", "error", "neutral"]);
    });

    it("keeps every cell neutral when the unit price is within the target", () => {
        const { container } = renderRow(
            makeRow({ price: 1.5, quantity: 5, finalPrice: 7.5 }),
            makeProduct({ targetPrice: 2 })
        );

        expect(tones(container)).toEqual(["neutral", "neutral", "neutral", "neutral"]);
    });
});
