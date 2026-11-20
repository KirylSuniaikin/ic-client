import { useCallback, useMemo, useRef, useState } from "react";
import { editOrder } from "../../../../../shared/api/public";
import { logger } from "../../../../../shared/utils/logger";
import type { CartItem } from "../../../../menu/types";
import { hydrateOrderItemsForEdit } from "../../../../menu/utils/hydrateOrderItems";
import { NO_CUSTOMER_PHONE } from "../../../../order/types";
import type { Order } from "../../../../order/types";
import { buildEditOrderRequest, computeAmountPaid } from "../../../../order/utils/orderPayload";
import { EDITED_ORDER_ID_KEY } from "../../hooks/useAdminOrders";
import { diffOrderLines, orderLineSignature } from "./diffOrderLines";
import type { OrderLineDiff } from "./diffOrderLines";

/** How a line compares with the same line in the order as it was opened. */
export type OrderLineStatus =
    | { kind: "unchanged" }
    | { kind: "new" }
    | { kind: "added"; count: number }
    | { kind: "removed"; count: number };

export interface OrderEditLine {
    key: string;
    item: CartItem;
    status: OrderLineStatus;
}

/** Why Complete is disabled, or null when it is not. */
export type CompleteBlocker = "noChanges" | "emptyOrder" | null;

export interface OrderEditSummaryData extends OrderLineDiff {
    originalTotal: number;
    editedTotal: number;
}

export type OrderEditPhase = "editing" | "saving" | "saved";

export interface UseOrderEditResult {
    lines: OrderEditLine[];
    addItems: (items: CartItem[]) => void;
    /** Swaps a line for what its popup produced — a changed pizza is a different line. */
    replaceLine: (key: string, items: CartItem[]) => void;
    increment: (key: string) => void;
    /** Down to zero removes the line. */
    decrement: (key: string) => void;
    removeLine: (key: string) => void;
    diff: OrderLineDiff;
    hasChanges: boolean;
    completeBlocker: CompleteBlocker;
    totalQuantity: number;
    originalTotal: number;
    editedTotal: number;
    phase: OrderEditPhase;
    saveError: string | null;
    complete: () => Promise<void>;
    /** Set once the save succeeded: what the staff member is shown for 10 seconds. */
    summary: OrderEditSummaryData | null;
}

interface KeyedItem {
    key: string;
    item: CartItem;
}

function readEditedIds(): string[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(EDITED_ORDER_ID_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (err) {
        logger.warn("Order edit: unreadable edited-order ids, starting a new list:", err);
        return [];
    }
}

// Written BEFORE the save: unlike the route flow, the board is live behind this popup, and the
// order-updates frame can land before the PUT resolves.
function markEditedHere(orderId: string): void {
    const ids = readEditedIds();
    if (!ids.includes(orderId)) localStorage.setItem(EDITED_ORDER_ID_KEY, JSON.stringify([...ids, orderId]));
}

function unmarkEditedHere(orderId: string): void {
    localStorage.setItem(EDITED_ORDER_ID_KEY, JSON.stringify(readEditedIds().filter(id => id !== orderId)));
}

function phoneOf(order: Order): string | null {
    return order.phone_number && order.phone_number !== NO_CUSTOMER_PHONE ? order.phone_number : null;
}

function lineStatus(quantity: number, originalQuantity: number): OrderLineStatus {
    if (originalQuantity === 0) return { kind: "new" };
    if (quantity > originalQuantity) return { kind: "added", count: quantity - originalQuantity };
    if (quantity < originalQuantity) return { kind: "removed", count: originalQuantity - quantity };
    return { kind: "unchanged" };
}

/**
 * The line state of the order-edit popup. The order's lines are snapshotted when the popup opens,
 * so a board refresh mid-edit (a status frame replacing the order object) never resets the edit.
 */
export function useOrderEdit(order: Order): UseOrderEditResult {
    const [original] = useState<CartItem[]>(() => hydrateOrderItemsForEdit(order.items));
    const [keyed, setKeyed] = useState<KeyedItem[]>(() => original.map((item, i) => ({ key: `line-${i}`, item })));
    const nextKeyRef = useRef(original.length);
    const savingRef = useRef(false);
    const [phase, setPhase] = useState<OrderEditPhase>("editing");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [summary, setSummary] = useState<OrderEditSummaryData | null>(null);

    const newKey = useCallback((): string => `line-${nextKeyRef.current++}`, []);

    const mergeInto = useCallback((list: KeyedItem[], items: CartItem[]): KeyedItem[] => {
        const next = [...list];
        for (const item of items) {
            const signature = orderLineSignature(item);
            const index = next.findIndex(line => orderLineSignature(line.item) === signature);
            if (index === -1) next.push({ key: newKey(), item: { ...item } });
            else next[index] = { ...next[index], item: { ...next[index].item, quantity: next[index].item.quantity + item.quantity } };
        }
        return next;
    }, [newKey]);

    const addItems = useCallback((items: CartItem[]): void => {
        setKeyed(prev => mergeInto(prev, items));
    }, [mergeInto]);

    const replaceLine = useCallback((key: string, items: CartItem[]): void => {
        setKeyed(prev => {
            const index = prev.findIndex(line => line.key === key);
            if (index === -1) return mergeInto(prev, items);
            const [replacement, ...extras] = items;
            if (replacement === undefined) return prev.filter(line => line.key !== key);
            const rest = prev.filter(line => line.key !== key);
            const signature = orderLineSignature(replacement);
            // Saved back unchanged, or onto another line's exact options: one line, not two.
            const twin = rest.some(line => orderLineSignature(line.item) === signature);
            const inPlace = twin
                ? mergeInto(rest, [replacement])
                : [...rest.slice(0, index), { key: newKey(), item: { ...replacement } }, ...rest.slice(index)];
            return mergeInto(inPlace, extras);
        });
    }, [mergeInto, newKey]);

    const setQuantity = useCallback((key: string, change: (quantity: number) => number): void => {
        setKeyed(prev => prev.flatMap(line => {
            if (line.key !== key) return [line];
            const quantity = change(line.item.quantity);
            return quantity <= 0 ? [] : [{ ...line, item: { ...line.item, quantity } }];
        }));
    }, []);

    const increment = useCallback((key: string): void => setQuantity(key, q => q + 1), [setQuantity]);
    const decrement = useCallback((key: string): void => setQuantity(key, q => q - 1), [setQuantity]);
    const removeLine = useCallback((key: string): void => setQuantity(key, () => 0), [setQuantity]);

    const editedItems = useMemo(() => keyed.map(line => line.item), [keyed]);
    const diff = useMemo(() => diffOrderLines(original, editedItems), [original, editedItems]);

    const originalQuantities = useMemo(() => {
        const totals = new Map<string, number>();
        for (const item of original) {
            const signature = orderLineSignature(item);
            totals.set(signature, (totals.get(signature) ?? 0) + item.quantity);
        }
        return totals;
    }, [original]);

    const lines = useMemo<OrderEditLine[]>(() => keyed.map(line => ({
        ...line,
        status: lineStatus(line.item.quantity, originalQuantities.get(orderLineSignature(line.item)) ?? 0),
    })), [keyed, originalQuantities]);

    const hasChanges = diff.added.length + diff.removed.length > 0;
    const isEmpty = keyed.length === 0;
    const completeBlocker: CompleteBlocker = isEmpty ? "emptyOrder" : hasChanges ? null : "noChanges";
    const totalQuantity = editedItems.reduce((sum, item) => sum + item.quantity, 0);
    const originalTotal = useMemo(() => computeAmountPaid(original), [original]);
    const editedTotal = useMemo(() => computeAmountPaid(editedItems), [editedItems]);

    async function complete(): Promise<void> {
        if (completeBlocker !== null || savingRef.current) return;
        savingRef.current = true;
        setPhase("saving");
        setSaveError(null);
        const orderId = String(order.id);
        markEditedHere(orderId);
        try {
            // Everything but the lines goes back exactly as the order has it: this popup does not
            // edit the customer, payment type or notes (spec §2, §8 Q5).
            const request = buildEditOrderRequest(
                { id: order.id, order_no: order.order_no, address: order.address },
                {
                    tel: phoneOf(order),
                    customerName: order.customer_name,
                    deliveryMethod: order.delivery_method,
                    paymentType: order.payment_type,
                    notes: order.notes,
                },
                editedItems,
            );
            await editOrder(request, orderId);
            setSummary({ ...diff, originalTotal, editedTotal });
            setPhase("saved");
        } catch (err) {
            logger.error("Order edit: saving the order failed:", err);
            unmarkEditedHere(orderId);
            setSaveError(err instanceof Error ? err.message : String(err));
            setPhase("editing");
        } finally {
            savingRef.current = false;
        }
    }

    return {
        lines, addItems, replaceLine, increment, decrement, removeLine,
        diff, hasChanges, completeBlocker, totalQuantity, originalTotal, editedTotal,
        phase, saveError, complete, summary,
    };
}
