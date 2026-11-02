import {MonthPrice} from "./types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05" -> "May" */
export function monthLabel(isoMonth: string): string {
    const index = parseInt(isoMonth.slice(5, 7), 10) - 1;
    return MONTH_NAMES[index] ?? isoMonth;
}

export type PriceDirection = "up" | "down" | "flat" | "unknown";

export function priceDirection(changePercent: number | null): PriceDirection {
    if (changePercent === null) return "unknown";
    if (changePercent > 0) return "up";
    if (changePercent < 0) return "down";
    return "flat";
}

/** Bought months only, in order; a product skipped in a month has no price point there. */
export function pricedPoints(prices: MonthPrice[]): {index: number; unitPrice: number}[] {
    return prices.flatMap((p, index) => (p.unitPrice === null ? [] : [{index, unitPrice: p.unitPrice}]));
}
