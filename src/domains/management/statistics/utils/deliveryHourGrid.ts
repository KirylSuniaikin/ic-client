import type {DeliveryHourBucket} from "../types";

// Pure grid maths, kept out of the component on purpose: the table around it is
// @mui/x-data-grid, which cannot mount in this jest environment (it needs a TextEncoder polyfill
// the environment does not provide), so a module that imports the grid cannot be unit-tested at
// all. Everything here is therefore importable without touching the grid.

// Monday-first, matching the ISO dayOfWeek the backend sends (1 = Monday .. 7 = Sunday) and the
// column order of both RevenueByHourTable and the availability grid beside this one.
export const DAYS_OF_WEEK = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** One weekday/hour cell, or absent when nothing was delivered in it. */
export type DeliveryHourCell = {
    total: number;
    count: number;
};

export type DeliveryHourGrid = {
    /** One row per hour that appears in the data, ascending. */
    rows: Array<{ id: number; label: string } & Partial<Record<string, DeliveryHourCell | string | number>>>;
    /** The busiest cell's revenue — the denominator of the colour ramp. */
    maxTotal: number;
};

/**
 * Folds the flat weekday/hour list into the row-per-hour shape the grid renders.
 *
 * Only hours that actually appear are given a row. An all-zero 04:00 row is not information: the
 * kitchen is shut, and a heatmap full of reassuring blanks for hours nobody could order in makes
 * the hours that ARE weak harder to find.
 *
 * Exported for its own test — the grid around it is @mui/x-data-grid, which cannot mount in this
 * jest environment (no TextEncoder polyfill), so this is where the behaviour is verifiable.
 */
export function buildDeliveryHourGrid(buckets: DeliveryHourBucket[]): DeliveryHourGrid {
    const byHour = new Map<number, Record<string, DeliveryHourCell>>();
    let maxTotal = 0;

    for (const bucket of buckets) {
        const day = DAYS_OF_WEEK[bucket.dayOfWeek - 1];
        // A day index outside 1..7 is not a cell we can place; dropping it beats writing an
        // "undefined" column that would silently absorb the row's revenue.
        if (day === undefined) continue;

        const cells = byHour.get(bucket.hour) ?? {};
        cells[day] = {total: bucket.total, count: bucket.count};
        byHour.set(bucket.hour, cells);
        maxTotal = Math.max(maxTotal, bucket.total);
    }

    const rows = Array.from(byHour.keys())
        .sort((a, b) => a - b)
        .map((hour) => ({
            id: hour,
            label: `${String(hour).padStart(2, "0")}:00`,
            ...byHour.get(hour),
        }));

    return {rows, maxTotal};
}

/**
 * Same lightness ramp as RevenueByHourTable's revenue heatmap, so every coloured grid on this
 * screen reads as one vocabulary rather than as three colour schemes.
 */
export function heatmapColor(amount: number, maxAmount: number): string {
    if (amount <= 0) return "#FFFFFF";
    const normalized = maxAmount > 0 ? amount / maxAmount : 0;
    return `hsl(10, 80%, ${95 - normalized * 50}%)`;
}
