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
import { logger } from "../../../shared/utils/logger";
import { CustomerAuthApiError } from "../types";
import type { CustomerActiveOrder } from "../types";

export type UseActiveOrderIslandResult = {
    activeOrder: CustomerActiveOrder | null;
    status: string | null;
    timeLeft: number;
    totalSec: number;
    isVisible: boolean;
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
    const isVisible = activeOrder !== null && effectiveStatus !== "Picked Up";

    const totalSec = (activeOrder?.estimation ?? 15) * 60;
    const createdMs = toEpochMsBahrain(activeOrder?.createdAt);
    const endTs = createdMs + totalSec * 1000;
    const msLeft = usePreciseCountdown(endTs, 250);
    const timeLeft = Math.ceil(msLeft / 1000);

    const handleClick = useCallback((): void => {
        if (activeOrder) {
            openOrderDetail(activeOrder.id);
        }
    }, [activeOrder, openOrderDetail]);

    return { activeOrder, status: effectiveStatus, timeLeft, totalSec, isVisible, handleClick };
}
