import {useEffect, useState} from "react";
import {logger} from "../../../../shared/utils/logger";
import type {DeliveryStatsScope} from "./useStatistics";

export type DeliveryScopedStatsState<T> = {
    /** The last response; null before the first one lands and after a failed request. */
    stats: T | null;
    /**
     * The range `stats` was fetched for — not `scope` as passed in: while a new range loads the
     * previous figures stay on screen, and their label must keep describing them.
     */
    fetchedFor: DeliveryStatsScope | null;
    loading: boolean;
    failed: boolean;
};

const INITIAL_STATE: DeliveryScopedStatsState<null> = {stats: null, fetchedFor: null, loading: false, failed: false};

/**
 * One chain-wide delivery report for the applied range, fetched by the card that shows it.
 *
 * The generic form of useDeliveryZoneStats, for the cards whose only input is the range: one race
 * guard and one failure rule rather than a copy per card. The range still comes from the
 * statistics refresh, so every card on the tab describes the same window.
 *
 * `fetcher` must be referentially stable (a module-level API function, or a useCallback): a new
 * function on every render would refetch on every render. A null `scope` fetches nothing — it is
 * also how a caller switches a report off.
 */
export function useDeliveryScopedStats<T>(
    scope: DeliveryStatsScope | null,
    fetcher: (startDate: string, finishDate: string) => Promise<T>
): DeliveryScopedStatsState<T> {
    const [state, setState] = useState<DeliveryScopedStatsState<T>>(INITIAL_STATE);

    useEffect(() => {
        if (scope === null) {
            setState(INITIAL_STATE);
            return;
        }

        // A newer range (or fetcher) applied while a request is in flight must not let the older
        // answer land last and label itself with the newer range.
        let current = true;
        setState((prev) => ({...prev, loading: true, failed: false}));

        fetcher(scope.startDate, scope.finishDate)
            .then((stats) => {
                if (!current) return;
                setState({stats, fetchedFor: scope, loading: false, failed: false});
            })
            .catch((err: unknown) => {
                if (!current) return;
                logger.error("Failed to load delivery stats:", err);
                // Dropped with the failure: the previous figures belong to a range the controls no
                // longer show.
                setState({stats: null, fetchedFor: null, loading: false, failed: true});
            });

        return () => {
            current = false;
        };
    }, [scope, fetcher]);

    return state;
}
