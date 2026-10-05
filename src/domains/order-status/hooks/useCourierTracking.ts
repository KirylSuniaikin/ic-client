// runs/1b/task-spec.md §6. Polls the frozen Phase 1a tracking endpoint while — and only while —
// the order is trackable: signed-in owner, a delivery order, "Out for delivery", and the tab is
// visible. Modeled on useActiveOrderIsland's token-gated fetch pattern, plus its own
// polling/visibility gating (no existing hook polls on a timer).
import { useEffect, useRef, useState } from "react";
import { fetchCourierLocation } from "../../../shared/api/customerAuth";
import { useCustomerAuth } from "../../customer-auth/context/CustomerAuthProvider";
import { logger } from "../../../shared/utils/logger";
import { OUT_FOR_DELIVERY_STATUS } from "../../../shared/utils/orderStages";
import type { TrackedCourier, TrackedPart, TrackingDestination } from "../types";

// Matches the courier app's 15 s reporting cadence while it carries an order, so each poll
// usually brings a fresh fix and the moped never sits still for a whole cycle. Polling faster
// would only re-read the same fix.
export const POLL_INTERVAL_MS = 15_000;

export type UseCourierTrackingResult = {
    couriers: TrackedCourier[];
    parts: TrackedPart[];
    destination: TrackingDestination | null;
};

// runs/6b/task-spec.md §6: a render must never show new couriers paired with stale parts (or vice
// versa) — every transition sets both fields from a single object, in one setState call.
type TrackingState = {
    couriers: TrackedCourier[];
    parts: TrackedPart[];
    destination: TrackingDestination | null;
};

const EMPTY_STATE: TrackingState = { couriers: [], parts: [], destination: null };

function useVisibility(): boolean {
    const [visible, setVisible] = useState<boolean>(() => document.visibilityState === "visible");

    useEffect(() => {
        function handleVisibilityChange(): void {
            setVisible(document.visibilityState === "visible");
        }

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return visible;
}

export function useCourierTracking(
    orderId: number | null,
    isDelivery: boolean,
    orderStatus: string | null,
): UseCourierTrackingResult {
    const { token } = useCustomerAuth();
    const visible = useVisibility();
    const [state, setState] = useState<TrackingState>(EMPTY_STATE);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const trackable = token !== null && orderId !== null && isDelivery && orderStatus === OUT_FOR_DELIVERY_STATUS;

    useEffect(() => {
        function clearRunningInterval(): void {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        if (!trackable) {
            // Covers "no token," "not a delivery order," "not out for delivery," and "order left
            // out-for-delivery mid-poll" in one branch — the map must disappear immediately, not
            // linger with a stale marker.
            clearRunningInterval();
            setState(EMPTY_STATE);
            return;
        }

        if (!visible) {
            // Pause, don't blank — resuming visibility should not flash empty before the next
            // fix arrives.
            clearRunningInterval();
            return;
        }

        // trackable && visible: fetch once immediately, then on the poll interval.
        const currentToken = token as string;
        const currentOrderId = orderId as number;

        // Set by this run's cleanup. A request still in flight when the order id (or token) changes
        // answers for an order this hook no longer tracks; if it were applied, the order-detail
        // sheet reopened on another order would show the previous order's rider until the next
        // poll, up to POLL_INTERVAL_MS later.
        let cancelled = false;

        async function poll(): Promise<void> {
            try {
                const response = await fetchCourierLocation(currentToken, currentOrderId);
                if (cancelled) return;
                setState({
                    couriers: response.couriers,
                    parts: response.parts ?? [],
                    // `?? null`: a backend from before the pin was added omits the key entirely.
                    destination: response.destination ?? null,
                });
            } catch (error) {
                // Explicit, never a silent catch — self-healing for a transient network blip; a
                // persistent 404/401 simply keeps the map hidden without spamming an error state.
                logger.debug("useCourierTracking: fetchCourierLocation failed", error);
                if (cancelled) return;
                setState(EMPTY_STATE);
            }
        }

        void poll();
        intervalRef.current = setInterval(() => {
            void poll();
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearRunningInterval();
        };
    }, [trackable, visible, orderId, token]);

    return state;
}
