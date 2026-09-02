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
    channels: [
        {
            period: "2026-06",
            rows: [
                {
                    id: 10, period: "2026-06", channelKey: "talabat", channelLabel: "Talabat",
                    generatedOrders: 269, generatedGrossRevenue: 1741.08,
                    overrideOrders: null, overrideGrossRevenue: null, overrideAppFees: 666.498,
                    effectiveOrders: 269, effectiveGrossRevenue: 1741.08, effectiveAppFees: 666.498,
                    appFeesEntered: true, netRevenue: 1074.582, appCommissionPercent: 38.3,
                    note: null, generatedAt: "2026-07-01T20:00:00", updatedAt: null,
                    updatedByName: null, version: 3,
                },
                {
                    id: 11, period: "2026-06", channelKey: "keeta", channelLabel: "Keeta",
                    generatedOrders: 98, generatedGrossRevenue: 526.498,
                    overrideOrders: null, overrideGrossRevenue: 530.0, overrideAppFees: null,
                    effectiveOrders: 98, effectiveGrossRevenue: 530.0, effectiveAppFees: null,
                    appFeesEntered: false, netRevenue: 530.0, appCommissionPercent: 0,
                    note: null, generatedAt: "2026-07-01T20:00:00", updatedAt: null,
                    updatedByName: null, version: 5,
                },
                {
                    id: 12, period: "2026-06", channelKey: "pick up", channelLabel: "Pick Up",
                    generatedOrders: 254, generatedGrossRevenue: 1667.69,
                    overrideOrders: null, overrideGrossRevenue: null, overrideAppFees: 30.29,
                    effectiveOrders: 254, effectiveGrossRevenue: 1667.69, effectiveAppFees: 30.29,
                    appFeesEntered: true, netRevenue: 1637.4, appCommissionPercent: 1.8,
                    note: null, generatedAt: "2026-07-01T20:00:00", updatedAt: null,
                    updatedByName: null, version: 1,
                },
            ],
            totalOrders: 621, totalGrossRevenue: 3938.77, totalAppFees: 696.788,
            totalNetRevenue: 1604.582, appFeesMissing: true,
        },
    ],
    notices: ["Revenue here includes orders recorded before branches existed."],
};

const mockPatchChannel = jest.fn<Promise<void>, [number, unknown]>();
const mockRegenerateChannels = jest.fn<Promise<void>, []>();

function renderTab(data: BusinessStatsResponse | null = report): ReturnType<typeof render> {
    return render(
        <BusinessTab
            data={data}
            loading={false}
            rangeLabel="Jun 2026 — Jul 2026"
            onRefresh={jest.fn(async () => undefined)}
            onPatchChannel={mockPatchChannel as never}
            onRegenerateChannels={mockRegenerateChannels as never}
        />
    );
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

    describe("channel performance", () => {
        it("warns when a channel has revenue but no app fee", async () => {
            // No channel is genuinely fee-free -- even pick-up carries a card-gateway cut -- so a
            // blank fee overstates profit rather than merely leaving a gap.
            renderTab();

            expect(await screen.findByText(/no app fee entered/)).toBeTruthy();
        });

        it("marks an overridden cell so an edited figure cannot pass for a measured one", async () => {
            renderTab();

            const cell = await screen.findByTestId("cell-grossRevenue-11");
            expect(cell.textContent).toContain("530.000");
        });

        it("sends the clear flags when a row is reverted", async () => {
            // Without them an override could be changed forever but never removed, because a JSON
            // null in a PATCH is indistinguishable from an absent field.
            renderTab();

            await userEvent.click(await screen.findByRole("button", { name: "Revert Keeta" }));

            expect(mockPatchChannel).toHaveBeenCalledWith(11, {
                version: 5, clearOrders: true, clearGrossRevenue: true, clearAppFees: true,
            });
        });

        it("enables revert only on a row that actually carries an override", async () => {
            // Talabat's fee is hand-entered, so its revert is live. A row with nothing overridden
            // has nothing to revert TO, and offering the action would imply otherwise.
            renderTab();

            expect((await screen.findByRole("button", { name: "Revert Talabat" })).hasAttribute("disabled"))
                .toBe(false);
        });

        it("only regenerates after the confirm is accepted", async () => {
            renderTab();

            await userEvent.click(await screen.findByRole("button", { name: /Refresh channel data/ }));
            expect(mockRegenerateChannels).not.toHaveBeenCalled();

            await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
            expect(mockRegenerateChannels).toHaveBeenCalledTimes(1);
        });

        it("promises that manual edits survive a refresh", async () => {
            // Prep-plan's "this will replace the current plan" would be a lie here and would make
            // the owner afraid to press the button.
            renderTab();

            await userEvent.click(await screen.findByRole("button", { name: /Refresh channel data/ }));

            expect(await screen.findByText(/Your manual edits are kept/)).toBeTruthy();
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
