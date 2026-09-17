import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatisticsComponent from "./StatisticsComponent";
import { ManagementBranchScopeProvider } from "../../_shared/context/ManagementBranchScope";
import { StaffRoles } from "../../../auth/types";
import { formatStatDate } from "./performance/statsFormat";
import type { IBranch } from "../../inventory/types";
import type { StatsResponse } from "../types";

// Heavy tab-content children are stubbed out — this suite only exercises the sticky
// filter row's per-tab branch-control mode and its wiring into the shared scope hooks,
// not each tab's own rendering (covered by their own suites). ConsumptionStatistics and
// ProductsTable pull in @mui/x-data-grid, which needs a TextEncoder polyfill this test
// environment doesn't provide.
jest.mock("./tabs/PerformanceTab", () => ({ PerformanceTab: () => null }));
jest.mock("./PrepPlanTable", () => ({ __esModule: true, default: () => null }));
jest.mock("./DoughUsageTable", () => ({ DoughUsageTable: () => null }));
jest.mock("../../consumption/components/ConsumptionStatistics", () => ({ ConsumptionStatistics: () => null }));
jest.mock("./VatReportCard", () => ({ VatReportCard: () => null }));
jest.mock("./ProductsTable", () => ({ ProductsTable: () => <div data-testid="products-table"/> }));
jest.mock("../../shift/components/StaffSummaryContent", () => ({ StaffSummaryContent: () => null }));
jest.mock("./business/BusinessTab", () => ({ __esModule: true, default: () => null }));
jest.mock("./PricingCostCardsSection", () => ({
    __esModule: true, default: () => <div data-testid="pricing-cost-cards"/>
}));

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts. useStatistics
// runs for real here (not mocked), so the branch-switch -> refetch wiring is genuine.
jest.mock("../../../../shared/api/public");

import { fetchStatistics } from "../../../../shared/api/public";

const mockFetchStatistics = jest.mocked(fetchStatistics);

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
} as unknown as StatsResponse;

async function switchTab(name: string): Promise<void> {
    await userEvent.click(screen.getByRole("button", { name }));
}

function renderWithTwoBranches(): ReturnType<typeof render> {
    return render(
        <ManagementBranchScopeProvider branches={[branchA, branchB]} homeBranch={branchA}>
            <StatisticsComponent onClose={jest.fn()} branchId={branchA.id} role={StaffRoles.SUPER_MANAGER} />
        </ManagementBranchScopeProvider>
    );
}

// Shared by "Business tab visibility" and "Pricing tab cost-card visibility" — both need a render
// parameterized only by role, with the same two-branch provider `renderWithTwoBranches` fixes to
// SUPER_MANAGER.
function renderAs(role: StaffRoles): ReturnType<typeof render> {
    return render(
        <ManagementBranchScopeProvider branches={[branchA, branchB]} homeBranch={branchA}>
            <StatisticsComponent onClose={jest.fn()} branchId={branchA.id} role={role} />
        </ManagementBranchScopeProvider>
    );
}

describe("StatisticsComponent", () => {
    // Business Stats is the consolidated company P&L, owner withdrawals included, and has no branch
    // dimension -- so it is OWNER-only, mirroring the SecurityConfig matcher. These assertions are
    // about the tab STRIP: a role that must not see it must not be offered it.
    describe("Business tab visibility", () => {
        it("offers the Business tab to an OWNER", () => {
            renderAs(StaffRoles.OWNER);

            expect(screen.queryByRole("button", { name: "Business" })).toBeTruthy();
        });

        it("hides the Business tab from a SUPER_MANAGER, who sees every other tab", () => {
            // The load-bearing case: city-level access reaches Performance and Shifts, so this is
            // what proves the gate is OWNER-only rather than just "not a cook".
            renderAs(StaffRoles.SUPER_MANAGER);

            expect(screen.queryByRole("button", { name: "Business" })).toBeNull();
            expect(screen.queryByRole("button", { name: "Performance" })).toBeTruthy();
        });

        it("hides the Business tab from a MANAGER", () => {
            renderAs(StaffRoles.MANAGER);

            expect(screen.queryByRole("button", { name: "Business" })).toBeNull();
        });

        it("hides the Business tab from a COOK", () => {
            renderAs(StaffRoles.COOK);

            expect(screen.queryByRole("button", { name: "Business" })).toBeNull();
        });

        it("shows no branch control and no date-range button on Business", async () => {
            // Business level by design: a branch selector here would be a lie, and the day-grained
            // range picker is the wrong instrument for a monthly report.
            renderAs(StaffRoles.OWNER);
            await switchTab("Business");

            expect(screen.queryByRole("combobox")).toBeNull();
            const today = formatStatDate(new Date());
            expect(screen.queryByRole("button", { name: `${today} — ${today}` })).toBeNull();
        });
    });

    // The cost-card section is a second block on the Pricing tab, gated on the same MANAGER+
    // audience as canSeePerformance -- widened from the old OWNER-only Business tab home. The
    // section must be entirely absent from the DOM for a role below MANAGER, not merely hidden.
    describe("Pricing tab cost-card visibility", () => {
        it("shows the cost-card section to a MANAGER after switching to Pricing", async () => {
            renderAs(StaffRoles.MANAGER);
            await switchTab("Pricing");

            expect(await screen.findByTestId("pricing-cost-cards")).toBeTruthy();
            expect(screen.getByTestId("products-table")).toBeTruthy();
        });

        it("hides the cost-card section from a COOK but still shows ProductsTable", async () => {
            renderAs(StaffRoles.COOK);
            await switchTab("Pricing");

            expect(await screen.findByTestId("products-table")).toBeTruthy();
            expect(screen.queryByTestId("pricing-cost-cards")).toBeNull();
        });

        it("shows the cost-card section to an OWNER too (regression)", async () => {
            renderAs(StaffRoles.OWNER);
            await switchTab("Pricing");

            expect(await screen.findByTestId("pricing-cost-cards")).toBeTruthy();
            expect(screen.getByTestId("products-table")).toBeTruthy();
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchStatistics.mockResolvedValue(emptyStats);
    });

    describe("per-tab branch control mode (>= 2 branches in scope)", () => {
        it("shows a multi-select branch control and the date-range button on Performance (default tab)", () => {
            renderWithTwoBranches();

            expect(screen.getAllByRole("combobox")).toHaveLength(1);
            const today = formatStatDate(new Date());
            expect(screen.getByRole("button", { name: `${today} — ${today}` })).toBeTruthy();
        });

        it("shows a multi-select branch control with no date-range button on Consumption", async () => {
            renderWithTwoBranches();
            await switchTab("Consumption");

            expect(screen.getAllByRole("combobox")).toHaveLength(1);
            const today = formatStatDate(new Date());
            expect(screen.queryByRole("button", { name: `${today} — ${today}` })).toBeNull();
        });

        it("shows no branch control and no date-range button on Pricing", async () => {
            renderWithTwoBranches();
            await switchTab("Pricing");

            expect(screen.queryByRole("combobox")).toBeNull();
            const today = formatStatDate(new Date());
            expect(screen.queryByRole("button", { name: `${today} — ${today}` })).toBeNull();
        });

        it("shows a single-select branch control (no checkbox rows) with no date-range button on Reports", async () => {
            renderWithTwoBranches();
            await switchTab("Reports");

            expect(screen.getAllByRole("combobox")).toHaveLength(1);
            const today = formatStatDate(new Date());
            expect(screen.queryByRole("button", { name: `${today} — ${today}` })).toBeNull();

            await userEvent.click(screen.getByRole("combobox"));
            expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
        });

        it("shows a single-select branch control with no date-range button on Shifts", async () => {
            renderWithTwoBranches();
            await switchTab("Shifts");

            expect(screen.getAllByRole("combobox")).toHaveLength(1);
            const today = formatStatDate(new Date());
            expect(screen.queryByRole("button", { name: `${today} — ${today}` })).toBeNull();
        });

        it("the Performance/Consumption control is the multi-select variant (has checkbox rows)", async () => {
            renderWithTwoBranches();

            await userEvent.click(screen.getByRole("combobox"));
            expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
        });
    });

    describe("no provider mounted (bare render — degrades to a single-branch fallback)", () => {
        it("renders no branch selector on any tab, matching the pre-existing bare-render tests", async () => {
            render(<StatisticsComponent onClose={jest.fn()} branchId="solo-branch" role={StaffRoles.SUPER_MANAGER} />);

            expect(screen.queryByRole("combobox")).toBeNull();

            await switchTab("Consumption");
            expect(screen.queryByRole("combobox")).toBeNull();

            await switchTab("Reports");
            expect(screen.queryByRole("combobox")).toBeNull();
        });
    });

    describe("branch-switch refetch", () => {
        it("refetches statistics with both ids joined into one branchId param when a second branch is selected", async () => {
            renderWithTwoBranches();

            await screen.findByRole("combobox");
            mockFetchStatistics.mockClear();

            await userEvent.click(screen.getByRole("combobox"));
            await userEvent.click(within(screen.getByRole("listbox")).getByText("Branch B"));

            await waitFor(() => expect(mockFetchStatistics).toHaveBeenCalled());
            const lastCall = mockFetchStatistics.mock.calls[mockFetchStatistics.mock.calls.length - 1];
            expect(lastCall[3]).toBe("a,b");
        });
    });
});
