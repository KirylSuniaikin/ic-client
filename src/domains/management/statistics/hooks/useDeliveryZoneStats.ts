import {useEffect, useState} from "react";
import {fetchDeliveryZoneStats} from "../../../../shared/api/management";
import {logger} from "../../../../shared/utils/logger";
import type {DeliveryStatsScope} from "./useStatistics";
import type {DeliveryZoneCellMeters, DeliveryZoneStats} from "../types";

export type DeliveryZoneStatsState = {
    /** The last response; null before the first one lands and after a failed request. */
    stats: DeliveryZoneStats | null;
    /**
     * The range `stats` was fetched for. Not `scope` as passed in: while a new range is loading the
     * previous figures stay on screen, and their label has to keep describing them.
     */
    fetchedFor: DeliveryStatsScope | null;
    loading: boolean;
    failed: boolean;
};

const INITIAL_STATE: DeliveryZoneStatsState = {stats: null, fetchedFor: null, loading: false, failed: false};

/**
 * The delivery-zones figures for an applied range and a grid size.
 *
 * Its own fetch rather than another call inside useStatistics' refresh: the cell size is a control
 * on the card, and changing it must refetch this one report without reloading the whole screen.
 * The range still comes from that refresh (`scope` is the range it fetched with), so the map always
 * describes the same window as the cards beside it.
 *
 * Read chain-wide, like the estimate-accuracy report it sits next to — the two count the same
 * delivered orders, and a branch-scoped map beside a chain-wide card would not reconcile with it.
 *
 * A null `scope` means nothing has been applied yet, and nothing is fetched.
 */
export function useDeliveryZoneStats(
    scope: DeliveryStatsScope | null,
    cellMeters: DeliveryZoneCellMeters
): DeliveryZoneStatsState {
    const [state, setState] = useState<DeliveryZoneStatsState>(INITIAL_STATE);

    useEffect(() => {
        if (scope === null) {
            setState(INITIAL_STATE);
            return;
        }

        // A cell-size click while a request is in flight must not let the older answer land last
        // and paint the map with a grid the toggle no longer shows.
        let current = true;
        setState((prev) => ({...prev, loading: true, failed: false}));

        fetchDeliveryZoneStats(scope.startDate, scope.finishDate, cellMeters)
            .then((stats) => {
                if (!current) return;
                setState({stats, fetchedFor: scope, loading: false, failed: false});
            })
            .catch((err: unknown) => {
                if (!current) return;
                logger.error("Failed to load delivery zone stats:", err);
                // The previous figures are dropped with the failure: they belong to a range or a
                // grid size the controls no longer show.
                setState({stats: null, fetchedFor: null, loading: false, failed: true});
            });

        return () => {
            current = false;
        };
    }, [scope, cellMeters]);

    return state;
}
