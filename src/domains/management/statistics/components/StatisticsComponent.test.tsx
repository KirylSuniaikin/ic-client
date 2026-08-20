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
jest.mock("./ProductsTable", () => ({ ProductsTable: () => null }));
jest.mock("../../shift/components/StaffSummaryContent", () => ({ StaffSummaryContent: () => null }));

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

describe("StatisticsComponent", () => {
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
