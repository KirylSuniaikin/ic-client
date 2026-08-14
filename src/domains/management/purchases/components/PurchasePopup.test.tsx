import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PurchasePopup } from "./PurchasePopup";
import {
    fetchUnpaidPurchaseInvoices,
    getReports,
    getUser,
    setPurchaseInvoicePaid,
} from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";
import type { BasePurchaseResponse } from "../types";

jest.mock("../../../../shared/api/management");

// The nested table popup is a heavy tree with its own suites; this file is about the report list.
jest.mock("./PurchaseTablePopup", () => ({ PurchaseTablePopup: () => null }));

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

function report(overrides: Partial<BasePurchaseResponse> = {}): BasePurchaseResponse {
    return {
        id: 1,
        title: "jul-25-bh-admin",
        finalPrice: 100,
        createdAt: "2026-07-14T10:00:00",
        unpaidCount: 0,
        unpaidAmount: 0,
        ...overrides,
    };
}

function renderPopup() {
    return render(<PurchasePopup open={true} onClose={jest.fn()} adminId={1} branch={branch} />);
}

describe("PurchasePopup outstanding surfaces", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(setPurchaseInvoicePaid).mockResolvedValue(undefined);
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({ invoices: [], count: 0, totalOwed: 0 });
    });

    it("sums the outstanding badge across every report, with no extra request", async () => {
        jest.mocked(getReports).mockResolvedValue([
            report({ id: 1, unpaidCount: 2, unpaidAmount: 10.5 }),
            report({ id: 2, unpaidCount: 1, unpaidAmount: 4.5 }),
        ] as any);

        renderPopup();

        expect((await screen.findByTestId("unpaid-summary-amount")).textContent).toBe("15.000 BHD");
        // Both counts come off the same list, so the banner can say where the money is owed.
        expect(screen.getByText("3 invoices in 2 reports")).toBeTruthy();
        // The per-report totals ride along on the report list, so nothing extra is fetched on mount.
        expect(fetchUnpaidPurchaseInvoices).not.toHaveBeenCalled();
    });

    it("hides the outstanding banner when nothing is outstanding", async () => {
        jest.mocked(getReports).mockResolvedValue([report({ unpaidCount: 0 })] as any);

        renderPopup();

        await screen.findByText("jul-25-bh-admin");
        expect(screen.queryByTestId("unpaid-summary")).toBeNull();
    });



    it("opens the outstanding drawer from the banner's review action", async () => {
        jest.mocked(getReports).mockResolvedValue([report({ unpaidCount: 1, unpaidAmount: 5 })] as any);

        renderPopup();
        fireEvent.click(await screen.findByTestId("unpaid-summary-review"));

        await waitFor(() => expect(fetchUnpaidPurchaseInvoices).toHaveBeenCalledWith("branch-uuid"));
        expect(await screen.findByText("Outstanding invoices")).toBeTruthy();
    });

    it("refreshes the report badges after an invoice is settled in the drawer", async () => {
        jest.mocked(getReports)
            .mockResolvedValueOnce([report({ id: 1, unpaidCount: 1, unpaidAmount: 5 })] as any)
            .mockResolvedValueOnce([report({ id: 1, unpaidCount: 0, unpaidAmount: 0 })] as any);
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({
            invoices: [{
                invoiceId: 11, reportId: 1, reportTitle: "jul-25-bh-admin",
                invoiceDate: "2026-07-10", vendorName: "Acme", finalPrice: 5, hasImage: false,
            }],
            count: 1,
            totalOwed: 5,
        });

        renderPopup();
        fireEvent.click(await screen.findByTestId("unpaid-summary-review"));
        fireEvent.click(await screen.findByText("Mark paid"));

        // The badge lives on the report list, not in the drawer's response, so it has to refetch.
        await waitFor(() => expect(getReports).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByTestId("unpaid-summary")).toBeNull());
    });


    it("shows the list as skeletons while loading, keeping the screen in place", async () => {
        let resolveReports: (v: any) => void = () => {};
        jest.mocked(getReports).mockReturnValue(new Promise((res) => { resolveReports = res; }) as any);

        renderPopup();

        // The screen itself is mounted immediately rather than replaced by a bare spinner.
        expect(screen.getByText("Purchase")).toBeTruthy();
        expect(screen.getByTestId("report-skeletons")).toBeTruthy();

        resolveReports([report({ title: "jul-25-bh-admin" })]);

        expect(await screen.findByText("jul-25-bh-admin")).toBeTruthy();
        expect(screen.queryByTestId("report-skeletons")).toBeNull();
    });
});
