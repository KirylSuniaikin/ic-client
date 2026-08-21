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
