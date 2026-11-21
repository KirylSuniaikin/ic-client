import { useCallback, useMemo, useRef, useState } from "react";
import type { CartItem } from "../../../../menu/types";
import { computeAmountPaid } from "../../../../order/utils/orderPayload";
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

export interface UseOrderLinesResult {
    lines: OrderEditLine[];
    /** The lines as cart items, in order: what gets saved. */
    items: CartItem[];
    addItems: (items: CartItem[]) => void;
    /** Swaps a line for what its popup produced — a changed pizza is a different line. */
    replaceLine: (key: string, items: CartItem[]) => void;
    increment: (key: string) => void;
    /** Down to zero removes the line. */
    decrement: (key: string) => void;
    removeLine: (key: string) => void;
    /** Rewrites every line at once (an order-wide discount). */
    mapItems: (change: (item: CartItem) => CartItem) => void;
    /** Drops every line whose item matches (items the backend reports as no longer available). */
    dropItems: (matches: (item: CartItem) => boolean) => void;
    diff: OrderLineDiff;
    hasChanges: boolean;
    totalQuantity: number;
    originalTotal: number;
    editedTotal: number;
}

interface KeyedItem {
    key: string;
    item: CartItem;
}

function lineStatus(quantity: number, originalQuantity: number): OrderLineStatus {
    if (originalQuantity === 0) return { kind: "new" };
    if (quantity > originalQuantity) return { kind: "added", count: quantity - originalQuantity };
    if (quantity < originalQuantity) return { kind: "removed", count: originalQuantity - quantity };
    return { kind: "unchanged" };
}

/**
 * The lines of an order being edited or built, compared with `original` (empty for a new order).
 * `original` is read once, on mount: a board refresh mid-edit never resets the lines.
 */
export function useOrderLines(original: CartItem[]): UseOrderLinesResult {
    const [base] = useState<CartItem[]>(original);
    const [keyed, setKeyed] = useState<KeyedItem[]>(() => base.map((item, i) => ({ key: `line-${i}`, item })));
    const nextKeyRef = useRef(base.length);

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

    const mapItems = useCallback((change: (item: CartItem) => CartItem): void => {
        setKeyed(prev => prev.map(line => ({ ...line, item: change(line.item) })));
    }, []);

    const dropItems = useCallback((matches: (item: CartItem) => boolean): void => {
        setKeyed(prev => prev.filter(line => !matches(line.item)));
    }, []);

    const items = useMemo(() => keyed.map(line => line.item), [keyed]);
    const diff = useMemo(() => diffOrderLines(base, items), [base, items]);

    const originalQuantities = useMemo(() => {
        const totals = new Map<string, number>();
        for (const item of base) {
            const signature = orderLineSignature(item);
            totals.set(signature, (totals.get(signature) ?? 0) + item.quantity);
        }
        return totals;
    }, [base]);

    const lines = useMemo<OrderEditLine[]>(() => keyed.map(line => ({
        ...line,
        status: lineStatus(line.item.quantity, originalQuantities.get(orderLineSignature(line.item)) ?? 0),
    })), [keyed, originalQuantities]);

    const originalTotal = useMemo(() => computeAmountPaid(base), [base]);
    const editedTotal = useMemo(() => computeAmountPaid(items), [items]);

    return {
        lines, items, addItems, replaceLine, increment, decrement, removeLine, mapItems, dropItems,
        diff,
        hasChanges: diff.added.length + diff.removed.length > 0,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        originalTotal,
        editedTotal,
    };
}
