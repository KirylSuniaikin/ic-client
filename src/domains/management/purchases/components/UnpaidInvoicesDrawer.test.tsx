import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UnpaidInvoicesDrawer } from "./UnpaidInvoicesDrawer";
import { fetchUnpaidPurchaseInvoices, setPurchaseInvoicePaid } from "../../../../shared/api/management";
import type { UnpaidInvoiceTO } from "../types";

jest.mock("../../../../shared/api/management");

function invoice(overrides: Partial<UnpaidInvoiceTO> = {}): UnpaidInvoiceTO {
    return {
        invoiceId: 11,
        reportId: 7,
        reportTitle: "jul-25-bh-admin",
        invoiceDate: "2026-07-10",
        vendorName: "Acme",
        finalPrice: 11.5,
        hasImage: false,
        ...overrides,
    };
}

function renderDrawer(onPaid = jest.fn()) {
    render(
        <UnpaidInvoicesDrawer open={true} branchId="branch-uuid" onClose={jest.fn()} onPaid={onPaid} />
    );
    return { onPaid };
}

describe("UnpaidInvoicesDrawer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(setPurchaseInvoicePaid).mockResolvedValue(undefined);
    });

    it("lists every outstanding invoice with the total owed", async () => {
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({
            invoices: [invoice(), invoice({ invoiceId: 22, vendorName: "Beta", finalPrice: 3.25 })],
            count: 2,
            totalOwed: 14.75,
        });

        renderDrawer();

        expect(await screen.findByTestId("unpaid-row-11")).toBeTruthy();
        expect(screen.getByTestId("unpaid-row-22")).toBeTruthy();
        expect(screen.getByTestId("unpaid-total-owed").textContent).toContain("14.750");
    });

    it("shows which report each invoice belongs to, since the list spans all of them", async () => {
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({
            invoices: [invoice({ reportTitle: "jun-25-bh-admin" })],
            count: 1,
            totalOwed: 11.5,
        });

        renderDrawer();

        expect(await screen.findByText(/jun-25-bh-admin/)).toBeTruthy();
    });

    it("removes a settled invoice from the list and reduces the total owed", async () => {
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({
            invoices: [invoice(), invoice({ invoiceId: 22, vendorName: "Beta", finalPrice: 3.25 })],
            count: 2,
            totalOwed: 14.75,
        });

        const { onPaid } = renderDrawer();
        await screen.findByTestId("unpaid-row-11");

        fireEvent.click(screen.getAllByText("Mark paid")[0]);

        await waitFor(() => expect(setPurchaseInvoicePaid).toHaveBeenCalledWith({ invoiceId: 11, paid: true }));
        await waitFor(() => expect(screen.queryByTestId("unpaid-row-11")).toBeNull());
        expect(screen.getByTestId("unpaid-row-22")).toBeTruthy();
        expect(screen.getByTestId("unpaid-total-owed").textContent).toContain("3.250");
        expect(onPaid).toHaveBeenCalledTimes(1);
    });

    it("keeps the invoice listed when marking it paid fails", async () => {
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({
            invoices: [invoice()], count: 1, totalOwed: 11.5,
        });
        jest.mocked(setPurchaseInvoicePaid).mockRejectedValue(new Error("Response: 500"));

        const { onPaid } = renderDrawer();
        await screen.findByTestId("unpaid-row-11");

        fireEvent.click(screen.getByText("Mark paid"));

        // Dropping the row on a failed request would show a debt as settled when it is not.
        await waitFor(() => expect(screen.getByText("Response: 500")).toBeTruthy());
        expect(screen.getByTestId("unpaid-row-11")).toBeTruthy();
        expect(onPaid).not.toHaveBeenCalled();
    });

    it("says nothing is outstanding when the list is empty", async () => {
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({
            invoices: [], count: 0, totalOwed: 0,
        });

        renderDrawer();

        expect(await screen.findByText("Nothing outstanding — every invoice is paid.")).toBeTruthy();
        expect(screen.getByTestId("unpaid-total-owed").textContent).toContain("0.000");
    });

    it("surfaces a load failure instead of rendering an empty list", async () => {
        jest.mocked(fetchUnpaidPurchaseInvoices).mockRejectedValue(new Error("Response: 503"));

        renderDrawer();

        expect(await screen.findByText("Response: 503")).toBeTruthy();
    });
});
