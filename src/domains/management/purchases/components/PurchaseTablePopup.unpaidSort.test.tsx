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

function invoice(id: number, invoiceDate: string, paid: boolean) {
    return {
        id,
        invoiceDate,
        vendorName: "Acme",
        paid,
        finalPrice: 10,
        hasImage: false,
        products: [{ product: flour, quantity: 1, finalPrice: 10, price: 10 }],
    };
}

// Deliberately interleaved paid/unpaid AND out of date order, so neither ordering can pass by
// accident: newest→oldest is 07-25, 07-20, 07-15, 07-10; unpaid are the 07-20 and 07-10 ones.
const mixedReport: PurchaseTO = {
    id: 7,
    title: "jul-25-bh-admin",
    finalPrice: 40,
    userId: 1,
    purchaseDate: "2026-07-14",
    invoices: [
        invoice(11, "2026-07-15", true),
        invoice(22, "2026-07-20", false),
        invoice(33, "2026-07-10", false),
        invoice(44, "2026-07-25", true),
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

// Every row of an invoice carries data-invoice; the strip row is the one with the group testid,
// so this reads the invoice order without depending on which groups are expanded.
const invoiceOrder = (): string[] =>
    screen.queryAllByTestId(/^invoice-group-/).map((el) => el.getAttribute("data-invoice") ?? "");

// Client refs are assigned in the order the SERVER sent them, so they identify invoices
// independently of where the sort puts them: inv-0=11, inv-1=22, inv-2=33, inv-3=44.
const PAID = ["inv-0", "inv-3"];
const UNPAID = ["inv-1", "inv-2"];

describe("PurchaseTablePopup unpaid sort", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(fetchProducts).mockResolvedValue([flour]);
        jest.mocked(fetchVendors).mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(getPurchaseReport).mockResolvedValue(mixedReport);
    });

    it("opens ordered by date, newest first", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        // 44 (07-25), 22 (07-20), 11 (07-15), 33 (07-10)
        expect(invoiceOrder()).toEqual(["inv-3", "inv-1", "inv-0", "inv-2"]);
    });

    it("lifts the unpaid invoices above the paid ones when Unpaid is tapped", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("sort-unpaid"));

        await waitFor(() => {
            const order = invoiceOrder();
            expect(order.slice(0, 2).sort()).toEqual(UNPAID);
            expect(order.slice(2).sort()).toEqual(PAID);
        });
    });

    it("keeps newest-first inside each paid group", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("sort-unpaid"));

        // unpaid: 22 (07-20) then 33 (07-10); paid: 44 (07-25) then 11 (07-15)
        await waitFor(() => expect(invoiceOrder()).toEqual(["inv-1", "inv-2", "inv-3", "inv-0"]));
    });

    // The old control filtered, which made a report look like invoices had gone missing and left
    // the totals disagreeing with the rows on screen.
    it("hides nothing — every invoice is still on screen under either order", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        expect(invoiceOrder()).toHaveLength(4);

        fireEvent.click(screen.getByTestId("sort-unpaid"));

        await waitFor(() => expect(invoiceOrder()).toHaveLength(4));
    });

    it("puts the paid invoices back on top when Unpaid is tapped again", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("sort-unpaid"));
        await waitFor(() => expect(invoiceOrder().slice(0, 2).sort()).toEqual(UNPAID));

        fireEvent.click(screen.getByTestId("sort-unpaid"));

        await waitFor(() => expect(invoiceOrder().slice(0, 2).sort()).toEqual(PAID));
    });

    it("offers no paid/unpaid filter any more", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        expect(screen.queryByTestId("paid-filter-all")).toBeNull();
        expect(screen.queryByTestId("paid-filter-paid")).toBeNull();
        expect(screen.queryByTestId("paid-filter-unpaid")).toBeNull();
    });

    it("still saves every invoice after reordering by paid state", async () => {
        jest.mocked(editPurchaseReport).mockResolvedValue({
            report: { id: 7, title: "jul-25-bh-admin", finalPrice: 40, createdAt: "", unpaidCount: 2, unpaidAmount: 20 },
            invoices: [
                { clientRef: "inv-0", invoiceId: 11 },
                { clientRef: "inv-1", invoiceId: 22 },
                { clientRef: "inv-2", invoiceId: 33 },
                { clientRef: "inv-3", invoiceId: 44 },
            ],
        });

        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        fireEvent.click(screen.getByTestId("sort-unpaid"));
        await waitFor(() => expect(invoiceOrder().slice(0, 2).sort()).toEqual(UNPAID));

        fireEvent.click(screen.getAllByLabelText("invoice paid")[0]);
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(editPurchaseReport).toHaveBeenCalledTimes(1));
        const payload = jest.mocked(editPurchaseReport).mock.calls[0][0];

        expect(payload.invoices).toHaveLength(4);
        expect(payload.invoices.map((inv) => inv.id).sort((a, b) => Number(a) - Number(b)))
            .toEqual([11, 22, 33, 44]);
    });
});
