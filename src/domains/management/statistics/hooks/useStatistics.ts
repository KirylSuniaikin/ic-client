import {useCallback, useEffect, useState} from "react";
import {endOfDay, format, startOfDay} from "date-fns";
import {formatInTimeZone} from "date-fns-tz";
import {fetchStatistics} from "../../../../shared/api/public";
import {logger} from "../../../../shared/utils/logger";
import type {DateRangeState, DoughUsageTO, SellsByHourStat, StatsResponse} from "../types";

const BAHRAIN_TZ = "Asia/Bahrain";

type UseStatistics = {
    loading: boolean;
    globalStats: StatsResponse | null;
    rangeStats: StatsResponse | null;
    retentionStats: StatsResponse | null;
    sellStats: SellsByHourStat[];
    doughUsage: DoughUsageTO[];
    dateRange: DateRangeState[];
    setDateRange: (range: DateRangeState[]) => void;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    refresh: () => Promise<void>;
};

export function useStatistics(branchId: string): UseStatistics {
    const [dateRange, setDateRange] = useState<DateRangeState[]>([
        {startDate: startOfDay(new Date()), endDate: endOfDay(new Date()), key: "selection"},
    ]);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [globalStats, setGlobalStats] = useState<StatsResponse | null>(null);
    const [rangeStats, setRangeStats] = useState<StatsResponse | null>(null);
    const [retentionStats, setRetentionStats] = useState<StatsResponse | null>(null);
    const [doughUsage, setDoughUsage] = useState<DoughUsageTO[]>([]);
    const [sellStats, setSellStats] = useState<SellsByHourStat[]>([]);
    const [loading, setLoading] = useState(true);

    // Reads the live date/range/branch from the closure — callers just invoke refresh()
    // with no args (the old loadStats took manual args because its deps were []).
    const refresh = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const start = format(dateRange[0].startDate, "yyyy-MM-dd");
            const end = format(dateRange[0].endDate, "yyyy-MM-dd");
            const retentionDate = formatInTimeZone(selectedDate, BAHRAIN_TZ, "yyyy-MM-dd");
            const response = await fetchStatistics(start, end, retentionDate, branchId.toString());
            setGlobalStats(response);
            setRangeStats(response);
            setRetentionStats(response);
            setDoughUsage(response.doughUsageTOS);
            setSellStats(response.sellsByHour);
        } catch (err) {
            logger.error("Failed to load statistics:", err);
        } finally {
            setLoading(false);
        }
    }, [dateRange, selectedDate, branchId]);

    // Fetch once on mount and whenever the branch changes; subsequent reloads are
    // user-driven via the Refresh/Upload buttons (POS staff expect explicit reloads).
    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    return {
        loading,
        globalStats,
        rangeStats,
        retentionStats,
        sellStats,
        doughUsage,
        dateRange,
        setDateRange,
        selectedDate,
        setSelectedDate,
        refresh,
    };
}
