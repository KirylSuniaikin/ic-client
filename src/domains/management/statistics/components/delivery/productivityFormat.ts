import {formatOutageDuration} from "../performance/DeliveryAvailabilityCard";
import {formatDataSince, formatIsoDate} from "./deliveryMetricsUi";
import type {MetricCoverage} from "../../types";

// Courier productivity formatting, shared by the fleet card on the Delivery tab and the courier
// panel's per-rider tiles, so the same minutes never print two ways.

/** "8h 0m" from minutes — the availability card's duration format, so the tab reads one way. */
export function formatShiftMinutes(minutes: number): string {
    return formatOutageDuration(minutes * 60);
}

/** Km with one decimal, or an em dash when the GPS that would measure it is no longer kept. */
export function formatKm(km: number | null): string {
    return km == null || Number.isNaN(km) ? "—" : km.toFixed(1);
}

/**
 * Why the to-kitchen column may be short. Before the deploy that began recording assignment times,
 * the ride to the kitchen cannot be told from waiting for work, so it was counted as free.
 */
export function splitCoverageNote(coverage: MetricCoverage, splitDataSince: string): string | null {
    if (coverage === "FULL") return null;
    const since = formatDataSince(splitDataSince);
    return coverage === "NONE"
        ? `Going to the kitchen is recorded from ${since}; in this range it is all counted as free.`
        : `Going to the kitchen is recorded from ${since}; before that it is counted as free.`;
}

/**
 * The GPS caveat, said only when it applies: km before gpsDataSince is not counted because the
 * trail is no longer kept, which would otherwise read as a quiet week.
 */
export function gpsNote(gpsDataSince: string, windowStart: string): string | null {
    return windowStart < gpsDataSince
        ? `GPS before ${formatIsoDate(gpsDataSince)} is no longer kept, so km before it is not counted.`
        : null;
}
