import { useEffect, useRef, useState } from 'react';
import type { StompSubscription } from '@stomp/stompjs';
import { connectSocket, socket } from '../../../shared/api/socket';
import { getOrderStatus } from '../../../shared/api/public';
import type { OrderStatusData } from '../types';

export interface UseOrderStatusResult {
    order: OrderStatusData | null;
    loading: boolean;
    remainingSeconds: number;
}

// Forward-only ordering for the kitchen flow, the same map (and the same reasoning) as the two
// siblings that already rank statuses: `STATUS_RANK` in `useAdminOrders` and in
// `useOrderLiveStatus`. Status frames are last-write-wins and the backend retries the same
// orderId across transitions, so a retried "Ready" can land after "Out for delivery" and walk
// this page backwards until the REST re-read lands.
//
// One map covers BOTH fulfilment ladders, because delivery EXTENDS pickup instead of branching
// away from it — on a delivery order "Picked Up" means the courier collected the food, and the
// order only then goes "Out for delivery". "Delivered" and "Returned Undelivered" are terminal
// SIBLINGS: different endings, neither further along than the other, so they share a rank and the
// guard below refuses to let one replace the other.
const STATUS_RANK: Record<string, number> = {
    'Kitchen Phase': 0,
    'Oven': 1,
    'Ready': 2,
    'Picked Up': 3,
    'Out for delivery': 4,
    'Delivered': 5,
    'Returned Undelivered': 5,
};

export function useOrderStatus(orderId: string): UseOrderStatusResult {
    const [order, setOrder] = useState<OrderStatusData | null>(null);
    const [branchId, setBranchId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    // Bumped by every status frame so the REST payload is re-read. A status change can carry new
    // delivery timings with it -- "Out for delivery" is the first moment handoverAt exists at all
    // -- and the frame itself only carries the status string, so applying the frame alone would
    // leave the ride permanently without an arrival time. Same resync-after-a-frame shape as
    // useActiveOrderIsland.
    const [resyncTick, setResyncTick] = useState(0);

    const currentIdRef = useRef(orderId);
    useEffect(() => {
        currentIdRef.current = orderId;
    }, [orderId]);

    useEffect(() => {
        let active = true;

        async function fetchStatus(): Promise<void> {
            const data = await getOrderStatus(orderId);
            if (!active) return;
            if ('error' in data && data.error) return;
            // safe because: the 'error' branch above returned early; remaining shape matches OrderStatusData
            const orderData = data as OrderStatusData;
            setOrder(orderData);
            setBranchId(orderData.branchId ?? '');
            setLoading(false);
        }

        fetchStatus();
        return () => { active = false; };
    }, [orderId, resyncTick]);

    useEffect(() => {
        if (!order?.orderCreated || !order?.estimationTime) return;

        const createdTime = new Date(order.orderCreated).getTime();
        const totalSec = order.estimationTime * 60;

        function updateRemaining(): void {
            const elapsed = Math.floor((Date.now() - createdTime) / 1000);
            setRemainingSeconds(Math.max(totalSec - elapsed, 0));
        }

        updateRemaining();
        const intervalId = setInterval(updateRemaining, 1000);
        return () => clearInterval(intervalId);
    }, [order]);

    useEffect(() => {
        if (!branchId) return;

        let subscription: StompSubscription | undefined;

        const unregister = connectSocket(() => {
            // Runs on every (re)connection — drop the previous handle before re-subscribing
            subscription?.unsubscribe();
            subscription = socket.subscribe(
                `/topic/${branchId}/order-status-updated`,
                (frame) => {
                    // STOMP frame body is a raw string from backend; shape matches backend OrderStatusUpdatedEvent
                    const payload = JSON.parse(frame.body) as { id?: unknown; orderId?: unknown; status?: string };
                    const eventId = Number(payload.id ?? payload.orderId ?? payload);
                    const currentId = Number(currentIdRef.current);
                    if (eventId === currentId) {
                        const incomingStatus = payload.status ?? '';
                        setOrder(prev => {
                            if (!prev) return prev;
                            // Unranked statuses are applied but never used as a floor, so a status
                            // the backend newly starts sending stays visible.
                            const currentRank = STATUS_RANK[prev.orderStatus] ?? -1;
                            const incomingRank = STATUS_RANK[incomingStatus] ?? Number.MAX_SAFE_INTEGER;
                            // A lower rank is a retry of a transition this order already passed.
                            if (incomingRank < currentRank) return prev;
                            // Equal rank only ever happens between the terminal siblings: a
                            // different status at the same rank is a different ending, never
                            // forward progress. Duplicate frames of the SAME status still pass.
                            if (incomingRank === currentRank && incomingStatus !== prev.orderStatus) return prev;
                            return { ...prev, orderStatus: incomingStatus };
                        });
                        setResyncTick(tick => tick + 1);
                    }
                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: Number(payload.id) }),
                    });
                }
            );
        });

        return () => { unregister(); subscription?.unsubscribe(); };
    }, [branchId]);

    return { order, loading, remainingSeconds };
}
