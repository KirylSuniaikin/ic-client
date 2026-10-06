import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Extracted verbatim from OrderCard.tsx (task-spec.md §5/§8, Phase 4b) — shared by
// OrderCard.tsx and domains/customer-auth/hooks/useActiveOrderIsland.ts so both
// countdown timers compute the same epoch-ms value from a Bahrain-local timestamp.
export function toEpochMsBahrain(s: string | undefined | null): number {
    if (!s) return Date.now();
    const withT = s.replace(' ', 'T');

    if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(withT)) return Date.parse(withT);

    return Date.parse(withT + '+03:00');
}

// Today's calendar date in Bahrain local time, as an ISO YYYY-MM-DD string. Deliberately NOT
// `new Date().toISOString().slice(0,10)` (UTC-based) — that reports the wrong day between 21:00
// and midnight local, which is exactly when an overdue task-card comparison would misfire.
export function todayIsoBahrain(): string {
    return dayjs().tz('Asia/Bahrain').format('YYYY-MM-DD');
}

// A Bahrain-local timestamp rendered as wall-clock HH:mm, or null when there is nothing to show.
//
// The backend sends naive LocalDateTime (no zone) for delivery timings, so the string already IS
// Bahrain wall-clock time; toEpochMsBahrain pins it to +03:00 and the fixed utcOffset renders it
// back at the same offset. Deliberately NOT `new Date(s).toLocaleTimeString()` — that reads the
// zoneless string as UTC and then re-renders it in the device's own zone, which is how a delivery
// ETA ends up three hours out on any tablet not set to Bahrain.
//
// Returns null rather than a dash so the caller decides how "unknown" looks.
export function formatBahrainClock(s: string | null | undefined): string | null {
    if (!s) return null;
    return dayjs(toEpochMsBahrain(s)).utcOffset(180).format('HH:mm');
}

// How long ago a Bahrain-local timestamp was, in whole minutes. Negative for a future stamp,
// which is a real (clock-skew) case and deliberately not clamped — a caller comparing against a
// staleness cutoff should see "not stale" for it, not "stale by a large number".
export function minutesSinceBahrain(s: string, now: number = Date.now()): number {
    return Math.floor((now - toEpochMsBahrain(s)) / 60_000);
}

// A Bahrain-local timestamp as "6 Oct 2026, 15:00", or null when there is nothing to show. Same
// zone handling as formatBahrainClock, for the same reason: the string is already Bahrain wall
// time and must not be re-read in the device's zone.
export function formatBahrainDateTime(s: string | null | undefined): string | null {
    if (!s) return null;
    return dayjs(toEpochMsBahrain(s)).utcOffset(180).format('D MMM YYYY, HH:mm');
}
