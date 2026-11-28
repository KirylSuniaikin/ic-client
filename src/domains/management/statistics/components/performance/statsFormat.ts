import type {StatsResponse} from "../../types";

export function formatStatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
}

// Parses a "YYYY-MM-DD" string as a LOCAL date (never new Date(string), which is UTC
// midnight and reparsing-shifts in negative-offset browser timezones).
function parseLocalDate(isoDate: string): Date {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function formatStatRange(startISO: string, finishISO: string): string {
    const start = parseLocalDate(startISO);
    const finish = parseLocalDate(finishISO);
    if (start.getTime() === finish.getTime()) {
        return formatStatDate(start);
    }
    return `${formatStatDate(start)} — ${formatStatDate(finish)}`;
}

export function countPercentage(total: number, value: number): string {
    if (!total || Number.isNaN(total)) return "0";
    return ((value / total) * 100).toFixed(2);
}

// Renders an all-time average prep time (stored in seconds) as a human-readable
// "Xm Ys" / "Ys" string. Returns "—" when no prep time has been recorded yet.
export function formatPrepTime(seconds: number | null): string {
    if (seconds == null || Number.isNaN(seconds)) return "—";
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
}

// Average order value over the date-range card's own order set: the Pick Up + Talabat + Keeta
// revenue tiles divided by the same three order-count tiles, so it always reconciles with the
// numbers printed beside it. null when the range has no orders (never divides by zero).
export function rangeAverageOrderValue(stats: StatsResponse): number | null {
    const orders = stats.totalPickUpOrderCount + stats.totalTalabatOrders + stats.totalKeetaOrders;
    if (!orders) return null;
    const revenue = stats.totalPickUpRevenue + stats.totalTalabatRevenue + stats.totalKeetaRevenue;
    return revenue / orders;
}

// Same 2-decimal BD rendering as the all-time AOV in GlobalStatsCard; "—" when there is no value.
export function formatAverageOrderValue(value: number | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    return value.toFixed(2);
}
