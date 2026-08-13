import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PurchaseTablePopup } from "./PurchaseTablePopup";
import {
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

// inv-0 unpaid, inv-1 paid — one of each, so every filter has exactly one expected survivor.
const mixedReport: PurchaseTO = {
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

function renderPopup() {
    return render(
        <PurchaseTablePopup
            open={true}
            mode="edit"
            purchaseId={7}
            userId={1}
            branch={branch}
            onClose={jest.fn()}
        />
    );
}

const visibleInvoiceIds = (): string[] =>
    screen.queryAllByTestId(/^invoice-group-/).map((el) => el.getAttribute("data-invoice") ?? "");

describe("PurchaseTablePopup paid filter", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(fetchProducts).mockResolvedValue([flour]);
        jest.mocked(fetchVendors).mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(getPurchaseReport).mockResolvedValue(mixedReport);
    });

    it("shows every invoice until a filter is chosen", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        expect(visibleInvoiceIds()).toEqual(["inv-0", "inv-1"]);
    });

    it("'Unpaid' leaves only the unpaid invoice", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("paid-filter-unpaid"));

        expect(visibleInvoiceIds()).toEqual(["inv-0"]);
    });

    it("'Paid' leaves only the paid invoice", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("paid-filter-paid"));

        expect(visibleInvoiceIds()).toEqual(["inv-1"]);
    });

    it("'All' restores the hidden invoices", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("paid-filter-paid"));
        fireEvent.click(screen.getByTestId("paid-filter-all"));

        expect(visibleInvoiceIds()).toEqual(["inv-0", "inv-1"]);
    });

    it("explains an empty table under a filter rather than claiming the report is empty", async () => {
        jest.mocked(getPurchaseReport).mockResolvedValue({
            ...mixedReport,
            invoices: [mixedReport.invoices[1]], // the paid one only
        });
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("paid-filter-unpaid"));

        expect(screen.getByText("No unpaid invoices in this report")).toBeTruthy();
        expect(screen.queryByText(/No invoices yet/)).toBeNull();
    });

    // The filter is a view concern. If it ever reached the save payload, hiding an invoice would
    // silently delete it from the report on the next save.
    it("saves every invoice, including the ones the active filter hides", async () => {
        jest.mocked(editPurchaseReport).mockResolvedValue({
            report: { id: 7, title: "jul-25-bh-admin", finalPrice: 30, createdAt: "", unpaidCount: 1, unpaidAmount: 10 },
            invoices: [{ clientRef: "inv-0", invoiceId: 11 }, { clientRef: "inv-1", invoiceId: 22 }],
        });

        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        // Hide the paid invoice, then dirty the one still on screen.
        fireEvent.click(screen.getByTestId("paid-filter-unpaid"));
        expect(visibleInvoiceIds()).toEqual(["inv-0"]);

        fireEvent.click(screen.getAllByLabelText("invoice paid")[0]);
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(editPurchaseReport).toHaveBeenCalledTimes(1));
        const payload = jest.mocked(editPurchaseReport).mock.calls[0][0];

        expect(payload.invoices).toHaveLength(2);
        expect(payload.invoices.map(inv => inv.id).sort()).toEqual([11, 22]);
    });
});
