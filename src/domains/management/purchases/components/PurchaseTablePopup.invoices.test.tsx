import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PurchaseTablePopup } from "./PurchaseTablePopup";
import {
    createPurchaseReport,
    editPurchaseReport,
    fetchProducts,
    fetchVendors,
    getPurchaseReport,
    getUser,
} from "../../../../shared/api/management";
import type { IBranch, ProductTO } from "../../inventory/types";
import type { PurchaseTO } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// jsdom lacks crypto.randomUUID, which mkEmptyInvoice/mkEmptyLine need.
let uuidCounter = 0;
beforeAll(function () {
    if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.randomUUID !== "function") {
        Object.defineProperty(globalThis, "crypto", {
            value: { randomUUID: () => { uuidCounter = uuidCounter + 1; return "test-uuid-" + uuidCounter; } },
            configurable: true,
        });
    }
});

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

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

const twoInvoiceReport: PurchaseTO = {
    id: 7,
    title: "jul-25-bh-admin",
    finalPrice: 30,
    userId: 1,
    purchaseDate: "2026-07-14",
    invoices: [
        {
            id: 11,
            invoiceDate: "2026-07-10",
            vendorName: "Acme",
            paid: false,
            finalPrice: 10,
            hasImage: false,
            products: [{ product: flour, quantity: 1, finalPrice: 10, price: 10 }],
        },
        {
            id: 22,
            invoiceDate: "2026-07-20",
            vendorName: "Acme",
            paid: true,
            finalPrice: 20,
            hasImage: false,
            products: [{ product: flour, quantity: 2, finalPrice: 20, price: 10 }],
        },
    ],
};

function renderPopup(mode: "new" | "edit", onSaved?: (r: any) => void) {
    return render(
        <PurchaseTablePopup
            open={true}
            mode={mode}
            purchaseId={mode === "edit" ? 7 : undefined}
            userId={1}
            branch={branch}
            onClose={jest.fn()}
            onSaved={onSaved}
        />
    );
}

describe("PurchaseTablePopup nested invoices", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(fetchProducts).mockResolvedValue([flour]);
        jest.mocked(fetchVendors).mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(getPurchaseReport).mockResolvedValue(twoInvoiceReport);
    });

    it("offers two distinct add actions: one for invoices and one per invoice for products", async () => {
        renderPopup("edit");

        await screen.findByTestId("invoice-group-inv-0");

        expect(screen.getByTestId("add-invoice")).toBeTruthy();
        expect(screen.getByTestId("add-line-inv-0")).toBeTruthy();
        expect(screen.getByTestId("add-line-inv-1")).toBeTruthy();
    });

    // Distinct data-invoice values, which works whether a group is collapsed (one summary row)
    // or expanded (one row per line).
    const invoiceIdsInOrder = (): string[] => {
        const seen: string[] = [];
        document.querySelectorAll("tr[data-invoice]").forEach((tr) => {
            const id = tr.getAttribute("data-invoice");
            if (id && !seen.includes(id)) seen.push(id);
        });
        return seen;
    };

    it("prepends a new invoice when Add invoice is used", async () => {
        renderPopup("edit");
        await screen.findByTestId("invoice-group-inv-0");

        expect(invoiceIdsInOrder()).toEqual(["inv-0", "inv-1"]);

        fireEvent.click(screen.getByTestId("add-invoice"));

        await waitFor(() => {
            const ids = invoiceIdsInOrder();
            expect(ids).toHaveLength(3);
            // Prepended, mirroring how a new line used to be added at the top.
            expect(ids[0]).not.toBe("inv-0");
            expect(ids.slice(1)).toEqual(["inv-0", "inv-1"]);
        });
    });

    it("adds a product to the targeted invoice without touching the other one", async () => {
        renderPopup("edit");
        await screen.findByTestId("invoice-group-inv-0");

        // An expanded rowSpan group has no wrapper element, so lines are scoped by data-invoice.
        const rowsIn = (id: string) => document.querySelectorAll(`tr[data-invoice="${id}"]`).length;

        // Both start collapsed: one summary row each.
        expect(rowsIn("inv-0")).toBe(1);
        expect(rowsIn("inv-1")).toBe(1);

        fireEvent.click(screen.getByTestId("toggle-invoice-inv-0"));
        await waitFor(() => expect(rowsIn("inv-0")).toBe(1)); // one line, expanded

        fireEvent.click(screen.getByTestId("add-line-inv-0"));

        await waitFor(() => expect(rowsIn("inv-0")).toBe(2));
        expect(rowsIn("inv-1")).toBe(1);
    });

    it("opens an existing report collapsed, so ~40 invoices stay scannable", async () => {
        renderPopup("edit");
        await screen.findByTestId("invoice-group-inv-0");

        // Collapsed: a per-invoice summary row instead of its product rows.
        expect(screen.getByTestId("invoice-group-inv-1")).toBeTruthy();
        // Count on the left, subtotal right-aligned under the money columns.
        expect(screen.getAllByText("1 product").length).toBeGreaterThan(0);
        expect(screen.getAllByText("10.000").length).toBeGreaterThan(0);
        expect(screen.queryByTestId("unit-price-cell")).toBeNull();

        fireEvent.click(screen.getByTestId("expand-all"));

        await waitFor(() => expect(screen.queryByTestId("invoice-group-inv-0")).toBeNull());
        expect(screen.getAllByTestId("unit-price-cell")).toHaveLength(2);
    });

    it("totals every line across every invoice", async () => {
        renderPopup("edit");
        await screen.findByTestId("invoice-group-inv-0");

        // 10 + 20 across two invoices.
        await waitFor(() => expect(screen.getByText("30.000")).toBeTruthy());
    });

    it("sends the nested invoice payload on save, preserving server invoice ids", async () => {
        jest.mocked(editPurchaseReport).mockResolvedValue({
            report: { id: 7, title: "jul-25-bh-admin", finalPrice: 30, createdAt: "", unpaidCount: 1, unpaidAmount: 10 },
            invoices: [{ clientRef: "inv-0", invoiceId: 11 }, { clientRef: "inv-1", invoiceId: 22 }],
        });

        const onSaved = jest.fn();
        renderPopup("edit", onSaved);
        await screen.findByTestId("invoice-group-inv-0");

        // Toggling paid on the first invoice is enough to dirty the form and enable Save,
        // without adding blank lines that validation would then reject.
        fireEvent.click(screen.getAllByLabelText("invoice paid")[0]);
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(editPurchaseReport).toHaveBeenCalledTimes(1));
        const payload = jest.mocked(editPurchaseReport).mock.calls[0][0];

        expect(payload.id).toBe(7);
        expect(payload.invoices).toHaveLength(2);
        // Server ids must survive the round trip, or the invoice's stored photo orphans.
        expect(payload.invoices[0].id).toBe(11);
        expect(payload.invoices[1].id).toBe(22);
        expect(payload.invoices[0].clientRef).toBe("inv-0");
        expect(payload.invoices[0].vendorName).toBe("Acme");
        expect(payload.invoices[1].paid).toBe(true);
        expect(payload.invoices[0].products).toEqual([{ id: 1, quantity: 1, price: 10, finalPrice: 10 }]);

        // onSaved receives the report summary out of SavePurchaseResponse, not the envelope.
        expect(onSaved).toHaveBeenCalledWith(
            expect.objectContaining({ id: 7, unpaidCount: 1 })
        );
    });

    it("sends invoices with a null id for brand-new invoices", async () => {
        jest.mocked(createPurchaseReport).mockResolvedValue({
            report: { id: 9, title: "t", finalPrice: 5, createdAt: "", unpaidCount: 0, unpaidAmount: 0 },
            invoices: [{ clientRef: "test-uuid-1", invoiceId: 99 }],
        });

        renderPopup("new");
        const productInput = await screen.findByPlaceholderText("Select Product");
        fireEvent.change(productInput, { target: { value: "Flour" } });
        fireEvent.click(await screen.findByRole("option", { name: "Flour" }));

        const [qty, total] = screen.getAllByPlaceholderText("0.000");
        fireEvent.change(qty, { target: { value: "1" } });
        fireEvent.blur(qty);
        fireEvent.change(total, { target: { value: "5" } });
        fireEvent.blur(total);

        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(createPurchaseReport).toHaveBeenCalledTimes(1));
        const payload = jest.mocked(createPurchaseReport).mock.calls[0][0];
        expect(payload.invoices[0].id).toBeNull();
        expect(payload.invoices[0].clientRef).toBeTruthy();
    });
});
