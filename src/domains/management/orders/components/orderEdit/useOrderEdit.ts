import { useRef, useState } from "react";
import { editOrder } from "../../../../../shared/api/public";
import { logger } from "../../../../../shared/utils/logger";
import type { CartItem } from "../../../../menu/types";
import { hydrateOrderItemsForEdit } from "../../../../menu/utils/hydrateOrderItems";
import { NO_CUSTOMER_PHONE } from "../../../../order/types";
import type { Order } from "../../../../order/types";
import { buildEditOrderRequest } from "../../../../order/utils/orderPayload";
import { EDITED_ORDER_ID_KEY } from "../../hooks/useAdminOrders";
import type { OrderLineDiff } from "./diffOrderLines";
import { useOrderLines } from "./useOrderLines";
import type { OrderEditLine } from "./useOrderLines";

export type { OrderEditLine, OrderLineStatus } from "./useOrderLines";

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

const PHONE_DIGITS = /^\+?\d+$/;

// A customer-less order reaches the board with a placeholder instead of a phone: null from
// get_all_active_orders, "Failed to fetch number" from order history, "rabotyaga" from the
// WebSocket push. The backend treats any non-null tel as "this order has a customer" and answers
// 500 when it has none, so only a real number goes back.
function phoneOf(order: Order): string | null {
    const phone = order.phone_number?.trim() ?? "";
    return phone !== NO_CUSTOMER_PHONE && PHONE_DIGITS.test(phone) ? phone : null;
}

/**
 * The line state of the order-edit popup. The order's lines are snapshotted when the popup opens,
 * so a board refresh mid-edit (a status frame replacing the order object) never resets the edit.
 */
export function useOrderEdit(order: Order): UseOrderEditResult {
    const [original] = useState<CartItem[]>(() => hydrateOrderItemsForEdit(order.items));
    const {
        lines, items: editedItems, addItems, replaceLine, increment, decrement, removeLine,
        diff, hasChanges, totalQuantity, originalTotal, editedTotal,
    } = useOrderLines(original);
    const savingRef = useRef(false);
    const [phase, setPhase] = useState<OrderEditPhase>("editing");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [summary, setSummary] = useState<OrderEditSummaryData | null>(null);

    const completeBlocker: CompleteBlocker = editedItems.length === 0 ? "emptyOrder" : hasChanges ? null : "noChanges";

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
