import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatisticsComponent from "./StatisticsComponent";
import { ManagementBranchScopeProvider } from "../../_shared/context/ManagementBranchScope";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import type { BusinessStatsResponse, ComponentCost, StatsResponse } from "../types";

// Unlike StatisticsComponent.test.tsx, PricingCostCardsSection is deliberately left UNSTUBBED
// here: this file exists to verify its actual mount-gated fetch (useCostCards' own effect, task
// -spec.md §4 item 10) and the onCostSaved wiring (§4 item 12), both of which a stub would hide.
// Every other heavy tab child is still stubbed, for the same reasons as the sibling suite
// (TextEncoder polyfill gap in this test environment; unrelated to this file's coverage).
jest.mock("./tabs/PerformanceTab", () => ({ PerformanceTab: () => null }));
jest.mock("./PrepPlanTable", () => ({ __esModule: true, default: () => null }));
jest.mock("./DoughUsageTable", () => ({ DoughUsageTable: () => null }));
jest.mock("../../consumption/components/ConsumptionStatistics", () => ({ ConsumptionStatistics: () => null }));
jest.mock("./VatReportCard", () => ({ VatReportCard: () => null }));
jest.mock("./ProductsTable", () => ({ ProductsTable: () => null }));
jest.mock("../../shift/components/StaffSummaryContent", () => ({ StaffSummaryContent: () => null }));
jest.mock("./business/BusinessTab", () => ({ __esModule: true, default: () => null }));

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts and
// src/shared/api/__mocks__/public.ts. Real PricingCostCardsSection -> useCostCards ->
// getMenuCostCards/getComponentCosts and real useBusinessStats -> getBusinessStats all run, with
// the underlying HTTP functions under test control.
jest.mock("../../../../shared/api/management");
jest.mock("../../../../shared/api/public");

import { fetchStatistics } from "../../../../shared/api/public";
import {
    getBusinessStats, getComponentCosts, getMenuCostCards, updateComponentCost
} from "../../../../shared/api/management";

const mockFetchStatistics = jest.mocked(fetchStatistics);
const mockCostCards = jest.mocked(getMenuCostCards);
const mockComponents = jest.mocked(getComponentCosts);
const mockBusinessStats = jest.mocked(getBusinessStats);
const mockUpdateComponentCost = jest.mocked(updateComponentCost);

const branchA: IBranch = { id: "a", externalId: "ext-a", branchNo: 1, branchName: "Branch A", locale: "en" };
const branchB: IBranch = { id: "b", externalId: "ext-b", branchNo: 2, branchName: "Branch B", locale: "en" };

const emptyStats = {
    totalPickUpRevenue: 0,
    totalPickUpOrderCount: 0,
    newCustomerOrderedCount: 0,
    oldCustomerOrderedCount: 0,
    oldCstmrOrderCount: 0,
    arpu: null,
    uniqueCustomersAllTime: 0,
    repeatCustomersAllTime: 0,
    averageOrderValueAllTime: null,
    monthTotalCustomers: 0,
    retainedCustomers: 0,
    retentionPercentage: null,
    doughUsageTOS: [],
    sellsByHour: [],
    totalTalabatOrders: 0,
    totalTalabatRevenue: 0,
    topProducts: [],
    totalKeetaOrders: 0,
    totalKeetaRevenue: 0,
    averagePrepTimeSeconds: null,
    // `as unknown as StatsResponse`: this fixture is deliberately partial (only the fields this
    // suite's stubbed tab children could plausibly read), not the full `StatsResponse` shape, so a
    // direct `satisfies`/typed literal would force filling in every unrelated field. The mocked
    // `fetchStatistics` return type is the only place this value is consumed.
} as unknown as StatsResponse;

const emptyBusinessStats: BusinessStatsResponse = {
    months: [],
    expensePivot: { months: [], blocks: [], unclassifiedCategoryCount: 0, unclassifiedTotal: 0 },
    revenue: [],
    inventoryCogs: [],
    channels: [],
    profitAndLoss: [],
    kpi: [],
    costing: { componentsUsed: 0, componentsResolved: 0, coveragePercent: 100, warnings: [] },
    notices: [],
};

const oregano: ComponentCost = {
    id: 5, name: "Oregano", unit: "GRAMS", productId: null, productName: null,
    productPrice: null, cost: null, batchYield: null, ingredients: [],
    resolvedUnitCost: 0, costSource: "MISSING",
};

function renderAs(role: StaffRoles): ReturnType<typeof render> {
    return render(
        <ManagementBranchScopeProvider branches={[branchA, branchB]} homeBranch={branchA}>
            <StatisticsComponent onClose={jest.fn()} branchId={branchA.id} role={role} />
        </ManagementBranchScopeProvider>
    );
}

async function switchTab(name: string): Promise<void> {
    await userEvent.click(screen.getByRole("button", { name }));
}

describe("StatisticsComponent — Pricing cost-card data wiring", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchStatistics.mockResolvedValue(emptyStats);
        mockCostCards.mockResolvedValue({
            cards: [], menuItemsWithoutRecipe: [],
            costing: { componentsUsed: 0, componentsResolved: 0, coveragePercent: 100, warnings: [] },
        });
        mockComponents.mockResolvedValue([]);
        mockBusinessStats.mockResolvedValue(emptyBusinessStats);
    });

    // task-spec.md §4 item 10: fires only when Pricing is active AND the viewer is MANAGER+.
    describe("cost-card fetch gate", () => {
        it("does not fetch cost cards for a MANAGER on the default Performance tab", async () => {
            renderAs(StaffRoles.MANAGER);

            // useStatistics' own mount fetch is a timing proxy: once it has resolved, any other
            // mount-time effect (including a wrongly-gated useCostCards) would have fired too.
            await waitFor(() => expect(mockFetchStatistics).toHaveBeenCalled());
            expect(mockCostCards).not.toHaveBeenCalled();
            expect(mockComponents).not.toHaveBeenCalled();
        });

        it("fetches cost cards for a MANAGER once the Pricing tab is opened", async () => {
            renderAs(StaffRoles.MANAGER);
            await switchTab("Pricing");

            await waitFor(() => expect(mockCostCards).toHaveBeenCalledTimes(1));
            expect(mockComponents).toHaveBeenCalledTimes(1);
        });

        it("never fetches cost cards for a COOK, even after switching to the Pricing tab", async () => {
            renderAs(StaffRoles.COOK);
            await switchTab("Pricing");

            await waitFor(() => expect(mockFetchStatistics).toHaveBeenCalled());
            expect(mockCostCards).not.toHaveBeenCalled();
            expect(mockComponents).not.toHaveBeenCalled();
        });

        it("never fetches cost cards for a SUPERVISOR, even after switching to the Pricing tab", async () => {
            renderAs(StaffRoles.SUPERVISOR);
            await switchTab("Pricing");

            await waitFor(() => expect(mockFetchStatistics).toHaveBeenCalled());
            expect(mockCostCards).not.toHaveBeenCalled();
            expect(mockComponents).not.toHaveBeenCalled();
        });

        it("never fetches cost cards for a REVIEWER, even after switching to the Pricing tab", async () => {
            renderAs(StaffRoles.REVIEWER);
            await switchTab("Pricing");

            await waitFor(() => expect(mockFetchStatistics).toHaveBeenCalled());
            expect(mockCostCards).not.toHaveBeenCalled();
            expect(mockComponents).not.toHaveBeenCalled();
        });
    });

    // task-spec.md §4 item 12 / §6 step 4: onCostSaved is businessStats.refresh only for OWNER.
    describe("cost-save refresh coupling", () => {
        async function saveOreganoCost(): Promise<void> {
            await switchTab("Pricing");
            await waitFor(() => expect(mockCostCards).toHaveBeenCalledTimes(1));

            await userEvent.click(await screen.findByText(/1 ingredients with no cost/));
            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "5{Enter}");

            await waitFor(() => expect(mockUpdateComponentCost)
                .toHaveBeenCalledWith(5, { cost: 5, clearCost: false }));
        }

        beforeEach(() => {
            mockComponents.mockResolvedValue([oregano]);
            mockUpdateComponentCost.mockResolvedValue({
                ...oregano, cost: 5, costSource: "MANUAL", resolvedUnitCost: 0.005,
            });
        });

        it("refreshes the Business Stats report when an OWNER saves a component cost", async () => {
            renderAs(StaffRoles.OWNER);
            // businessStats fetches unconditionally on mount (see useBusinessStats) — wait for
            // that call to settle and clear it, so the assertion below is only about the save.
            await waitFor(() => expect(mockBusinessStats).toHaveBeenCalledTimes(1));
            mockBusinessStats.mockClear();

            await saveOreganoCost();

            await waitFor(() => expect(mockBusinessStats).toHaveBeenCalledTimes(1));
        });

        it("does not refresh the Business Stats report when a MANAGER saves a component cost", async () => {
            renderAs(StaffRoles.MANAGER);
            await waitFor(() => expect(mockBusinessStats).toHaveBeenCalledTimes(1));
            mockBusinessStats.mockClear();

            await saveOreganoCost();
            // Prove the save actually completed (useCostCards refetches components once the write
            // resolves) before asserting the absence of a refresh call — otherwise "not called"
            // could just mean "too early".
            await waitFor(() => expect(mockComponents).toHaveBeenCalledTimes(2));

            expect(mockBusinessStats).not.toHaveBeenCalled();
        });

        it("does not refresh the Business Stats report when a SUPER_MANAGER saves a component cost", async () => {
            renderAs(StaffRoles.SUPER_MANAGER);
            await waitFor(() => expect(mockBusinessStats).toHaveBeenCalledTimes(1));
            mockBusinessStats.mockClear();

            await saveOreganoCost();
            await waitFor(() => expect(mockComponents).toHaveBeenCalledTimes(2));

            expect(mockBusinessStats).not.toHaveBeenCalled();
        });
    });
});
