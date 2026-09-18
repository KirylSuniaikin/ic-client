// runs/1b/task-spec.md §6. Polls the frozen Phase 1a tracking endpoint while — and only while —
// the order is trackable: signed-in owner, a delivery order, "Out for delivery", and the tab is
// visible. Modeled on useActiveOrderIsland's token-gated fetch pattern, plus its own
// polling/visibility gating (no existing hook polls on a timer).
import { useEffect, useRef, useState } from "react";
import { fetchCourierLocation } from "../../../shared/api/customerAuth";
import { useCustomerAuth } from "../../customer-auth/context/CustomerAuthProvider";
import { logger } from "../../../shared/utils/logger";
import type { TrackedCourier } from "../types";

const OUT_FOR_DELIVERY_STATUS = "Out for delivery";

// Upper end of the allowed 15-20s range (task-spec.md §4.1): minimizes Google Maps script/billing
// load and backend request volume against a courier position that itself only changes ~once a
// minute (the courier app's own 60s reporting cadence).
export const POLL_INTERVAL_MS = 20_000;

export type UseCourierTrackingResult = {
    courier: TrackedCourier | null;
};

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
    const [courier, setCourier] = useState<TrackedCourier | null>(null);
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
            setCourier(null);
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

        async function poll(): Promise<void> {
            try {
                const response = await fetchCourierLocation(currentToken, currentOrderId);
                setCourier(response.couriers[0] ?? null);
            } catch (error) {
                // Explicit, never a silent catch — self-healing for a transient network blip; a
                // persistent 404/401 simply keeps the map hidden without spamming an error state.
                logger.debug("useCourierTracking: fetchCourierLocation failed", error);
                setCourier(null);
            }
        }

        void poll();
        intervalRef.current = setInterval(() => {
            void poll();
        }, POLL_INTERVAL_MS);

        return clearRunningInterval;
    }, [trackable, visible, orderId, token]);

    return { courier };
}
