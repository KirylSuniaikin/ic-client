import {describe, it, expect} from "@jest/globals";
import {
    cellFillColor,
    lateCount,
    lostDemandDomain,
    lostDemandFillColor,
    metricDomain,
    metricValue,
    MIN_LATE_SAMPLE,
    NO_DATA_COLOR,
    rampColor,
    rampPosition,
} from "./deliveryZoneScale";
import {heatmapColor} from "./deliveryHourGrid";
import type {DeliveryZoneCell, LostDemandZoneCell} from "../types";

function cell(overrides: Partial<DeliveryZoneCell>): DeliveryZoneCell {
    return {
        id: "0:0",
        center: {latitude: 26.2, longitude: 50.58},
        vertices: [],
        orders: 1,
        revenue: 0,
        avgTotalMinutes: null,
        p90TotalMinutes: null,
        avgRoadMinutes: null,
        lateShare: null,
        lateSampleSize: 0,
        ...overrides,
    };
}

describe("deliveryZoneScale", () => {
    // The map is one vocabulary with the other heatmaps on this screen: the same hue, the same
    // direction, entered past the near-white step that would vanish into the map tiles.
    it("draws its ramp from the screen's heatmap colour, starting past the lightest step", () => {
        expect(rampColor(0)).toBe(heatmapColor(0.2, 1));
        expect(rampColor(1)).toBe(heatmapColor(1, 1));
        expect(rampColor(-3)).toBe(rampColor(0));
        expect(rampColor(7)).toBe(rampColor(1));
    });

    it("leaves a late share off the scale below the minimum sample, and keeps it at the minimum", () => {
        expect(metricValue(cell({lateShare: 0.5, lateSampleSize: MIN_LATE_SAMPLE - 1}), "late")).toBeNull();
        expect(metricValue(cell({lateShare: 0.5, lateSampleSize: MIN_LATE_SAMPLE}), "late")).toBe(0.5);
    });

    it("has no domain when no cell has a value for the metric", () => {
        expect(metricDomain([cell({}), cell({})], "avgTime")).toBeNull();
    });

    /**
     * No spread means no position on the scale. Either end would claim "least" or "most" — a chain
     * where every area is 0% late must not be painted as the worst.
     */
    it("puts every cell mid-ramp when they all share one value", () => {
        const cells = [cell({lateShare: 0, lateSampleSize: 6}), cell({lateShare: 0, lateSampleSize: 9})];
        const domain = metricDomain(cells, "late");

        expect(domain).toEqual({min: 0, max: 0});
        expect(cellFillColor(cells[0], "late", domain)).toBe(rampColor(0.5));
    });

    it("places a value by where it falls between the domain's min and max", () => {
        expect(rampPosition(20, {min: 20, max: 40})).toBe(0);
        expect(rampPosition(25, {min: 20, max: 40})).toBe(0.25);
        expect(rampPosition(40, {min: 20, max: 40})).toBe(1);
        expect(rampPosition(7, {min: 7, max: 7})).toBe(0.5);
    });

    it("greys a cell with no value rather than placing it on the scale", () => {
        expect(cellFillColor(cell({}), "avgTime", {min: 20, max: 40})).toBe(NO_DATA_COLOR);
    });

    it("recovers the late count from the rounded share, and has none without a promise", () => {
        expect(lateCount(cell({lateShare: 0.667, lateSampleSize: 3}))).toBe(2);
        expect(lateCount(cell({lateShare: 0.222, lateSampleSize: 9}))).toBe(2);
        expect(lateCount(cell({lateShare: null, lateSampleSize: 0}))).toBeNull();
    });
});

describe("lost-demand scale", () => {
    function lostCell(id: string, total: number): LostDemandZoneCell {
        return {
            id,
            center: {latitude: 26.2, longitude: 50.58},
            vertices: [],
            refusals: total,
            refusalsByReason: [{reason: "OUTSIDE_RADIUS", count: total}],
            abandonedLost: 0,
            total,
        };
    }

    it("spans the cells' totals", () => {
        expect(lostDemandDomain([lostCell("a", 2), lostCell("b", 9), lostCell("c", 5)])).toEqual({min: 2, max: 9});
    });

    it("has no domain without cells", () => {
        expect(lostDemandDomain([])).toBeNull();
    });

    /** The same ramp and direction as the delivered metrics: darker is more customers turned away. */
    it("paints the busiest cell darkest and the quietest lightest", () => {
        const domain = {min: 2, max: 9};
        expect(lostDemandFillColor(lostCell("a", 9), domain)).toBe(rampColor(1));
        expect(lostDemandFillColor(lostCell("b", 2), domain)).toBe(rampColor(0));
    });

    it("greys a cell only when there is no scale to place it on", () => {
        expect(lostDemandFillColor(lostCell("a", 3), null)).toBe(NO_DATA_COLOR);
    });
});
