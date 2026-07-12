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
