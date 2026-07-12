import {jest, describe, it, expect, beforeEach, afterEach} from "@jest/globals";
import {renderHook, act, waitFor} from "@testing-library/react";
import {startOfDay, endOfDay} from "date-fns";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");

import {fetchStatistics} from "../../../../shared/api/public";
import {useStatistics} from "./useStatistics";
import type {StatsResponse} from "../types";

const mockFetchStatistics = jest.mocked(fetchStatistics);

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

describe("useStatistics", () => {
    const originalTz = process.env.TZ;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchStatistics.mockResolvedValue(emptyStats);
    });

    afterEach(() => {
        process.env.TZ = originalTz;
    });

    it("sends start === finish for a single-day range on mount (default Bahrain-local timezone)", async () => {
        const {result} = renderHook(() => useStatistics("branch-1"));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockFetchStatistics).toHaveBeenCalledTimes(1);
        const [start, finish] = mockFetchStatistics.mock.calls[0];
        expect(start).toBe(finish);
    });

    it("sends start === finish for a single-day range even in a negative-offset browser timezone", async () => {
        process.env.TZ = "America/Los_Angeles";

        const {result} = renderHook(() => useStatistics("branch-1"));

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            const day = startOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: day, endDate: endOfDay(day), key: "selection"}]);
        });

        mockFetchStatistics.mockClear();

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchStatistics).toHaveBeenCalledWith("2026-07-10", "2026-07-10", expect.any(String), "branch-1");
    });

    it("sends the exact picked calendar days for a multi-day range", async () => {
        const {result} = renderHook(() => useStatistics("branch-1"));

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        mockFetchStatistics.mockClear();

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchStatistics).toHaveBeenCalledWith("2026-07-04", "2026-07-10", expect.any(String), "branch-1");
    });
});
