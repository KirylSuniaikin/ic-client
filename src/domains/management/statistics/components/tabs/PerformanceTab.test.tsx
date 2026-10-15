import {describe, it, expect, jest} from "@jest/globals";
import React from "react";
import {render, screen} from "@testing-library/react";
import {PerformanceTab} from "./PerformanceTab";
import type {StatsResponse} from "../../types";

// These siblings are exercised by their own suites and pull in dependencies (e.g.
// @mui/x-data-grid via DateRangeStatsCard's tables) this test environment doesn't need for
// exercising the customer-card column logic under test here.
jest.mock("../performance/DateRangeStatsCard", () => ({
    DateRangeStatsCard: () => null,
}));
jest.mock("../performance/RetentionCheckCard", () => ({
    RetentionCheckCard: () => null,
}));
jest.mock("../performance/GlobalStatsCard", () => ({
    GlobalStatsCard: () => null,
}));

const baseStats: StatsResponse = {
    totalPickUpRevenue: 100,
    totalPickUpOrderCount: 5,
    newCustomerOrderedCount: 1,
    oldCustomerOrderedCount: 4,
    oldCstmrOrderCount: 4,
    unknownCustomerOrderCount: 0,
    arpu: 20,
    uniqueCustomersAllTime: 10,
    repeatCustomersAllTime: 4,
    averageOrderValueAllTime: 20,
    monthTotalCustomers: 10,
    retainedCustomers: 4,
    retentionPercentage: 40,
    doughUsageTOS: [],
    sellsByHour: [],
    totalTalabatOrders: 2,
    totalTalabatRevenue: 40,
    topProducts: [],
    totalKeetaOrders: 1,
    totalKeetaRevenue: 10,
    averagePrepTimeSeconds: 300,
};

const noop = (): void => undefined;

describe("PerformanceTab customer card columns", () => {
    it("renders only New and Returning columns when there are no unknown-phone orders", () => {
        const stats: StatsResponse = {...baseStats, newCustomerOrderedCount: 1, oldCstmrOrderCount: 4, unknownCustomerOrderCount: 0};

        render(
            <PerformanceTab
                rangeStats={stats}
                globalStats={null}
                retentionStats={null}
                sellStats={[]}
                selectedDate={new Date()}
                onSelectedDateChange={noop}
                onRefresh={noop}
            />
        );

        expect(screen.getByText("New")).toBeTruthy();
        expect(screen.getByText("Returning")).toBeTruthy();
        expect(screen.queryByText("Unknown / No phone")).toBeNull();
        // Share is of the two-way total (1 + 4 = 5): New is 20%, Returning is 80%.
        expect(screen.getByText("20% of orders")).toBeTruthy();
        expect(screen.getByText("80% of orders")).toBeTruthy();
        // CustomerStatCard.tsx derives the Grid size from columns.length: 6 for two columns.
        expect(screen.getByText("New").closest('[class*="MuiGrid"]')?.className).toContain("MuiGrid-grid-xs-6");
    });

    it("appends the Unknown / No phone column, with shares of the three-way total, when there are unknown-phone orders", () => {
        const stats: StatsResponse = {...baseStats, newCustomerOrderedCount: 6, oldCstmrOrderCount: 3, unknownCustomerOrderCount: 1};

        render(
            <PerformanceTab
                rangeStats={stats}
                globalStats={null}
                retentionStats={null}
                sellStats={[]}
                selectedDate={new Date()}
                onSelectedDateChange={noop}
                onRefresh={noop}
            />
        );

        expect(screen.getByText("Unknown / No phone")).toBeTruthy();
        // Share is of the three-way total (6 + 3 + 1 = 10): 60%, 30%, 10%.
        expect(screen.getByText("60% of orders")).toBeTruthy();
        expect(screen.getByText("30% of orders")).toBeTruthy();
        expect(screen.getByText("10% of orders")).toBeTruthy();
        // CustomerStatCard.tsx derives the Grid size from columns.length: 4 for three columns.
        expect(screen.getByText("New").closest('[class*="MuiGrid"]')?.className).toContain("MuiGrid-grid-xs-4");
    });
});
