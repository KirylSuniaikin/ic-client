import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { PurchasePopup } from "./PurchasePopup";
import {
    fetchUnpaidPurchaseInvoices,
    getReports,
    getUser,
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

function reports(n: number, unpaidEach = 0): BasePurchaseResponse[] {
    return Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        title: `report-${i + 1}`,
        finalPrice: 100,
        createdAt: "2026-07-14T10:00:00",
        unpaidCount: unpaidEach,
        unpaidAmount: unpaidEach,
    }));
}

const renderPopup = () =>
    render(<PurchasePopup open={true} onClose={jest.fn()} adminId={1} branch={branch} />);

// Each card renders its report title, so counting titles counts cards without needing the card
// component to grow a testid purely for this test.
const cardCount = (): number => screen.queryAllByText(/^report-\d+$/).length;

describe("PurchasePopup infinite scroll", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(fetchUnpaidPurchaseInvoices).mockResolvedValue({ invoices: [], count: 0, totalOwed: 0 });
    });

    it("renders only the first six reports and offers to load more", async () => {
        jest.mocked(getReports).mockResolvedValue(reports(20) as any);

        renderPopup();

        await waitFor(() => expect(cardCount()).toBe(6));
        expect(screen.getByTestId("purchase-scroll-sentinel")).toBeTruthy();
    });

    it("renders everything with no sentinel when there are six or fewer", async () => {
        jest.mocked(getReports).mockResolvedValue(reports(4) as any);

        renderPopup();

        await waitFor(() => expect(cardCount()).toBe(4));
        expect(screen.queryByTestId("purchase-scroll-sentinel")).toBeNull();
    });

    // The whole reason this windows the view instead of paging the request: these two read the
    // full list, and paging the fetch would quietly make them describe only what was fetched.
    it("counts and sums every report, not just the six on screen", async () => {
        jest.mocked(getReports).mockResolvedValue(reports(20, 2) as any);

        renderPopup();

        await waitFor(() => expect(cardCount()).toBe(6));
        expect(screen.getByText("20 reports")).toBeTruthy();
        expect(screen.getByTestId("unpaid-summary-amount").textContent).toBe("40.000 BHD");
    });
});
