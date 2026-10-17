// Shared live-status subscription hook (task-spec.md §5/§6, Phase 3) — reused by
// CustomerOrderDetailPopup and (Phase 4b) useActiveOrderIsland. Mirrors the exact
// single-order STOMP contract already established in useOrderStatus.ts: subscribe to
// /topic/{branchId}/order-status-updated, ACK every frame regardless of match, and
// apply a forward-only STATUS_RANK guard before surfacing a status to consumers.
// Subscription + guard only — no fetching here (single responsibility); consumers
// re-fetch via REST when resyncTick changes.
import { useEffect, useRef, useState } from "react";
import type { StompSubscription } from "@stomp/stompjs";
import { connectSocket, socket } from "../../../shared/api/socket";

export type UseOrderLiveStatusResult = {
    liveStatus: string | null;
    resyncTick: number;
};

// Local copy of useAdminOrders.STATUS_RANK (task-spec.md §10 — extracting a shared
// util is a suggestion only, not applied here). Unranked/unknown statuses always pass.
//
// One map covers BOTH fulfilment ladders, because the delivery ladder EXTENDS the pickup
// one instead of branching away from it:
//   pickup:   Kitchen Phase → Oven → Ready → Picked Up            (ends here)
//   delivery: Kitchen Phase → Oven → Ready → Picked Up → Out for delivery
//             → Delivered | Returned Undelivered
// On a delivery order "Picked Up" means the COURIER collected the food from the kitchen,
// and the order only then goes "Out for delivery" (CourierDeliveryService.markPickedUp
// writes OrderStatus.O). The customer keeps watching across that hand-over, which is why
// OrderStatus.CUSTOMER_ACTIVE_EXCLUDED_DELIVERY_LABELS deliberately omits "Picked Up" —
// "a delivery ends at the door". So the two are NOT mutually-exclusive branches out of
// "Ready" (as this map's earlier shared rank 3 claimed): equal ranks pass the `<`
// comparison below, and a retried "Picked Up" frame landing after "Out for delivery"
// walked the customer's view backwards. Every real ladder is strictly increasing through
// this single map, so the hook never needs to know the order type.
//
// "Delivered" and "Returned Undelivered" are terminal SIBLINGS: different endings, neither
// further along than the other. They share a rank so the ranking never claims one is
// progress past the other, and the guard below refuses a *different* status at the same
// rank so neither can override the other (DELIVERY_SPEC.md §12.1-C).
const STATUS_RANK: Record<string, number> = {
    "Kitchen Phase": 0,
    "Oven": 1,
    "Ready": 2,
    "Picked Up": 3,
    "Out for delivery": 4,
    "Delivered": 5,
    "Returned Undelivered": 5,
};

type OrderStatusFramePayload = { id: number; status: string };

// Typed parser for the raw STOMP frame body — backend payload is
// PushOrderStatusUpdated{ id: Long, status: String, branchId: UUID }. Anything not
// matching the required shape returns null and the frame is dropped (no ACK, no state change).
function parseOrderStatusFrame(body: string): OrderStatusFramePayload | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return null;
    }
    const candidate = parsed as { id?: unknown; status?: unknown } | null;
    if (typeof candidate?.id !== "number" || typeof candidate?.status !== "string") {
        return null;
    }
    return { id: candidate.id, status: candidate.status };
}

export function useOrderLiveStatus(branchId: string | null, orderId: number | null): UseOrderLiveStatusResult {
    const [liveStatus, setLiveStatus] = useState<string | null>(null);
    const [resyncTick, setResyncTick] = useState(0);

    // Always reflects the current target order without forcing a re-subscribe.
    const orderIdRef = useRef(orderId);
    orderIdRef.current = orderId;

    const lastRankRef = useRef(-1);
    // The status that set the current high-water mark — needed only to tell the two
    // equal-ranked terminal endings apart.
    const lastRankedStatusRef = useRef<string | null>(null);
    const isFirstConnectRef = useRef(true);

    // A freshly-tracked order starts with no live overrides.
    useEffect(() => {
        setLiveStatus(null);
        setResyncTick(0);
        lastRankRef.current = -1;
        lastRankedStatusRef.current = null;
    }, [orderId]);

    useEffect(() => {
        if (!branchId) return;

        isFirstConnectRef.current = true;
        let subscription: StompSubscription | undefined;

        const unregister = connectSocket(() => {
            // Runs on every (re)connection — drop the previous handle before re-subscribing.
            subscription?.unsubscribe();
            subscription = socket.subscribe(`/topic/${branchId}/order-status-updated`, (frame) => {
                const payload = parseOrderStatusFrame(frame.body);
                if (!payload) return;

                // ACK every frame on the topic, regardless of match — stops OrderEvents'
                // sendWithRetry loop for any subscriber, matching useOrderStatus/useAdminOrders.
                socket.publish({
                    destination: "/app/orders/ack",
                    body: JSON.stringify({ orderId: payload.id }),
                });

                if (payload.id !== orderIdRef.current) return;

                const incomingRank: number | undefined = STATUS_RANK[payload.status];
                // An unranked status is surfaced but must NOT move the high-water mark.
                // Storing a placeholder for it (this used to be MAX_SAFE_INTEGER) both
                // switched the guard off for the rest of the order and dropped every later
                // ranked frame — one "Returned Undelivered" was enough. Letting it pass
                // ungated keeps a status the backend newly starts sending visible, at the
                // price of not ordering it.
                if (incomingRank !== undefined) {
                    if (incomingRank < lastRankRef.current) return;
                    // Equal rank only happens between the terminal siblings above: a
                    // different status at the same rank is a different ending, never forward
                    // progress, so it must not override the applied one. Duplicate frames of
                    // the SAME status keep passing, exactly as they did before.
                    if (incomingRank === lastRankRef.current && payload.status !== lastRankedStatusRef.current) {
                        return;
                    }

                    lastRankRef.current = incomingRank;
                    lastRankedStatusRef.current = payload.status;
                }
                setLiveStatus(payload.status);
                setResyncTick((prev) => prev + 1);
            });

            // Re-subscribe happens first (above); only a genuine RECONNECT (not the initial
            // connect) signals consumers to resync via REST — frames published while
            // disconnected are lost for good.
            if (isFirstConnectRef.current) {
                isFirstConnectRef.current = false;
            } else {
                setResyncTick((prev) => prev + 1);
            }
        });

        return () => {
            unregister();
            subscription?.unsubscribe();
        };
    }, [branchId]);

    return { liveStatus, resyncTick };
}
