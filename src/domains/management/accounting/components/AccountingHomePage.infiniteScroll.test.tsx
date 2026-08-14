import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AccountingHomePage } from "./AccountingHomePage";
import { getAccountingReports } from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";
import type { AccountingReportSummary } from "../types";

jest.mock("../../../../shared/api/management");

// The report editor is a heavy tree with its own suite; this file is about the report list.
jest.mock("./AccountingReportPopup", () => ({ AccountingReportPopup: () => null }));

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

function reports(n: number): AccountingReportSummary[] {
    return Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        title: `report-${i + 1}`,
        createdAt: "2026-07-14T10:00:00",
        version: 0,
        totalIncome: 10,
        totalExpense: 5,
    }));
}

const renderPage = () =>
    render(<AccountingHomePage open={true} onClose={jest.fn()} branch={branch} />);

// Each card renders its report title, so counting titles counts cards.
const cardCount = (): number => screen.queryAllByText(/^report-\d+$/).length;

describe("AccountingHomePage infinite scroll", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders only the first six reports and offers to load more", async () => {
        jest.mocked(getAccountingReports).mockResolvedValue(reports(20));

        renderPage();

        await waitFor(() => expect(cardCount()).toBe(6));
        expect(screen.getByTestId("accounting-scroll-sentinel")).toBeTruthy();
    });

    it("renders everything with no sentinel when there are six or fewer", async () => {
        jest.mocked(getAccountingReports).mockResolvedValue(reports(6));

        renderPage();

        await waitFor(() => expect(cardCount()).toBe(6));
        expect(screen.queryByTestId("accounting-scroll-sentinel")).toBeNull();
    });

    it("keeps the empty state when there are no reports at all", async () => {
        jest.mocked(getAccountingReports).mockResolvedValue([]);

        renderPage();

        expect(await screen.findByText("No accounting reports yet")).toBeTruthy();
        expect(screen.queryByTestId("accounting-scroll-sentinel")).toBeNull();
    });
});
