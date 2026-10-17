import {heatmapColor} from "./deliveryHourGrid";
import type {DeliveryZoneCell, LostDemandZoneCell} from "../types";

// Pure colour maths for the delivery-zones map, kept out of the component so the scale can be
// tested without a Google Maps stub behind it.

/** What the hexagons are coloured by. */
export type DeliveryZoneMetric = "orders" | "avgTime" | "late";

/**
 * Below this many orders with a promise on record, a cell's late share is not shown on the scale.
 *
 * One late order out of two is "50% late" and would paint the darkest cell on the map, drawing the
 * eye to the least reliable number on it. The share is still printed in the cell's details, with
 * its "n of m" beside it, where the size of the sample is visible.
 */
export const MIN_LATE_SAMPLE = 5;

/**
 * "No data" is not a value on the scale, so it is not a step of the ramp: it is the neutral
 * DeliveryZoneMap already uses for an area that covers nothing, and DESIGN.md's secondary ink.
 */
export const NO_DATA_COLOR = "#8a807a";

/**
 * Where the map enters the screen's heat ramp. The ramp's own lightest step is near-white, which
 * disappears into the cream map tiles, so the map starts it at its 20% step; the hue and the
 * direction stay those of every other heatmap on this screen.
 */
const RAMP_FLOOR = 0.2;

export type MetricDomain = { min: number; max: number };

/** The cell's value for the metric, or null when the cell has no usable sample for it. */
export function metricValue(cell: DeliveryZoneCell, metric: DeliveryZoneMetric): number | null {
    switch (metric) {
        case "orders":
            return cell.orders;
        case "avgTime":
            return cell.avgTotalMinutes;
        case "late":
            return cell.lateSampleSize >= MIN_LATE_SAMPLE ? cell.lateShare : null;
    }
}

/** Min and max over the cells that HAVE a value, or null when none does. */
export function metricDomain(cells: DeliveryZoneCell[], metric: DeliveryZoneMetric): MetricDomain | null {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const cell of cells) {
        const value = metricValue(cell, metric);
        if (value === null) continue;
        min = Math.min(min, value);
        max = Math.max(max, value);
    }
    return min === Number.POSITIVE_INFINITY ? null : {min, max};
}

/** Position 0..1 on the map's ramp, light to dark. Out-of-range input is clamped. */
export function rampColor(position: number): string {
    const clamped = Math.min(Math.max(position, 0), 1);
    return heatmapColor(RAMP_FLOOR + (1 - RAMP_FLOOR) * clamped, 1);
}

/**
 * Where a value sits on the ramp, 0..1 from the domain's min to its max.
 *
 * Scaled min-to-max over the cells on screen rather than from zero: average times sit in a narrow
 * band well above zero, and a zero-anchored scale would paint every cell nearly the same shade.
 * When every cell has the same value there is no spread to place it on, so it takes the middle of
 * the ramp rather than either end, which would read as "least" or "most". Exported so the legend
 * paints that case with the very colour the cells get.
 */
export function rampPosition(value: number, domain: MetricDomain): number {
    const span = domain.max - domain.min;
    return span > 0 ? (value - domain.min) / span : 0.5;
}

/** The fill for one cell: darker is more orders, a longer wait, or a larger late share. */
export function cellFillColor(
    cell: DeliveryZoneCell,
    metric: DeliveryZoneMetric,
    domain: MetricDomain | null
): string {
    const value = metricValue(cell, metric);
    if (value === null || domain === null) return NO_DATA_COLOR;
    return rampColor(rampPosition(value, domain));
}

/**
 * How many of the cell's promised orders were late, or null without a promise on record.
 *
 * Recovered from the rounded share: lateShare carries three decimals, so share x sample is within
 * 0.5 of the true count — exact after rounding — for any sample under a thousand orders. Above
 * that it can be one out, a difference the one-decimal percentage beside it cannot show either.
 */
export function lateCount(cell: DeliveryZoneCell): number | null {
    if (cell.lateShare === null || cell.lateSampleSize === 0) return null;
    return Math.round(cell.lateShare * cell.lateSampleSize);
}

/**
 * Min and max of the lost-demand cells' totals, or null when there are none. Every cell sent has
 * a total above zero, so there is no "no data" grey on this view.
 */
export function lostDemandDomain(cells: readonly LostDemandZoneCell[]): MetricDomain | null {
    if (cells.length === 0) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const cell of cells) {
        min = Math.min(min, cell.total);
        max = Math.max(max, cell.total);
    }
    return {min, max};
}

/** The fill for one lost-demand cell on the same ramp as the delivered metrics: darker is more turned away. */
export function lostDemandFillColor(cell: LostDemandZoneCell, domain: MetricDomain | null): string {
    if (domain === null) return NO_DATA_COLOR;
    return rampColor(rampPosition(cell.total, domain));
}
