const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Server strings are Bahrain-local with no offset, so they are read as written, never through Date
// (which would shift them into the browser's zone).
const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

function parts(iso: string): { date: string; time: string | null } {
    const m = ISO_PARTS.exec(iso);
    if (!m) return { date: iso, time: null };
    const month = MONTHS[Number(m[2]) - 1] ?? m[2];
    return { date: `${Number(m[3])} ${month} ${m[1]}`, time: m[4] !== undefined ? `${m[4]}:${m[5]}` : null };
}

export function formatDate(iso: string): string {
    return parts(iso).date;
}

export function formatDateTime(iso: string): string {
    const { date, time } = parts(iso);
    return time === null ? date : `${date}, ${time}`;
}

export function formatHours(n: number): string {
    return n.toFixed(2);
}
