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
const STATUS_RANK: Record<string, number> = {
    "Kitchen Phase": 0,
    "Oven": 1,
    "Ready": 2,
    "Picked Up": 3,
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
    const isFirstConnectRef = useRef(true);

    // A freshly-tracked order starts with no live overrides.
    useEffect(() => {
        setLiveStatus(null);
        setResyncTick(0);
        lastRankRef.current = -1;
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

                const incomingRank = STATUS_RANK[payload.status] ?? Number.MAX_SAFE_INTEGER;
                if (incomingRank < lastRankRef.current) return;

                lastRankRef.current = incomingRank;
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
