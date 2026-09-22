import {describe, it, expect} from "@jest/globals";
import {buildDeliveryHourGrid, heatmapColor} from "./deliveryHourGrid";
import type {DeliveryHourBucket} from "../types";

function bucket(dayOfWeek: number, hour: number, total: number, count: number): DeliveryHourBucket {
    return {dayOfWeek, hour, total, count};
}

describe("buildDeliveryHourGrid", () => {
    /**
     * The whole reason this grid exists: a cell holding 200 BHD from four orders and one holding
     * 200 BHD from twenty are opposite operational situations, and a revenue-only heatmap cannot
     * tell them apart. Both numbers reach the cell or the grid answers nothing.
     */
    it("keeps the money and the order count together in one cell", () => {
        const {rows} = buildDeliveryHourGrid([bucket(5, 19, 200, 20)]);

        expect(rows).toHaveLength(1);
        expect(rows[0].Friday).toEqual({total: 200, count: 20});
    });

    /**
     * ISO days, 1 = Monday. Off-by-one here silently reports Friday's dinner rush as Thursday's,
     * which is a hiring decision made against the wrong evening.
     */
    it("places ISO day 1 on Monday and day 7 on Sunday", () => {
        const {rows} = buildDeliveryHourGrid([bucket(1, 12, 10, 1), bucket(7, 12, 20, 2)]);

        expect(rows[0].Monday).toEqual({total: 10, count: 1});
        expect(rows[0].Sunday).toEqual({total: 20, count: 2});
        expect(rows[0].Tuesday).toBeUndefined();
    });

    /**
     * One row per hour that appears, ascending. An all-zero 04:00 row is not information — the
     * kitchen is shut — and a grid full of reassuring blanks hides the hours that are genuinely
     * weak.
     */
    it("gives a row only to hours that appear, in ascending order", () => {
        const {rows} = buildDeliveryHourGrid([
            bucket(1, 21, 5, 1), bucket(2, 9, 5, 1), bucket(3, 13, 5, 1),
        ]);

        expect(rows.map((row) => row.id)).toEqual([9, 13, 21]);
        expect(rows.map((row) => row.label)).toEqual(["09:00", "13:00", "21:00"]);
    });

    it("merges every weekday for the same hour into one row", () => {
        const {rows} = buildDeliveryHourGrid([bucket(2, 18, 30, 3), bucket(4, 18, 40, 4)]);

        expect(rows).toHaveLength(1);
        expect(rows[0].Tuesday).toEqual({total: 30, count: 3});
        expect(rows[0].Thursday).toEqual({total: 40, count: 4});
    });

    /** The colour ramp's denominator is the busiest cell, so it has to be the real maximum. */
    it("reports the busiest cell's revenue as the ramp's maximum", () => {
        const {maxTotal} = buildDeliveryHourGrid([bucket(1, 12, 10, 1), bucket(2, 13, 95, 9)]);

        expect(maxTotal).toBe(95);
    });

    /**
     * A day index outside 1..7 has no column. Dropping it beats writing an "undefined" key, which
     * would silently absorb that revenue into a column nothing renders.
     */
    it("drops a bucket whose weekday is out of range rather than inventing a column", () => {
        const {rows, maxTotal} = buildDeliveryHourGrid([bucket(0, 12, 50, 5), bucket(8, 12, 50, 5)]);

        expect(rows).toEqual([]);
        expect(maxTotal).toBe(0);
    });

    it("returns an empty grid for an empty range", () => {
        expect(buildDeliveryHourGrid([])).toEqual({rows: [], maxTotal: 0});
    });
});

describe("heatmapColor", () => {
    /** White, never the palest red: an hour with no deliveries must not read as a faint signal. */
    it("leaves an empty cell white", () => {
        expect(heatmapColor(0, 100)).toBe("#FFFFFF");
    });

    /** Darker with load — the busiest cell is the darkest, which is what makes the grid scannable. */
    it("darkens as a cell approaches the maximum", () => {
        expect(heatmapColor(100, 100)).toBe("hsl(10, 80%, 45%)");
        expect(heatmapColor(50, 100)).toBe("hsl(10, 80%, 70%)");
    });

    /** A zero maximum must not divide by zero into NaN and emit an unparseable colour. */
    it("survives a maximum of zero", () => {
        expect(heatmapColor(0, 0)).toBe("#FFFFFF");
    });
});
