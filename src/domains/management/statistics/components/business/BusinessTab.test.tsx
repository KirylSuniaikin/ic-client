import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BusinessTab from "./BusinessTab";
import type { BusinessStatsResponse, CategoryClassification } from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts. useBusinessCategories
// runs for real, so the fetch -> classify -> refetch wiring is genuine.
jest.mock("../../../../../shared/api/management");

import { getBusinessCategories, updateCategoryClassification } from "../../../../../shared/api/management";

const mockGet = jest.mocked(getBusinessCategories);
const mockUpdate = jest.mocked(updateCategoryClassification);

const marketing: CategoryClassification = {
    id: 1, name: "Marketing", type: "DEBIT", pnlClass: null, kpiTag: null,
    entryCount: 12, lifetimeTotal: 4102.5,
};
const rent: CategoryClassification = {
    id: 2, name: "Rent", type: "DEBIT", pnlClass: "OPEX", kpiTag: "RENT",
    entryCount: 14, lifetimeTotal: 2521.54,
};

const report: BusinessStatsResponse = {
    months: ["2026-06", "2026-07"],
    expensePivot: {
        months: ["2026-06", "2026-07"],
        blocks: [
            {
                pnlClass: "OPEX", label: "Operating expenses", note: null,
                includedInOperatingExpenses: true,
                rows: [{ categoryId: 2, categoryName: "Rent", kpiTag: "RENT", amounts: [180, 180.11], total: 360.11 }],
                totals: [180, 180.11], grandTotal: 360.11,
            },
            {
                pnlClass: "COGS_PURCHASES", label: "COGS — groceries & packaging",
                note: "Reaches the P&L through COGS via inventory.",
                includedInOperatingExpenses: false,
                rows: [{ categoryId: 3, categoryName: "Groceries", kpiTag: null, amounts: [731.19, 866.648], total: 1597.838 }],
                totals: [731.19, 866.648], grandTotal: 1597.838,
            },
        ],
        unclassifiedCategoryCount: 1,
        unclassifiedTotal: 4102.5,
    },
    revenue: [],
    inventoryCogs: [
        {
            period: "2026-06", state: "OK", monthInProgress: false,
            openingInventory: 553.679, purchases: 808.69, available: 1362.369,
            endingInventory: 522.673, movementCogs: 839.696, cogsPercentOfGrossRevenue: 25.7,
            contributingBranches: ["Adliya"], missingBranches: [], missingReports: [],
        },
        {
            period: "2026-07", state: "MISSING_PURCHASES", monthInProgress: false,
            openingInventory: 522.673, purchases: null, available: null,
            endingInventory: 896.003, movementCogs: null, cogsPercentOfGrossRevenue: null,
            contributingBranches: [], missingBranches: ["Adliya"],
            missingReports: ["PURCHASE jul-26 @ Adliya"],
        },
    ],
    notices: ["Revenue here includes orders recorded before branches existed."],
};

function renderTab(data: BusinessStatsResponse | null = report): ReturnType<typeof render> {
    return render(<BusinessTab data={data} loading={false} onRefresh={jest.fn(async () => undefined)} />);
}

describe("BusinessTab", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGet.mockResolvedValue([marketing, rent]);
        mockUpdate.mockResolvedValue({ ...marketing, pnlClass: "OPEX" });
    });

    describe("classification", () => {
        it("warns with the count and the amount when categories are unclassified", async () => {
            // The amount is the point: "1 unclassified" is ignorable, "4,102.500 BHD" is not, and
            // that spend is currently in no P&L total.
            renderTab();

            expect(await screen.findByText(/1 unclassified · 4,102.500 BHD/)).toBeTruthy();
        });

        it("reports success when everything is classified", async () => {
            mockGet.mockResolvedValue([rent]);

            renderTab();

            expect(await screen.findByText(/All 1 categories classified/)).toBeTruthy();
        });

        it("patches only the chosen category and refetches when a class is picked", async () => {
            renderTab();
            await screen.findByRole("button", { name: "Classify categories" });
            await userEvent.click(screen.getByRole("button", { name: "Classify categories" }));

            const row = await screen.findByTestId("category-row-1");
            await userEvent.click(within(row).getByRole("combobox", { name: /P&L class/i }));
            await userEvent.click(await screen.findByRole("option", { name: /Operating expense/ }));

            await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
            // Both fields go every time: sending only the changed one would clear the other.
            expect(mockUpdate).toHaveBeenCalledWith(1, { pnlClass: "OPEX", kpiTag: null });
            await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
        });

        it("keeps rendering when the categories request fails", async () => {
            // Errors go to the logger and are never thrown at the UI, matching useStatistics.
            mockGet.mockRejectedValue(new Error("Response: 500"));

            renderTab();

            expect(await screen.findByText(/All 0 categories classified/)).toBeTruthy();
        });
    });

    describe("expense pivot", () => {
        it("renders a column per month and a row per category", async () => {
            renderTab();

            expect(await screen.findByText("Rent")).toBeTruthy();
            expect(screen.getByText("Groceries")).toBeTruthy();
            expect(screen.getAllByText("Jun 26").length).toBeGreaterThan(0);
        });

        it("marks a block that is not part of operating expenses", async () => {
            // Groceries and packaging are visible but deliberately outside the Operating Expenses
            // total; without the label a reader would assume the total was simply wrong.
            renderTab();

            expect(await screen.findByText(/not in Operating Expenses/)).toBeTruthy();
        });
    });

    describe("inventory COGS", () => {
        it("shows an em dash rather than a zero when a month cannot be computed", async () => {
            // Zero is a claim about the business; absence is a claim about the paperwork. Printing
            // the first when you mean the second turns unfiled invoices into a brilliant margin.
            renderTab();

            expect((await screen.findByTestId("cogs-missing-2026-07")).textContent).toBe("—");
        });

        it("names the missing document for a completed month", async () => {
            renderTab();

            expect(await screen.findByText(/PURCHASE jul-26 @ Adliya/)).toBeTruthy();
        });
    });

    it("surfaces the server's notices", async () => {
        renderTab();

        expect(await screen.findByText(/includes orders recorded before branches existed/)).toBeTruthy();
    });

    it("says the report could not be loaded when it is absent", async () => {
        renderTab(null);

        expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    });
});
