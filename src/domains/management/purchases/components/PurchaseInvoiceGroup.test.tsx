import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PurchaseInvoiceGroup } from "./PurchaseInvoiceGroup";
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
    it("collapses to a single summary row carrying the line count and subtotal", () => {
        const { container } = renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1", finalPrice: 12.5 }), makeLine({ id: "l2", finalPrice: 7.5 })],
        }), true);

        expect(container.querySelectorAll("tr")).toHaveLength(1);
        // Count on the left, subtotal right-aligned so it sits under the money columns.
        expect(screen.getByText("2 products")).toBeTruthy();
        expect(screen.getByText("20.000")).toBeTruthy();
        // Product columns are replaced by the summary while collapsed.
        expect(screen.queryByTestId("unit-price-cell")).toBeNull();
    });

    it("expands to one row per line, with the invoice cells rowSpan-ed across them", () => {
        const { container } = renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1" }), makeLine({ id: "l2" }), makeLine({ id: "l3" })],
        }), false);

        expect(container.querySelectorAll("tr")).toHaveLength(3);
        // Date / photo / vendor / paid appear once, spanning all three product rows.
        const spanned = Array.from(container.querySelectorAll("td[rowspan]"));
        expect(spanned).toHaveLength(4);
        spanned.forEach((td) => expect(td.getAttribute("rowspan")).toBe("3"));
    });

    it("opens the group with a rule on the whole first row, not just the invoice cells", () => {
        renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1" }), makeLine({ id: "l2" })],
        }), false);

        // The rule used to be set on the four rowSpan-ed cells, so it stopped part-way across a
        // ten-column table. It belongs to the <tr>, which covers every cell of the row.
        const rows = screen.getAllByRole("row");
        expect(rows[0].getAttribute("data-group-start")).toBe("true");
        expect(rows[1].getAttribute("data-group-start")).toBeNull();
    });

    it("puts the add-product action beside the bin on the invoice's last line", () => {
        const { container } = renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1" }), makeLine({ id: "l2" })],
        }), false);

        const rows = container.querySelectorAll("tr");
        expect(rows[0].querySelector("[aria-label='add product']")).toBeNull();
        expect(rows[1].querySelector("[aria-label='add product']")).toBeTruthy();
        // Same cell as the delete bin, so the two sit together.
        expect(rows[1].querySelector("[aria-label='delete line']")).toBeTruthy();
    });

    it("adds a product to its own invoice only", () => {
        const { spies } = renderGroup(makeInvoice(), false);

        fireEvent.click(screen.getByLabelText("add product"));

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

    it("marks the invoice paid when the paid switch is toggled", () => {
        const { spies } = renderGroup(makeInvoice({ paid: false }), false);

        fireEvent.click(screen.getByLabelText("invoice paid"));

        expect(spies.onUpdateInvoice).toHaveBeenCalledWith("inv-a", { paid: true });
    });

    it("carries paid state on the switch itself, with no word printed beside it", () => {
        const { unmount } = renderGroup(makeInvoice({ paid: false }), false);
        expect((screen.getByLabelText("invoice paid") as HTMLInputElement).checked).toBe(false);
        // The column is a colour and a knob position now — 40 repetitions of "Unpaid" was noise.
        expect(screen.queryByText("Unpaid")).toBeNull();
        unmount();

        renderGroup(makeInvoice({ paid: true }), false);
        expect((screen.getByLabelText("invoice paid") as HTMLInputElement).checked).toBe(true);
        expect(screen.queryByText("Paid")).toBeNull();
    });

    it("centres the vendor down the group instead of pinning it to the first line", () => {
        renderGroup(makeInvoice({
            lines: [makeLine({ id: "l1" }), makeLine({ id: "l2" }), makeLine({ id: "l3" })],
        }), false);

        const cells = screen.getAllByRole("cell");
        // Date / photo / status stay on the first line; vendor sits against the middle product.
        expect(getComputedStyle(cells[0]).verticalAlign).toBe("top");
        expect(getComputedStyle(cells[1]).verticalAlign).toBe("top");
        expect(getComputedStyle(cells[2]).verticalAlign).toBe("top");
        expect(getComputedStyle(cells[3]).verticalAlign).toBe("middle");
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

    it("keeps status with the invoice identity columns, before vendor", () => {
        renderGroup(makeInvoice({ lines: [makeLine({ id: "l1" })] }), false);

        const cells = screen.getAllByRole("cell");
        // Date, Invoice photo, Status, Vendor, then the product columns.
        expect(cells[2].contains(screen.getByLabelText("invoice paid"))).toBe(true);
        expect(cells[3].contains(screen.getByPlaceholderText("Acme"))).toBe(true);
    });

    it("renders an empty-state row with an add action when the invoice has no products", () => {
        const { container } = renderGroup(makeInvoice({ lines: [] }), false);

        expect(container.querySelectorAll("tr")).toHaveLength(1);
        expect(screen.getByText("No products yet — use + to add one")).toBeTruthy();
        expect(screen.getByTestId("add-line-inv-a")).toBeTruthy();
    });
});
