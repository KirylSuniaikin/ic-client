import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PurchaseInvoiceBlock } from "./PurchaseInvoiceBlock";
import type { PurchaseInvoiceRow, PurchaseLineRow } from "../types";
import type { ProductTO } from "../../inventory/types";

const flour: ProductTO = {
    id: 1,
    name: "Flour",
    targetPrice: 7,
    price: 7,
    isInventory: true,
    isPurchasable: true,
    isBundle: false,
    topVendor: "Acme",
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

function renderBlock(invoice: PurchaseInvoiceRow, handlers: Record<string, any> = {}) {
    const spies = {
        onUpdateInvoice: jest.fn(),
        onDeleteInvoice: jest.fn(),
        onAddLine: jest.fn(),
        onUpdateLine: jest.fn(),
        onCommitNumeric: jest.fn(),
        onApplyProduct: jest.fn(),
        onDeleteLine: jest.fn(),
        ...handlers,
    };
    render(
        <PurchaseInvoiceBlock
            invoice={invoice}
            products={[flour]}
            vendors={[{ id: 1, vendorName: "Acme" }]}
            productById={new Map([[1, flour]])}
            invalid={new Map()}
            {...(spies as any)}
        />
    );
    return spies;
}

describe("PurchaseInvoiceBlock", () => {
    it("adds a product to its own invoice only", () => {
        const spies = renderBlock(makeInvoice());

        fireEvent.click(screen.getByTestId("add-line-inv-a"));

        expect(spies.onAddLine).toHaveBeenCalledTimes(1);
        expect(spies.onAddLine).toHaveBeenCalledWith("inv-a");
    });

    it("deletes the whole invoice when its delete action is used", () => {
        const spies = renderBlock(makeInvoice());

        fireEvent.click(screen.getByLabelText("delete invoice"));

        expect(spies.onDeleteInvoice).toHaveBeenCalledWith("inv-a");
    });

    it("marks the invoice paid when the paid switch is toggled", () => {
        const spies = renderBlock(makeInvoice({ paid: false }));

        fireEvent.click(screen.getByLabelText("invoice paid"));

        expect(spies.onUpdateInvoice).toHaveBeenCalledWith("inv-a", { paid: true });
    });

    it("shows Unpaid when the invoice is not paid and Paid when it is", () => {
        const { unmount } = render(
            <PurchaseInvoiceBlock
                invoice={makeInvoice({ paid: false })}
                products={[flour]}
                vendors={[]}
                productById={new Map([[1, flour]])}
                invalid={new Map()}
                onUpdateInvoice={jest.fn()}
                onDeleteInvoice={jest.fn()}
                onAddLine={jest.fn()}
                onUpdateLine={jest.fn()}
                onCommitNumeric={jest.fn()}
                onApplyProduct={jest.fn()}
                onDeleteLine={jest.fn()}
            />
        );
        expect(screen.getByTestId("paid-label-inv-a").textContent).toBe("Unpaid");
        unmount();

        renderBlock(makeInvoice({ paid: true }));
        expect(screen.getByTestId("paid-label-inv-a").textContent).toBe("Paid");
    });

    it("shows a subtotal equal to the sum of its own lines", () => {
        renderBlock(makeInvoice({
            lines: [
                makeLine({ id: "l1", finalPrice: 12.5 }),
                makeLine({ id: "l2", finalPrice: 7.5 }),
            ],
        }));

        expect(screen.getByTestId("invoice-subtotal-inv-a").textContent).toContain("20.000");
    });

    it("renders an empty-state row when the invoice has no products yet", () => {
        renderBlock(makeInvoice({ lines: [] }));

        expect(screen.getByText("No products yet — use Add product")).toBeTruthy();
    });
});
