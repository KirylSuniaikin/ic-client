import {describe, it, expect, jest} from "@jest/globals";
import React from "react";
import {render, screen} from "@testing-library/react";
import {DateRangeStatsCard} from "./DateRangeStatsCard";
import type {StatsResponse} from "../../types";

// Both pull in @mui/x-data-grid, which needs a TextEncoder polyfill this test
// environment doesn't provide — stub them out since this suite only exercises
// the trend-caption date logic, not these tables' own rendering.
jest.mock("../TopProductsTable", () => ({
    TopProductsTable: () => null,
}));
jest.mock("../RevenueByHourTable", () => ({
    RevenueByHourTable: () => null,
}));

const baseStats: StatsResponse = {
    totalPickUpRevenue: 100,
    totalPickUpOrderCount: 5,
    newCustomerOrderedCount: 1,
    oldCustomerOrderedCount: 4,
    oldCstmrOrderCount: 4,
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

const dateRange = [{startDate: new Date(2026, 6, 10), endDate: new Date(2026, 6, 10), key: "selection"}];

describe("DateRangeStatsCard", () => {
    it("renders a single date in the trend caption when the previous period is one day", () => {
        const stats: StatsResponse = {
            ...baseStats,
            previous: {
                startDate: "2026-07-09",
                finishDate: "2026-07-09",
                totalRevenue: 90,
                totalOrders: 4,
                totalPickUpRevenue: 90,
                totalPickUpOrderCount: 4,
                totalTalabatRevenue: 0,
                totalTalabatOrders: 0,
                totalKeetaRevenue: 0,
                totalKeetaOrders: 0,
            },
        };

        render(
            <DateRangeStatsCard
                stats={stats}
                dateRange={dateRange}
                sellStats={[]}
                onRangeChange={jest.fn()}
                onRefresh={jest.fn()}
            />
        );

        expect(screen.getByText("revenue trend vs Jul 9, 2026")).toBeTruthy();
    });

    it("renders a start — finish range in the trend caption when the previous period spans multiple days", () => {
        const stats: StatsResponse = {
            ...baseStats,
            previous: {
                startDate: "2026-07-03",
                finishDate: "2026-07-09",
                totalRevenue: 90,
                totalOrders: 4,
                totalPickUpRevenue: 90,
                totalPickUpOrderCount: 4,
                totalTalabatRevenue: 0,
                totalTalabatOrders: 0,
                totalKeetaRevenue: 0,
                totalKeetaOrders: 0,
            },
        };

        render(
            <DateRangeStatsCard
                stats={stats}
                dateRange={dateRange}
                sellStats={[]}
                onRangeChange={jest.fn()}
                onRefresh={jest.fn()}
            />
        );

        expect(screen.getByText("revenue trend vs Jul 3, 2026 — Jul 9, 2026")).toBeTruthy();
    });
});
