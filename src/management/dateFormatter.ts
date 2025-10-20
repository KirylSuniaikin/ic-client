export function dateFormatter(sep: string = "-", padDay = false): string {
    const d = new Date();
    const parts = new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).formatToParts(d);

    const m = parts.find(p => p.type === "month")!.value.toLowerCase(); // "oct"
    const dayRaw = parts.find(p => p.type === "day")!.value;            // "4"
    const y = parts.find(p => p.type === "year")!.value;                // "2025"

    const dd = padDay ? dayRaw.padStart(2, "0") : dayRaw;
    return [m, dd, y].join(sep);
}