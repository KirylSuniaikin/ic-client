import {useCallback, useEffect, useMemo, useState} from "react";
import {format, subMonths} from "date-fns";
import {
    getBusinessStats, patchChannelPerformance, regenerateChannelPerformance
} from "../../../../shared/api/management";
import type {BusinessStatsResponse, ChannelOverridePatch} from "../types";
import {logger} from "../../../../shared/utils/logger";
import type {MonthRange} from "../components/business/MonthRangePickerPopover";

/** Seven columns is the widest a P&L stays readable on a POS tablet. */
const DEFAULT_MONTHS_BACK = 6;

/** Mirrors the server's own limit, so an over-long range is refused here rather than as a 400. */
const MAX_MONTHS = 24;

type UseBusinessStats = {
    loading: boolean;
    data: BusinessStatsResponse | null;
    range: MonthRange;
    rangeLabel: string;
    setRange: (range: MonthRange) => void;
    refresh: () => Promise<void>;
    patchChannel: (id: number, payload: ChannelOverridePatch) => Promise<void>;
    regenerateChannels: () => Promise<void>;
};

function startOfThisMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Normalises a picked range before it can reach the server: a reversed range is swapped rather than
 * rejected (picking "to" before "from" is a normal way to use two calendars), and an over-long one
 * is trimmed from the far end so the months the owner most recently looked at survive.
 */
export function normalizeRange(range: MonthRange): MonthRange {
    const from = range.from <= range.to ? range.from : range.to;
    const to = range.from <= range.to ? range.to : range.from;

    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
    if (months <= MAX_MONTHS) return {from, to};

    return {from: new Date(to.getFullYear(), to.getMonth() - (MAX_MONTHS - 1), 1), to};
}

export function useBusinessStats(): UseBusinessStats {
    const [loading, setLoading] = useState<boolean>(false);
    const [data, setData] = useState<BusinessStatsResponse | null>(null);
    const [range, setRangeState] = useState<MonthRange>(() => {
        const to = startOfThisMonth();
        return {from: subMonths(to, DEFAULT_MONTHS_BACK), to};
    });

    // Keyed on the yyyy-MM strings, not the Date objects: two Dates for the same month are
    // different values and would refetch an identical range on every render.
    const fromKey = useMemo(() => format(range.from, "yyyy-MM"), [range.from]);
    const toKey = useMemo(() => format(range.to, "yyyy-MM"), [range.to]);

    const refresh = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            setData(await getBusinessStats(fromKey, toKey));
        } catch (e) {
            logger.error("Failed to load business stats", e);
        } finally {
            setLoading(false);
        }
    }, [fromKey, toKey]);

    const setRange = useCallback((next: MonthRange): void => {
        setRangeState(normalizeRange(next));
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Both mutations refetch rather than patching state locally: a channel edit changes the
    // month's totals and, later, the profit statement built on them, so a local patch would leave
    // the rest of the screen quietly disagreeing with the row the owner just corrected.
    const patchChannel = useCallback(async (
        id: number,
        payload: ChannelOverridePatch
    ): Promise<void> => {
        try {
            await patchChannelPerformance(id, payload);
            await refresh();
        } catch (e) {
            logger.error("Failed to update channel performance", e);
            // Refetch anyway: on a 409 the server's copy is the truth, and leaving the stale row on
            // screen would invite the owner to retype over someone else's correction.
            await refresh();
        }
    }, [refresh]);

    const regenerateChannels = useCallback(async (): Promise<void> => {
        try {
            await regenerateChannelPerformance(fromKey, toKey);
            await refresh();
        } catch (e) {
            logger.error("Failed to regenerate channel performance", e);
        }
    }, [fromKey, toKey, refresh]);

    const rangeLabel = useMemo(() => {
        const fmt = (d: Date): string =>
            d.toLocaleDateString("en-US", {month: "short", year: "numeric"});
        return `${fmt(range.from)} — ${fmt(range.to)}`;
    }, [range.from, range.to]);

    return {loading, data, range, rangeLabel, setRange, refresh, patchChannel, regenerateChannels};
}
