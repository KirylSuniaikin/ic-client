import { describe, it, expect, afterEach } from "@jest/globals";
import { formatAverageOrderValue, formatPrepTime, formatStatRange, rangeAverageOrderValue } from "./statsFormat";
import type { StatsResponse } from "../../types";

function rangeStats(overrides: Partial<StatsResponse>): StatsResponse {
    return {
        totalPickUpRevenue: 0,
        totalPickUpOrderCount: 0,
        newCustomerOrderedCount: 0,
        oldCustomerOrderedCount: 0,
        oldCstmrOrderCount: 0,
        unknownCustomerOrderCount: 0,
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
        ...overrides,
    };
}

describe("formatPrepTime", () => {
    it("renders minutes and seconds for durations of a minute or more", () => {
        const result = formatPrepTime(750);

        expect(result).toBe("12m 30s");
    });

    it("renders seconds only when under a minute", () => {
        const result = formatPrepTime(45);

        expect(result).toBe("45s");
    });

    it("rounds fractional seconds to the nearest whole second", () => {
        const result = formatPrepTime(89.6);

        expect(result).toBe("1m 30s");
    });

    it("returns an em dash when no prep time has been recorded", () => {
        const result = formatPrepTime(null);

        expect(result).toBe("—");
    });
});

describe("formatStatRange", () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
        process.env.TZ = originalTz;
    });

    it("renders a single date when the start and finish are the same calendar day", () => {
        const result = formatStatRange("2026-07-10", "2026-07-10");

        expect(result).toBe("Jul 10, 2026");
    });

    it("renders a start — finish range when the dates differ", () => {
        const result = formatStatRange("2026-07-04", "2026-07-10");

        expect(result).toBe("Jul 4, 2026 — Jul 10, 2026");
    });

    it("does not UTC-shift the date in a negative-offset browser timezone", () => {
        process.env.TZ = "America/Los_Angeles";

        const result = formatStatRange("2026-07-10", "2026-07-10");

        expect(result).toBe("Jul 10, 2026");
    });
});


describe("rangeAverageOrderValue", () => {
    it("divides the three platforms' revenue by their combined order count", () => {
        const stats = rangeStats({
            totalPickUpRevenue: 100, totalPickUpOrderCount: 5,
            totalTalabatRevenue: 40, totalTalabatOrders: 2,
            totalKeetaRevenue: 10, totalKeetaOrders: 1,
        });

        const result = rangeAverageOrderValue(stats);

        expect(result).toBe(18.75);
    });

    it("returns null instead of dividing by zero when the range has no orders", () => {
        const stats = rangeStats({totalPickUpRevenue: 12});

        const result = rangeAverageOrderValue(stats);

        expect(result).toBeNull();
    });
});

describe("formatAverageOrderValue", () => {
    it("renders two decimals like the all-time AOV", () => {
        const result = formatAverageOrderValue(4.5);

        expect(result).toBe("4.50");
    });

    it("returns an em dash when there is no value", () => {
        const result = formatAverageOrderValue(null);

        expect(result).toBe("—");
    });
});
