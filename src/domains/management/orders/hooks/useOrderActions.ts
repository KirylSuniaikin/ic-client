import { logger } from "../../../../shared/utils/logger";
import { useState } from 'react';
import { updateOrderStatus } from '../../../../shared/api/public';
import type { Order } from '../../../order/types';

function toLongOrNull(v: unknown): number | null {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
    if (typeof v === 'string') {
        if (!/^\d+$/.test(v)) return null;
        const n = Number(v);
        return Number.isSafeInteger(n) ? n : null;
    }
    return null;
}

export function normalizeOrderId(x: unknown): string {
    return String(x);
}

export function getOrderDisplayId(o: unknown): number | null {
    const obj = o as { orderNo?: unknown; id?: unknown; orderId?: unknown } | null;
    return toLongOrNull((obj && (obj.orderNo ?? obj.id ?? obj.orderId)) ?? null);
}

export function getExternalOrderId(o: Order | null): number | null {
    return toLongOrNull((o && (o.jahezOrderId ?? o.external_id)) ?? null);
}

export interface UseOrderActionsParams {
    setAlertOrder: React.Dispatch<React.SetStateAction<Order | null>>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    setError?: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UseOrderActionsResult {
    confirmingAccept: boolean;
    confirmingCancel: boolean;
    cancelReason: string;
    setCancelReason: React.Dispatch<React.SetStateAction<string>>;
    cancelDialogOpen: boolean;
    setCancelDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    confirmExternalOrder: (order: Order) => Promise<void>;
    handleCancel: (order: Order | null) => Promise<void>;
}

export function useOrderActions({ setAlertOrder, setOrders, setError }: UseOrderActionsParams): UseOrderActionsResult {
    const [confirmingAccept, setConfirmingAccept] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    async function confirmExternalOrder(order: Order): Promise<void> {
        const extId = getExternalOrderId(order);
        const orderId = normalizeOrderId(order.id);
        if (!extId) {
            logger.warn('[Confirm] externalId is missing, skip');
            return;
        }
        setConfirmingAccept(true);
        try {
            // "Accepted" is not in the OrderStatus union — cast to pass existing logic unchanged
            await updateOrderStatus({ orderId, jahezOrderId: String(extId), orderStatus: 'Accepted' as Order['status'], reason: null });
            setAlertOrder(null);
        } catch (e) {
            setError?.(String(e));
            logger.error('[Confirm] failed:', e instanceof Error ? e.message : e);
        } finally {
            setConfirmingAccept(false);
        }
    }

    async function handleCancel(order: Order | null): Promise<void> {
        if (!order) return;
        setConfirmingCancel(true);
        try {
            await updateOrderStatus({
                orderId: normalizeOrderId(order.id),
                jahezOrderId: getExternalOrderId(order) !== null ? String(getExternalOrderId(order)) : null,
                orderStatus: 'Cancelled',
                reason: cancelReason.trim(),
            });
            setCancelDialogOpen(false);
            setAlertOrder(null);
            setOrders(prev => prev.filter(o => normalizeOrderId(o.id) !== normalizeOrderId(order.id)));
            setCancelReason('');
        } catch (e) {
            logger.error('[CANCEL] failed:', e instanceof Error ? e.message : e);
        } finally {
            setConfirmingCancel(false);
        }
    }

    return {
        confirmingAccept,
        confirmingCancel,
        cancelReason,
        setCancelReason,
        cancelDialogOpen,
        setCancelDialogOpen,
        confirmExternalOrder,
        handleCancel,
    };
}
