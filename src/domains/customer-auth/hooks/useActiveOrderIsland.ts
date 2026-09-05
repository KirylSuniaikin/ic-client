// Domain hook backing the Dynamic-Island-style active-order pill on HomePage
// (task-spec.md §4.16-20/§5/§6, Phase 4b). Fetches the customer's active order via
// Phase 4a's fetchActiveOrder, tracks live status via Phase 3's shared
// useOrderLiveStatus (same STOMP topic/subscription — no second subscription
// pattern), and derives the CircularTimer's countdown using OrderCard's exact math.
import { useCallback, useEffect, useState } from "react";
import { fetchActiveOrder } from "../../../shared/api/customerAuth";
import { useCustomerAuth } from "../context/CustomerAuthProvider";
import { useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import { useOrderLiveStatus } from "./useOrderLiveStatus";
import { usePreciseCountdown } from "../../../shared/hooks/usePreciseCountdown";
import { toEpochMsBahrain } from "../../../shared/utils/timeUtils";
import { computeRideProgress } from "../../../shared/utils/orderStages";
import type { RideProgress } from "../../../shared/utils/orderStages";
import { logger } from "../../../shared/utils/logger";
import { CustomerAuthApiError } from "../types";
import type { CustomerActiveOrder } from "../types";

// An order leaves the island once it reaches a terminal status — and the two order types end
// differently.
//
// "Picked Up" ends a PICKUP order: the customer has the food. On a DELIVERY order the same status
// means the courier collected it and the customer is still waiting, so treating it as terminal
// made the widget vanish at hand-over — precisely when there is most to watch. A delivery ends at
// the door, or when it comes back undelivered.
//
// This stays the ONE place terminality is decided. ActiveOrderIslandPill now draws "Delivered"
// as the last node of the delivery ladder, but that node is only ever a destination on the
// track: the moment the status actually becomes Delivered, isVisible goes false here and the
// pill unmounts. The pill must not re-test for it.
const DELIVERY_TYPE = "Delivery";
const PICKUP_TERMINAL_STATUSES: ReadonlySet<string> = new Set(["Picked Up", "Delivered"]);
const DELIVERY_TERMINAL_STATUSES: ReadonlySet<string> = new Set(["Delivered", "Returned Undelivered"]);

function isTerminalStatus(status: string | null, orderType: string | undefined): boolean {
    if (status === null) return false;
    return orderType === DELIVERY_TYPE
        ? DELIVERY_TERMINAL_STATUSES.has(status)
        : PICKUP_TERMINAL_STATUSES.has(status);
}

export type UseActiveOrderIslandResult = {
    /** Seconds until the estimated arrival, or null when there is no arrival estimate. */
    arrivalTimeLeft: number | null;
    activeOrder: CustomerActiveOrder | null;
    status: string | null;
    timeLeft: number;
    totalSec: number;
    isVisible: boolean;
    /**
     * The ride's live fill, or null when it cannot be quantified. Derived here rather than in
     * the pill: the pill is presentational and holds no state, and the fill has to advance on a
     * clock. Always null for a pickup order — the backend sends it no delivery timings at all.
     */
    rideProgress: RideProgress | null;
    handleClick: () => void;
};

export function useActiveOrderIsland(): UseActiveOrderIslandResult {
    const { token } = useCustomerAuth();
    const { openOrderDetail, activeOrderRefreshKey } = useCustomerAuthUi();
    const [activeOrder, setActiveOrder] = useState<CustomerActiveOrder | null>(null);

    const loadActiveOrder = useCallback(async (accessToken: string): Promise<void> => {
        try {
            const result = await fetchActiveOrder(accessToken);
            setActiveOrder(result);
        } catch (err) {
            // A 401 is treated like a logged-out state for this hook only — session-expiry
            // handling (logout()) stays owned by the popups per existing convention (task-spec.md §7);
            // any other failure is ambient (mirrors CustomerAuthProvider's silent-refresh pattern) —
            // this is a passive homepage feature, so it just hides the pill rather than surfacing
            // an error UI, logging for diagnosability instead of a silent catch.
            if (err instanceof CustomerAuthApiError && err.status === 401) {
                setActiveOrder(null);
            } else {
                logger.error("useActiveOrderIsland: fetchActiveOrder failed", err);
                setActiveOrder(null);
            }
        }
    }, []);

    useEffect(() => {
        if (!token) {
            setActiveOrder(null);
            return;
        }
        void loadActiveOrder(token);
    }, [token, loadActiveOrder]);

    const { liveStatus, resyncTick } = useOrderLiveStatus(activeOrder?.branchId ?? null, activeOrder?.id ?? null);

    useEffect(() => {
        if (resyncTick > 0 && token) {
            void loadActiveOrder(token);
        }
    }, [resyncTick, token, loadActiveOrder]);

    // Refetch when a new order is created (useCheckout → refreshActiveOrder), so the
    // widget picks up the freshly-placed order without a page remount.
    useEffect(() => {
        if (activeOrderRefreshKey > 0 && token) {
            void loadActiveOrder(token);
        }
    }, [activeOrderRefreshKey, token, loadActiveOrder]);

    const effectiveStatus = liveStatus ?? activeOrder?.status ?? null;
    const isVisible = activeOrder !== null && !isTerminalStatus(effectiveStatus, activeOrder.type);

    const totalSec = (activeOrder?.estimation ?? 15) * 60;
    const createdMs = toEpochMsBahrain(activeOrder?.createdAt);
    const endTs = createdMs + totalSec * 1000;
    const msLeft = usePreciseCountdown(endTs, 250);
    const timeLeft = Math.ceil(msLeft / 1000);

    // The ride's own clock, separate from the countdown to Ready above: `estimation` is minutes
    // to Ready and says nothing about the door. Both stamps are absent on a pickup order and on
    // a delivery order with no courier yet, and toEpochMsBahrain answers Date.now() for a missing
    // string — which would read as "the ride started this instant" — so they are guarded to null
    // here and the whole calculation opts out rather than inventing a start.
    const handoverMs = activeOrder?.handoverAt ? toEpochMsBahrain(activeOrder.handoverAt) : null;
    const arrivalMs = activeOrder?.estimatedDeliveredAt ? toEpochMsBahrain(activeOrder.estimatedDeliveredAt) : null;
    // Ticks every second whether or not there is a ride; the hook cannot be called conditionally.
    const msToArrival = usePreciseCountdown(arrivalMs ?? 0, 1000);
    const rideProgress = computeRideProgress(handoverMs, arrivalMs, msToArrival);
    // Seconds to the door, for the whole life of a delivery order rather than only during the ride.
    // `timeLeft` above counts to the KITCHEN, which is what a customer collecting is waiting for and
    // not what a customer being delivered to is: the pill was quoting "ready in ~9 min" to somebody
    // whose food then still had a twenty-minute drive in front of it. Null when the backend could
    // not derive an arrival at all (no address coordinates, no branch coordinates), which the pill
    // renders by falling back to the kitchen countdown rather than by inventing one.
    const arrivalTimeLeft = arrivalMs === null ? null : Math.ceil(msToArrival / 1000);

    const handleClick = useCallback((): void => {
        if (activeOrder) {
            openOrderDetail(activeOrder.id);
        }
    }, [activeOrder, openOrderDetail]);

    return {
        activeOrder, status: effectiveStatus, timeLeft, arrivalTimeLeft, totalSec, isVisible,
        rideProgress, handleClick,
    };
}
