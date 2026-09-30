import {jest, describe, it, expect, beforeEach, afterEach} from "@jest/globals";
import {renderHook, act, waitFor} from "@testing-library/react";
import {startOfDay, endOfDay} from "date-fns";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");
jest.mock("../../../../shared/api/management");

import {fetchStatistics} from "../../../../shared/api/public";
import {
    fetchDeliveryAvailabilityStats,
    fetchDeliveryEstimateAccuracy,
    fetchDeliveryHourlyStats,
    fetchDeliverySkipReasonStats,
} from "../../../../shared/api/management";
import {useStatistics} from "./useStatistics";
import type {
    DeliveryAvailabilityStats,
    DeliveryEstimateAccuracy,
    DeliverySkipReasonStats,
    StatsResponse,
} from "../types";

const mockFetchStatistics = jest.mocked(fetchStatistics);
const mockFetchDeliveryAvailability = jest.mocked(fetchDeliveryAvailabilityStats);
const mockFetchDeliveryHourly = jest.mocked(fetchDeliveryHourlyStats);
const mockFetchEstimateAccuracy = jest.mocked(fetchDeliveryEstimateAccuracy);
const mockFetchSkipReasons = jest.mocked(fetchDeliverySkipReasonStats);

const emptyAvailability: DeliveryAvailabilityStats = {
    observedSeconds: 0,
    unavailableSeconds: 0,
    byReason: [],
    byHour: [],
};

const emptyAccuracy: DeliveryEstimateAccuracy = {
    deliveredOrders: 0,
    legs: [],
    orderTotalTime: {sampleCount: 0, medianMinutes: null, meanMinutes: null, p90Minutes: null},
};

const emptySkipReasons: DeliverySkipReasonStats = {
    totalSkips: 0,
    ordersAffected: 0,
    couriersAffected: 0,
    byReason: [],
};

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
        mockFetchDeliveryAvailability.mockResolvedValue(emptyAvailability);
        mockFetchDeliveryHourly.mockResolvedValue([]);
        mockFetchEstimateAccuracy.mockResolvedValue(emptyAccuracy);
        mockFetchSkipReasons.mockResolvedValue(emptySkipReasons);
    });

    afterEach(() => {
        process.env.TZ = originalTz;
    });

    it("sends start === finish for a single-day range on mount (default Bahrain-local timezone)", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockFetchStatistics).toHaveBeenCalledTimes(1);
        const [start, finish] = mockFetchStatistics.mock.calls[0];
        expect(start).toBe(finish);
    });

    it("sends start === finish for a single-day range even in a negative-offset browser timezone", async () => {
        process.env.TZ = "America/Los_Angeles";

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

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
        const {result} = renderHook(() => useStatistics(["branch-1"], true));

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

    it("joins multiple selected branch ids into ONE branchId query param", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1", "branch-2"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockFetchStatistics).toHaveBeenCalledTimes(1);
        const [, , , branchId] = mockFetchStatistics.mock.calls[0];
        expect(branchId).toBe("branch-1,branch-2");
    });

    it("refetches when the branch id selection changes", async () => {
        const {result, rerender} = renderHook(
            ({branchIds}: {branchIds: string[]}) => useStatistics(branchIds, true),
            {initialProps: {branchIds: ["branch-1"]}}
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(mockFetchStatistics).toHaveBeenCalledTimes(1);

        rerender({branchIds: ["branch-1", "branch-2"]});

        await waitFor(() => expect(mockFetchStatistics).toHaveBeenCalledTimes(2));
        const [, , , branchId] = mockFetchStatistics.mock.calls[1];
        expect(branchId).toBe("branch-1,branch-2");
    });

    it("asks for delivery availability over the SAME range and branches as the rest of the tab", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1", "branch-2"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        mockFetchDeliveryAvailability.mockClear();

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchDeliveryAvailability).toHaveBeenCalledWith("2026-07-04", "2026-07-10", "branch-1,branch-2");
    });

    // A delivery-availability outage must never take the revenue and customer figures down
    // with it -- those are what the tab is mainly there for.
    it("still exposes the main statistics when only the delivery availability fetch fails", async () => {
        mockFetchDeliveryAvailability.mockRejectedValue(new Error("HTTP 500"));

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.rangeStats).not.toBeNull();
        expect(result.current.deliveryAvailability).toBeNull();
    });

    it("asks for the delivered heatmap over the SAME range and branches as the rest of the tab", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1", "branch-2"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        mockFetchDeliveryHourly.mockClear();

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchDeliveryHourly).toHaveBeenCalledWith("2026-07-04", "2026-07-10", "branch-1,branch-2");
    });

    // The two delivery calls answer opposite questions and live on different tabs, so they are
    // caught separately: one being down must leave the other readable rather than blanking both.
    it("keeps the delivered heatmap when only the availability fetch fails", async () => {
        mockFetchDeliveryAvailability.mockRejectedValue(new Error("HTTP 500"));
        mockFetchDeliveryHourly.mockResolvedValue([{dayOfWeek: 5, hour: 19, total: 12, count: 2}]);

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveryAvailability).toBeNull();
        expect(result.current.deliveryHourly).toHaveLength(1);
    });

    it("keeps the availability figures when only the delivered heatmap fails", async () => {
        mockFetchDeliveryHourly.mockRejectedValue(new Error("HTTP 500"));

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveryAvailability).not.toBeNull();
        expect(result.current.deliveryHourly).toEqual([]);
    });

    // COOK and SUPERVISOR can open Statistics but not the Performance tab, and
    // /api/management/delivery/** is MANAGER-and-up -- fetching it for them would be a
    // guaranteed 403 on every open, for a card they cannot see.
    it("skips the delivery availability fetch entirely for a role that cannot see it", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], false));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockFetchStatistics).toHaveBeenCalledTimes(1);
        expect(mockFetchDeliveryAvailability).not.toHaveBeenCalled();
        expect(mockFetchDeliveryHourly).not.toHaveBeenCalled();
        expect(result.current.deliveryAvailability).toBeNull();
        expect(result.current.deliveryHourly).toEqual([]);
    });

    /**
     * The scope that gets pinned on the availability card must describe the NUMBERS, not the
     * picker. `setDateRange` fires on every drag of the calendar while the data only reloads on
     * "🔁 Refresh", so between the two the live range names a period nothing has been fetched for
     * — and a card labelled with it would be lying about what a manager is comparing.
     */
    it("keeps the delivery scope on the range that was fetched, not the one now in the picker", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));
        const fetched = result.current.deliveryStatsScope;
        expect(fetched).not.toBeNull();

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        // The picker moved; nothing was refetched, so the scope must not have moved with it.
        expect(result.current.deliveryStatsScope).toEqual(fetched);
        expect(result.current.deliveryStatsScope?.startDate).not.toBe("2026-07-04");
    });

    it("moves the delivery scope to the new range once it is actually refreshed", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.deliveryStatsScope)
            .toEqual({startDate: "2026-07-04", finishDate: "2026-07-10"});
    });

    // A scope left standing over a blank card would claim a range was measured when the request
    // never came back at all.
    it("clears the scope with the figures it described when the fetch fails", async () => {
        mockFetchDeliveryAvailability.mockRejectedValue(new Error("HTTP 500"));

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveryAvailability).toBeNull();
        expect(result.current.deliveryStatsScope).toBeNull();
    });

    it("has no delivery scope for a role that never fetches the delivery figures", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], false));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveryStatsScope).toBeNull();
    });

    /**
     * Both chain-wide endpoints take an OPTIONAL branchId, and omitting it is what makes them
     * answerable: the road quote comes from one router shared by every branch, and an unscoped
     * read is the only one that sees an order with no branch at all. The hook must therefore not
     * quietly pass the page's branch selection down to them.
     */
    it("asks for the estimate accuracy and skip reasons over the applied range, with no branch", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1", "branch-2"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        mockFetchEstimateAccuracy.mockClear();
        mockFetchSkipReasons.mockClear();

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockFetchEstimateAccuracy).toHaveBeenCalledWith("2026-07-04", "2026-07-10");
        expect(mockFetchSkipReasons).toHaveBeenCalledWith("2026-07-04", "2026-07-10");
    });

    // Four independent fetches, four independent failures: the tab must not go blank because one
    // of them is down.
    it("keeps the skip reasons when only the estimate-accuracy fetch fails", async () => {
        mockFetchEstimateAccuracy.mockRejectedValue(new Error("HTTP 500"));

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveryEstimateAccuracy).toBeNull();
        expect(result.current.deliverySkipReasons).not.toBeNull();
        expect(result.current.deliveryAvailability).not.toBeNull();
    });

    it("keeps the estimate accuracy when only the skip-reason fetch fails", async () => {
        mockFetchSkipReasons.mockRejectedValue(new Error("HTTP 500"));

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliverySkipReasons).toBeNull();
        expect(result.current.deliveryEstimateAccuracy).not.toBeNull();
    });

    // One chain-wide figure standing is enough to label; nothing standing must clear the label,
    // or a range would be claimed for numbers that never arrived.
    it("clears the chain-wide scope only when neither chain-wide fetch came back", async () => {
        mockFetchEstimateAccuracy.mockRejectedValue(new Error("HTTP 500"));
        mockFetchSkipReasons.mockRejectedValue(new Error("HTTP 500"));

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveryChainScope).toBeNull();
    });

    it("keeps the chain-wide scope while at least one of the two figures is readable", async () => {
        mockFetchEstimateAccuracy.mockRejectedValue(new Error("HTTP 500"));

        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveryChainScope).not.toBeNull();
    });

    /**
     * The trap this surface has already been caught by: the picker moves on every drag while the
     * data only reloads on Refresh, so a card labelled with the live range names a window nothing
     * was ever fetched for.
     */
    it("keeps the chain-wide scope on the range that was fetched, not the one now in the picker", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));
        const fetched = result.current.deliveryChainScope;
        expect(fetched).not.toBeNull();

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        expect(result.current.deliveryChainScope).toEqual(fetched);
        expect(result.current.deliveryChainScope?.startDate).not.toBe("2026-07-04");
    });

    it("moves the chain-wide scope to the new range once it is actually refreshed", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], true));

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            const start = startOfDay(new Date(2026, 6, 4));
            const end = endOfDay(new Date(2026, 6, 10));
            result.current.setDateRange([{startDate: start, endDate: end, key: "selection"}]);
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.deliveryChainScope)
            .toEqual({startDate: "2026-07-04", finishDate: "2026-07-10"});
    });

    // /api/management/delivery/** is MANAGER-and-up: for a role that cannot open the tab these
    // would be two guaranteed 403s on every open.
    it("skips both chain-wide fetches for a role that cannot see the delivery tab", async () => {
        const {result} = renderHook(() => useStatistics(["branch-1"], false));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockFetchEstimateAccuracy).not.toHaveBeenCalled();
        expect(mockFetchSkipReasons).not.toHaveBeenCalled();
        expect(result.current.deliveryEstimateAccuracy).toBeNull();
        expect(result.current.deliverySkipReasons).toBeNull();
        expect(result.current.deliveryChainScope).toBeNull();
    });
});
