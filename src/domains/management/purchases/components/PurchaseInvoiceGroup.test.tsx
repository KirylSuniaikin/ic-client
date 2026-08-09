import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PurchaseInvoiceGroup } from "./PurchaseInvoiceGroup";
import { PRODUCT_COLUMN_COUNT } from "./cellChrome";
import type { PurchaseInvoiceRow, PurchaseLineRow } from "../types";
import type { ProductTO } from "../../inventory/types";

const flour: ProductTO = {
    id: 1, name: "Flour", targetPrice: 7, price: 7,
    isInventory: true, isPurchasable: true, isBundle: false, topVendor: "Acme",
};

function makeLine(overrides: Partial<PurchaseLineRow> = {}): PurchaseLineRow {
    return { id: "line-1", productId: 1, price: 5, quantity: 2, finalPrice: 10, ...overrides };
}

function makeInvoice(overrides: Partial<PurchaseInvoiceRow> = {}): PurchaseInvoiceRow {
    return {
        id: "inv-a",
        serverId: null,
        invoiceDate: "2026-07-14",
        vendorName: "Acme",
        paid: false,
        hasImage: false,
        pendingImage: null,
        removeImage: false,
        lines: [makeLine()],
        ...overrides,
    };
}

function renderGroup(invoice: PurchaseInvoiceRow, collapsed = false, handlers: Record<string, any> = {}) {
    const spies = {
        onToggleCollapse: jest.fn(),
        onUpdateInvoice: jest.fn(),
        onDeleteInvoice: jest.fn(),
        onAddLine: jest.fn(),
        onUpdateLine: jest.fn(),
        onCommitNumeric: jest.fn(),
        onApplyProduct: jest.fn(),
        onDeleteLine: jest.fn(),
        ...handlers,
    };
    // The group renders <tr>s, so it must be mounted inside a real table.
    const view = render(
        <table>
            <tbody>
                <PurchaseInvoiceGroup
                    invoice={invoice}
                    products={[flour]}
                    vendors={[{ id: 1, vendorName: "Acme" }]}
                    productById={new Map([[1, flour]])}
                    invalid={new Map()}
                    collapsed={collapsed}
                    {...(spies as any)}
                />
            </tbody>
        </table>
    );
    return { ...view, spies };
}

describe("PurchaseInvoiceGroup", () => {
    it("collapses to a single strip row carrying the line count and subtotal", () => {
        const { container } = renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1", finalPrice: 12.5 }), makeLine({ id: "l2", finalPrice: 7.5 })],
        }), true);

        expect(container.querySelectorAll("tr")).toHaveLength(1);
        expect(screen.getByTestId("invoice-group-inv-a")).toBeTruthy();
        // Count on the left, subtotal right-aligned so it sits under the money columns.
        expect(screen.getByText("2 products")).toBeTruthy();
        expect(screen.getByText("20.000")).toBeTruthy();
        // Product columns only exist once the group is expanded.
        expect(screen.queryByTestId("unit-price-cell")).toBeNull();
    });

    it("expands to a strip row, an inline product header, and one row per line — no rowSpan", () => {
        const { container } = renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1" }), makeLine({ id: "l2" }), makeLine({ id: "l3" })],
        }), false);

        // Invoice identity now lives entirely in the strip's own cell — nothing spans rows anymore.
        expect(container.querySelectorAll("td[rowspan]")).toHaveLength(0);
        // strip + inline header + 3 product lines.
        expect(container.querySelectorAll("tr")).toHaveLength(5);
    });

    it("puts the add-product action on the strip and beside the bin on the invoice's last line", () => {
        const { container } = renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1" }), makeLine({ id: "l2" })],
        }), false);

        // rows: [strip, inline header, line1, line2]
        const rows = container.querySelectorAll("tr");
        expect(rows[0].querySelector("[aria-label='add product']")).toBeTruthy();
        expect(rows[1].querySelector("[aria-label='add product']")).toBeNull();
        expect(rows[2].querySelector("[aria-label='add product']")).toBeNull();
        expect(rows[3].querySelector("[aria-label='add product']")).toBeTruthy();
        // Same cell as the delete bin, so the two sit together.
        expect(rows[3].querySelector("[aria-label='delete line']")).toBeTruthy();
    });

    it("adds a product to its own invoice only", () => {
        const { spies } = renderGroup(makeInvoice(), false);

        // The `+` lives both on the strip and on the invoice's (single, also last) line.
        const addButtons = screen.getAllByLabelText("add product");
        expect(addButtons).toHaveLength(2);

        fireEvent.click(addButtons[0]);

        expect(spies.onAddLine).toHaveBeenCalledTimes(1);
        expect(spies.onAddLine).toHaveBeenCalledWith("inv-a");
    });

    it("toggles its own collapse state", () => {
        const { spies } = renderGroup(makeInvoice(), true);

        fireEvent.click(screen.getByTestId("toggle-invoice-inv-a"));

        expect(spies.onToggleCollapse).toHaveBeenCalledWith("inv-a");
    });

    it("deletes the whole invoice when its delete action is used", () => {
        const { spies } = renderGroup(makeInvoice(), false);

        fireEvent.click(screen.getByLabelText("delete invoice"));

        expect(spies.onDeleteInvoice).toHaveBeenCalledWith("inv-a");
    });

    it("marks the invoice paid when the paid checkbox is toggled", () => {
        const { spies } = renderGroup(makeInvoice({ paid: false }), false);

        fireEvent.click(screen.getByLabelText("invoice paid"));

        expect(spies.onUpdateInvoice).toHaveBeenCalledWith("inv-a", { paid: true });
    });

    it("shows paid state on the checkbox, with the static word 'Paid' always visible", () => {
        const { unmount } = renderGroup(makeInvoice({ paid: false }), false);
        expect((screen.getByLabelText("invoice paid") as HTMLInputElement).checked).toBe(false);
        expect(screen.getByTestId("paid-checkbox-inv-a")).toBeTruthy();
        // The word is a static label beside the checkbox now, not a Paid/Unpaid toggle.
        expect(screen.getByText("Paid")).toBeTruthy();
        expect(screen.queryByText("Unpaid")).toBeNull();
        unmount();

        renderGroup(makeInvoice({ paid: true }), false);
        expect((screen.getByLabelText("invoice paid") as HTMLInputElement).checked).toBe(true);
        expect(screen.getByText("Paid")).toBeTruthy();
    });

    it("uses one bin design for the invoice and for each product line", () => {
        renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1" }), makeLine({ id: "l2" })],
        }), false);

        // One invoice bin + one per line, all the same glyph — which bin is which comes from
        // where it sits and from its tooltip, not from a different icon.
        expect(screen.getAllByTestId("DeleteOutlineIcon")).toHaveLength(3);
        expect(screen.queryByTestId("DeleteSweepOutlinedIcon")).toBeNull();
    });

    it("orders the paid checkbox after the vendor field within the strip", () => {
        renderGroup(makeInvoice({ lines: [makeLine({ id: "l1" })] }), false);

        const vendorField = screen.getByPlaceholderText("Acme");
        const paidCheckbox = screen.getByLabelText("invoice paid");

        // eslint-disable-next-line no-bitwise -- DOCUMENT_POSITION_FOLLOWING bitmask check
        expect(vendorField.compareDocumentPosition(paidCheckbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders an empty-state row with an add action when the invoice has no products", () => {
        const { container } = renderGroup(makeInvoice({ lines: [] }), false);

        // strip + empty-state row.
        expect(container.querySelectorAll("tr")).toHaveLength(2);
        expect(screen.getByText("No products yet — use + to add one")).toBeTruthy();
        expect(screen.getByTestId("add-line-inv-a")).toBeTruthy();
    });

    // Unit-level guard: this file renders PurchaseInvoiceGroup in isolation. The integration-level
    // twin in PurchaseTablePopup.test.tsx exercises the same invariant through the full popup —
    // the two are deliberately not redundant (see phases-status.md Phase 2/4 notes).
    it("keeps the strip's colSpan in sync with the inline header's cell count", () => {
        renderGroup(makeInvoice({ lines: [makeLine({ id: "l1" })] }), false);

        const stripCell = screen.getAllByRole("cell")[0];
        const headerCells = screen.getAllByRole("columnheader");

        expect(Number(stripCell.getAttribute("colspan"))).toBe(PRODUCT_COLUMN_COUNT);
        expect(headerCells).toHaveLength(PRODUCT_COLUMN_COUNT);
    });
});
