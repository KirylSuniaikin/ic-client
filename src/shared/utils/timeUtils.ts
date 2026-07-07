// Extracted verbatim from OrderCard.tsx (task-spec.md §5/§8, Phase 4b) — shared by
// OrderCard.tsx and domains/customer-auth/hooks/useActiveOrderIsland.ts so both
// countdown timers compute the same epoch-ms value from a Bahrain-local timestamp.
export function toEpochMsBahrain(s: string | undefined | null): number {
    if (!s) return Date.now();
    const withT = s.replace(' ', 'T');

    if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(withT)) return Date.parse(withT);

    return Date.parse(withT + '+03:00');
}
