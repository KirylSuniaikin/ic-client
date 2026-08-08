import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PurchaseTableRow } from "./PurchaseTableRow";
import type { PurchaseLineRow } from "../types";
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

// Date and vendor deliberately absent: both moved up to the invoice header.
function makeRow(overrides: Partial<PurchaseLineRow> = {}): PurchaseLineRow {
    return {
        id: "r-0",
        productId: 1,
        price: 2,
        quantity: 5,
        finalPrice: 10,
        ...overrides,
    };
}

function renderRow(row: PurchaseLineRow, product: ProductTO | null) {
    return render(
        <table>
            <tbody>
                <PurchaseTableRow
                    row={row}
                    invoiceId="inv-a"
                    products={product ? [product] : []}
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

describe("PurchaseTableRow columns", () => {
    it("renders no date or vendor cell, since both belong to the invoice now", () => {
        const { container } = renderRow(makeRow(), makeProduct());

        // Product, amount, total, unit, target, delete.
        expect(container.querySelectorAll("td")).toHaveLength(6);
        expect(screen.queryByPlaceholderText("Select Vendor")).toBeNull();
        expect(
            Array.from(container.querySelectorAll("input")).filter((i) =>
                /^\d{2}\.\d{2}\.\d{4}$/.test((i as HTMLInputElement).value)
            )
        ).toHaveLength(0);
    });
});
