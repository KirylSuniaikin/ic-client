import { logger } from "../../../../shared/utils/logger";
import { useEffect, useRef, useState } from 'react';
import type { StompSubscription } from '@stomp/stompjs';
import { connectSocket, socket } from '../../../../shared/api/socket';
import { getBaseAdminInfo, getAllActiveOrders } from '../../../../shared/api/public';
import type { Order, WorkloadLevel, ShiftEventType } from '../../../order/types';
import type { DoughStatus } from '../../dough/types';
import { isDoughAlert } from '../../dough/types';
import BluetoothPrinterService from '../../../../services/BluetoothPrinterService';

export interface UseAdminOrdersResult {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    alertOrder: Order | null;
    setAlertOrder: React.Dispatch<React.SetStateAction<Order | null>>;
    editedOrder: Order | null;
    setEditedOrder: React.Dispatch<React.SetStateAction<Order | null>>;
    workloadLevel: WorkloadLevel;
    setWorkloadLevel: React.Dispatch<React.SetStateAction<WorkloadLevel>>;
    cashStage: ShiftEventType;
    eventStage: ShiftEventType;
    doughStatus: DoughStatus | null;
    setDoughStatus: React.Dispatch<React.SetStateAction<DoughStatus | null>>;
    doughAlertOpen: boolean;
    doughAlertMessage: string;
    clearDoughAlert: () => void;
    loading: boolean;
}

const SUPPRESS_KEY = 'suppressSoundIds';
const EDITED_ORDER_ID_KEY = 'editedOrderId';

const CASH_STAGE_FLOW: Record<string, ShiftEventType> = {
    OPEN_SHIFT_CASH_CHECK: 'CLOSE_SHIFT_CASH_CHECK',
    CLOSE_SHIFT_CASH_CHECK: 'OPEN_SHIFT_CASH_CHECK',
};

const EVENT_STAGE_FLOW: Record<string, ShiftEventType> = {
    OPEN_SHIFT_EVENT: 'CLOSE_SHIFT_EVENT',
    CLOSE_SHIFT_EVENT: 'OPEN_SHIFT_EVENT',
};

// Forward-only ranking of the kitchen status flow. Used to ignore stale/out-of-order
// status frames (e.g. a backend-retried "Oven" landing after "Ready") that would move
// an order's status backward on the board. Statuses not listed (e.g. "Cancelled") are
// treated as applicable.
const STATUS_RANK: Record<string, number> = {
    'Kitchen Phase': 0,
    'Oven': 1,
    'Ready': 2,
    'Picked Up': 3,
};

function normalizeId(x: unknown): string {
    return String(x);
}

function getStringId(o: unknown): string {
    const obj = o as { id?: unknown; orderId?: unknown; order_no?: unknown } | null;
    return String(obj?.id ?? obj?.orderId ?? obj?.order_no ?? o ?? '');
}

// Runtime response wraps orders in an object; cast to access .orders, falling back
// to the raw array shape.
async function fetchActiveOrders(branchId: string): Promise<Order[]> {
    const response = await getAllActiveOrders(String(branchId));
    return (response as unknown as { orders?: Order[] }).orders
        ?? (response as unknown as Order[]);
}

export function useAdminOrders(
    branchId: string | null,
    stopSound: () => void,
    enabled: boolean = true,
): UseAdminOrdersResult {
    const [orders, setOrders] = useState<Order[]>([]);
    const [alertOrder, setAlertOrder] = useState<Order | null>(null);
    const [editedOrder, setEditedOrder] = useState<Order | null>(null);
    const [workloadLevel, setWorkloadLevel] = useState<WorkloadLevel>('IDLE');
    const [cashStage, setCashStage] = useState<ShiftEventType>('OPEN_SHIFT_CASH_CHECK');
    const [eventStage, setEventStage] = useState<ShiftEventType>('OPEN_SHIFT_EVENT');
    const [doughStatus, setDoughStatus] = useState<DoughStatus | null>(null);
    const [doughAlertOpen, setDoughAlertOpen] = useState(false);
    const [doughAlertMessage, setDoughAlertMessage] = useState('');
    const [loading, setLoading] = useState(enabled);

    useEffect(() => {
        if (!enabled || !branchId) return;
        void (async (): Promise<void> => {
            try {
                setLoading(true);
                setOrders(await fetchActiveOrders(branchId));
            } finally { setLoading(false); }
        })();
    }, [branchId, enabled]);

    const suppressedIdsRef = useRef(new Set<string>());
    const ordersRef = useRef<Order[]>([]);
    ordersRef.current = orders;

    const stopSoundRef = useRef(stopSound);
    stopSoundRef.current = stopSound;

    // The initial [branchId] effect above does the first load; the connect callback
    // below only re-hydrates on RECONNECTs. Re-armed on every branch change.
    const isFirstConnectRef = useRef(true);

    useEffect(() => {
        if (!enabled || !branchId) return;
        isFirstConnectRef.current = true;

        // Fetch initial admin base info via REST (same state as admin-base-info subscription)
        getBaseAdminInfo(branchId).then(response => {
            if (!response) return;
            const resp = response as Record<string, unknown>;
            const nextCashStage = (CASH_STAGE_FLOW[String(resp['cashStage'] ?? '')] ||
                String(resp['cashStage'] ?? '')) as ShiftEventType;
            const nextEventStage = (EVENT_STAGE_FLOW[String(resp['checklistStage'] ?? '')] ||
                String(resp['checklistStage'] ?? '')) as ShiftEventType;
            setWorkloadLevel(resp['level'] as WorkloadLevel);
            setCashStage(nextCashStage);
            setEventStage(nextEventStage);
        }).catch(err => logger.error('Ошибка загрузки stage:', err));

        const subscriptions: StompSubscription[] = [];
        let cancelled = false;

        const unregister = connectSocket(() => {
            if (cancelled) return;

            // Runs on every (re)connection. Drop any handles from the previous
            // connection before re-subscribing so reconnects don't accumulate
            // dead subscriptions.
            subscriptions.forEach(sub => sub.unsubscribe());
            subscriptions.length = 0;

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/orders`, async (frame) => {
                    const newOrder = JSON.parse(frame.body) as Order;
                    const id = normalizeId(newOrder?.id ?? newOrder);

                    try {
                        const arr = JSON.parse(localStorage.getItem(SUPPRESS_KEY) || '[]') as unknown[];
                        suppressedIdsRef.current = new Set(arr.map(String));
                    } catch {
                        suppressedIdsRef.current = new Set();
                    }

                    if ('Keeta' !== newOrder.order_type) {
                        BluetoothPrinterService.printOrder(newOrder)
                            .then(() => logger.debug('🖨️ Auto print success'))
                            .catch(e => logger.warn('⚠️ Auto print error:', e));
                    }

                    const alreadyExists = ordersRef.current.some(o => normalizeId(o.id) === id);
                    if (!alreadyExists) {
                        setOrders(prev => {
                            if (prev.some(o => normalizeId(o.id) === id)) return prev;
                            return [...prev, newOrder];
                        });

                        if (suppressedIdsRef.current.has(id)) {
                            suppressedIdsRef.current.delete(id);
                            localStorage.setItem(SUPPRESS_KEY, JSON.stringify([...suppressedIdsRef.current]));
                        } else {
                            setAlertOrder(newOrder);
                        }
                    }

                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: newOrder.id }),
                    });
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/order-updates`, async (frame) => {
                    const updatedOrder = JSON.parse(frame.body) as Order;
                    const id = normalizeId(String(updatedOrder.id));

                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: updatedOrder.id }),
                    });

                    BluetoothPrinterService.printOrder(updatedOrder)
                        .then(() => logger.debug('🖨️ Auto print success'))
                        .catch(e => logger.warn('⚠️ Auto print error:', e));

                    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));

                    try {
                        const arr = JSON.parse(localStorage.getItem(EDITED_ORDER_ID_KEY) || '[]') as unknown[];
                        suppressedIdsRef.current = new Set(arr.map(String));
                    } catch {
                        suppressedIdsRef.current = new Set();
                    }

                    if (suppressedIdsRef.current.has(id)) {
                        suppressedIdsRef.current.delete(id);
                        localStorage.setItem(EDITED_ORDER_ID_KEY, JSON.stringify([...suppressedIdsRef.current]));
                    } else {
                        setEditedOrder(updatedOrder);
                    }
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/order-paid`, (frame) => {
                    const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown };
                    const paidOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);

                    setOrders(prev =>
                        prev.map(o =>
                            getStringId(o) === paidOrderId ? { ...o, isPaid: true } : o
                        )
                    );

                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: paidOrderId }),
                    });
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/order-accepted`, (frame) => {
                    const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown };
                    const acceptedOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);

                    stopSoundRef.current();
                    setAlertOrder(null);

                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: acceptedOrderId }),
                    });
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/order-cancelled`, (frame) => {
                    const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown };
                    const cancelledOrderId = normalizeId(payload?.orderId ?? payload?.id ?? payload);

                    stopSoundRef.current();
                    setAlertOrder(null);
                    setOrders(prev => prev.filter(o => getStringId(o) !== cancelledOrderId));

                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: cancelledOrderId }),
                    });
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/order-status-updated`, (frame) => {
                    const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown; status?: string };
                    const orderId = getStringId(payload?.orderId ?? payload?.id);
                    const status = payload.status;

                    if (status === 'Picked Up') {
                        setOrders(prev => prev.filter(o => getStringId(o) !== orderId));
                    } else {
                        setOrders(prev =>
                            prev.map(o => {
                                if (getStringId(o) !== orderId) return o;
                                // Forward-only guard: ignore a stale/out-of-order frame that
                                // would move the status backward (e.g. a retried "Oven" landing
                                // after "Ready"). Unknown statuses fall through and are applied.
                                const currentRank = STATUS_RANK[o.status as string] ?? -1;
                                const incomingRank = STATUS_RANK[status as string] ?? Number.MAX_SAFE_INTEGER;
                                if (incomingRank < currentRank) return o;
                                return { ...o, status: status as Order['status'] };
                            })
                        );
                    }

                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: orderId }),
                    });
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/admin-base-info`, (frame) => {
                    const payload = JSON.parse(frame.body) as {
                        branchId: unknown;
                        level: WorkloadLevel;
                        cashStage: string;
                        checklistStage: string;
                    };
                    if (String(payload.branchId) === String(branchId)) {
                        setWorkloadLevel(payload.level);
                        const nextCashStage = (CASH_STAGE_FLOW[payload.cashStage] || payload.cashStage) as ShiftEventType;
                        const nextEventStage = (EVENT_STAGE_FLOW[payload.checklistStage] || payload.checklistStage) as ShiftEventType;
                        setCashStage(nextCashStage);
                        setEventStage(nextEventStage);
                    }
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/${branchId}/dough-inventory`, (msg) => {
                    try {
                        const parsed = JSON.parse(msg.body) as DoughStatus;
                        setDoughStatus(parsed);
                    } catch {
                        // silently ignore unparseable frames
                    }
                })
            );

            subscriptions.push(
                socket.subscribe(`/topic/dough-alert/${branchId}`, (msg) => {
                    const parsed: unknown = JSON.parse(msg.body);
                    if (isDoughAlert(parsed)) {
                        setDoughAlertMessage(`${parsed.doughType} dough low: ${parsed.currentAmount} left`);
                        setDoughAlertOpen(true);
                    }
                })
            );

            // STOMP topics are not durable: any frame published while this tablet was
            // briefly disconnected (wifi blip, screen sleep) is lost — the cooks' board
            // would keep showing a stale status. Re-hydrate the full board after every
            // RECONNECT (subscriptions are already re-established above, so nothing sent
            // after this fetch is missed). The first connect is skipped — the initial
            // [branchId] effect already loaded the board.
            if (isFirstConnectRef.current) {
                isFirstConnectRef.current = false;
            } else {
                fetchActiveOrders(branchId)
                    .then(resynced => { if (!cancelled) setOrders(resynced); })
                    .catch(err => logger.error('Order resync on reconnect failed:', err));
            }
        });

        return () => {
            cancelled = true;
            unregister();
            subscriptions.forEach(sub => sub.unsubscribe());
        };
    }, [branchId, enabled]);

    const clearDoughAlert = (): void => {
        setDoughAlertOpen(false);
        setDoughAlertMessage('');
    };

    return {
        orders,
        setOrders,
        alertOrder,
        setAlertOrder,
        editedOrder,
        setEditedOrder,
        workloadLevel,
        setWorkloadLevel,
        cashStage,
        eventStage,
        doughStatus,
        setDoughStatus,
        doughAlertOpen,
        doughAlertMessage,
        clearDoughAlert,
        loading,
    };
}
