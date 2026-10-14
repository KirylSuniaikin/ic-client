import {useCallback, useEffect, useState} from "react";
import {endOfDay, format, startOfDay} from "date-fns";
import {formatInTimeZone} from "date-fns-tz";
import {fetchStatistics} from "../../../../shared/api/public";
import {
    fetchDeliveryAvailabilityStats,
    fetchDeliveryEstimateAccuracy,
    fetchDeliveryHourlyStats,
    fetchDeliverySkipReasonStats,
} from "../../../../shared/api/management";
import {logger} from "../../../../shared/utils/logger";
import type {
    DateRangeState,
    DeliveryAvailabilityStats,
    DeliveryEstimateAccuracy,
    DeliveryHourBucket,
    DeliverySkipReasonStats,
    DoughUsageTO,
    SellsByHourStat,
    StatsResponse,
} from "../types";

const BAHRAIN_TZ = "Asia/Bahrain";

/**
 * The date range the delivery figures currently on screen were actually FETCHED for.
 *
 * Deliberately not the same thing as `dateRange`: the picker calls `setDateRange` on every drag
 * while the data only reloads on "🔁 Refresh", so between the two the live range describes a
 * period nothing has been fetched for. The availability card pins this instead, because its whole
 * purpose is letting a manager compare two readings — and a range that does not belong to the
 * number beside it makes that comparison worse than no label at all.
 *
 * `YYYY-MM-DD`, exactly as sent, so `formatStatRange` can parse it as a local date.
 */
export type DeliveryStatsScope = { startDate: string; finishDate: string };

type UseStatistics = {
    loading: boolean;
    globalStats: StatsResponse | null;
    rangeStats: StatsResponse | null;
    retentionStats: StatsResponse | null;
    sellStats: SellsByHourStat[];
    doughUsage: DoughUsageTO[];
    deliveryAvailability: DeliveryAvailabilityStats | null;
    deliveryStatsScope: DeliveryStatsScope | null;
    deliveryHourly: DeliveryHourBucket[];
    deliveryEstimateAccuracy: DeliveryEstimateAccuracy | null;
    deliverySkipReasons: DeliverySkipReasonStats | null;
    deliveryChainScope: DeliveryStatsScope | null;
    dateRange: DateRangeState[];
    setDateRange: (range: DateRangeState[]) => void;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    refresh: () => Promise<void>;
};

/**
 * @param includeDeliveryStats whether to also load the delivery figures — availability, and the
 *        delivered-by-hour heatmap behind the Delivery tab. False for roles that can open this
 *        screen but not the Performance or Delivery tabs (COOK, SUPERVISOR):
 *        {@code /api/management/delivery/**} is MANAGER-and-up, so fetching it for them would be
 *        a guaranteed 403 on every open for cards they cannot see.
 */
export function useStatistics(branchIds: string[], includeDeliveryStats: boolean): UseStatistics {
    const [dateRange, setDateRange] = useState<DateRangeState[]>([
        {startDate: startOfDay(new Date()), endDate: endOfDay(new Date()), key: "selection"},
    ]);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [globalStats, setGlobalStats] = useState<StatsResponse | null>(null);
    const [rangeStats, setRangeStats] = useState<StatsResponse | null>(null);
    const [retentionStats, setRetentionStats] = useState<StatsResponse | null>(null);
    const [doughUsage, setDoughUsage] = useState<DoughUsageTO[]>([]);
    const [sellStats, setSellStats] = useState<SellsByHourStat[]>([]);
    const [deliveryAvailability, setDeliveryAvailability] = useState<DeliveryAvailabilityStats | null>(null);
    const [deliveryStatsScope, setDeliveryStatsScope] = useState<DeliveryStatsScope | null>(null);
    const [deliveryHourly, setDeliveryHourly] = useState<DeliveryHourBucket[]>([]);
    const [deliveryEstimateAccuracy, setDeliveryEstimateAccuracy] = useState<DeliveryEstimateAccuracy | null>(null);
    const [deliverySkipReasons, setDeliverySkipReasons] = useState<DeliverySkipReasonStats | null>(null);
    // Its own scope, not `deliveryStatsScope`: those two figures are fetched WITHOUT a branch
    // filter (both endpoints read the whole chain by default, which is what makes the road
    // estimate and the staffing question answerable at all), so labelling them with the
    // branch-scoped range would name a narrower question than the one that was asked.
    const [deliveryChainScope, setDeliveryChainScope] = useState<DeliveryStatsScope | null>(null);
    const [loading, setLoading] = useState(true);

    // Joined into the SINGLE existing branchId query param -- the backend param is
    // List<UUID> and Spring binds a comma-joined value (MULTIBRANCH_SPEC.md Part 4).
    const joinedBranchIds = branchIds.join(",");

    // Reads the live date/range/branch from the closure — callers just invoke refresh()
    // with no args (the old loadStats took manual args because its deps were []).
    const refresh = useCallback(async (): Promise<void> => {
        setLoading(true);
        const start = format(dateRange[0].startDate, "yyyy-MM-dd");
        const end = format(dateRange[0].endDate, "yyyy-MM-dd");

        try {
            const retentionDate = formatInTimeZone(selectedDate, BAHRAIN_TZ, "yyyy-MM-dd");
            const response = await fetchStatistics(start, end, retentionDate, joinedBranchIds);
            setGlobalStats(response);
            setRangeStats(response);
            setRetentionStats(response);
            setDoughUsage(response.doughUsageTOS);
            setSellStats(response.sellsByHour);
        } catch (err) {
            logger.error("Failed to load statistics:", err);
        }

        // Fetched inside the SAME refresh so the delivery figures always describe the range
        // the rest of the screen is showing -- but in its own try, because a failure here
        // must not blank the revenue and customer stats the tab is mainly there for.
        if (includeDeliveryStats) {
            try {
                setDeliveryAvailability(await fetchDeliveryAvailabilityStats(start, end, joinedBranchIds));
                // Set from the strings this call was just made with, not from `dateRange`: those
                // two are the same only at the instant of a refresh, and the label exists to
                // describe the numbers rather than the picker.
                setDeliveryStatsScope({ startDate: start, finishDate: end });
            } catch (err) {
                logger.error("Failed to load delivery availability stats:", err);
                setDeliveryAvailability(null);
                // Cleared with the figures it described. A scope left standing over a blank card
                // would claim a range was measured when the request never came back.
                setDeliveryStatsScope(null);
            }

            // A separate try from the availability call above, not a Promise.all: the two answer
            // opposite questions and live on different tabs, so one being down must still leave
            // the other readable rather than blanking both.
            try {
                setDeliveryHourly(await fetchDeliveryHourlyStats(start, end, joinedBranchIds));
            } catch (err) {
                logger.error("Failed to load delivery hourly stats:", err);
                setDeliveryHourly([]);
            }

            // The two chain-wide reads. Separate tries again, for the same reason as above: they
            // answer different questions (are we lying about the time / why riders were passed
            // over) and one being down must not blank the other.
            let chainFetched = false;
            try {
                setDeliveryEstimateAccuracy(await fetchDeliveryEstimateAccuracy(start, end));
                chainFetched = true;
            } catch (err) {
                logger.error("Failed to load delivery estimate accuracy:", err);
                setDeliveryEstimateAccuracy(null);
            }

            try {
                setDeliverySkipReasons(await fetchDeliverySkipReasonStats(start, end));
                chainFetched = true;
            } catch (err) {
                logger.error("Failed to load delivery skip reasons:", err);
                setDeliverySkipReasons(null);
            }

            // Set from the strings these calls were just made with, never from `dateRange`: the
            // picker moves on every drag while the data only reloads on Refresh, and a range that
            // does not belong to the numbers beside it is worse than no range at all. Cleared
            // outright when neither call came back, so no scope can outlive every figure it
            // described.
            setDeliveryChainScope(chainFetched ? {startDate: start, finishDate: end} : null);
        }

        setLoading(false);
    }, [dateRange, selectedDate, joinedBranchIds, includeDeliveryStats]);

    // Fetch once on mount and whenever the branch selection changes; subsequent reloads
    // are user-driven via the Refresh/Upload buttons (POS staff expect explicit reloads).
    // Keyed on the joined string, not the raw array, so an equal-content selection
    // doesn't trigger a spurious refetch on every render.
    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [joinedBranchIds]);

    return {
        loading,
        globalStats,
        rangeStats,
        retentionStats,
        sellStats,
        doughUsage,
        deliveryAvailability,
        deliveryStatsScope,
        deliveryHourly,
        deliveryEstimateAccuracy,
        deliverySkipReasons,
        deliveryChainScope,
        dateRange,
        setDateRange,
        selectedDate,
        setSelectedDate,
        refresh,
    };
}
