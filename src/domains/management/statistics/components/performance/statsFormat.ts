export function formatStatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
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
