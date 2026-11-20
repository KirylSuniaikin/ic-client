import type { CartItem } from "../../menu/types";
import type { EditOrderRequest, OrderItemRequest } from "../types";

// Extracted verbatim from useCheckout.ts's `handleCheckout` order-object literal (the `items:`
// map and `amount_paid:` reduce) so kiosk and non-kiosk checkout share one money/item-mapping
// path. The admin edit-order payload (buildEditOrderRequest below) reuses the same two helpers.

export function buildOrderItems(items: CartItem[]): OrderItemRequest[] {
    return items.map(item => ({
        id: item.id, name: item.name, quantity: item.quantity,
        amount: parseFloat(String(item.amount)), size: item.size || "",
        category: item.category, description: item.description || "",
        note: item.note ?? "",
        isGarlicCrust: !!item.isGarlicCrust, isThinDough: !!item.isThinDough,
        discountAmount: item.discountAmount ?? 0,
        customizations: item.customizations ?? [],
        comboItems: (item.comboItems || []).map(ci => ({
            id: ci.id, name: ci.name, category: ci.category, size: ci.size || "",
            quantity: ci.quantity || 1, isGarlicCrust: !!ci.isGarlicCrust,
            isThinDough: !!ci.isThinDough, description: ci.description || "",
            note: ci.note ?? "",
            customizations: ci.customizations ?? []
        }))
    }));
}

export function computeAmountPaid(items: CartItem[]): number {
    return parseFloat(items.reduce((acc, item) => {
        return acc + item.amount * (1 - (item.discountAmount ?? 0) / 100) * item.quantity;
    }, 0).toFixed(3));
}

/** The fields of the order being edited that the edit request carries through unchanged. */
export interface EditedOrderIdentity {
    id: string | number;
    order_no: number;
    address: unknown;
}

/** Who and how the edited order is filed — the AdminOrderDetailsPopUp fields in the route flow. */
export interface EditOrderDetails {
    tel: string | null;
    customerName: string | null;
    deliveryMethod: string | null;
    paymentType: string | null;
    notes: string;
}

/**
 * The PUT /api/edit_order body. Shared by the route-based edit mode (useCheckout) and the
 * order-board edit popup so both send exactly the same shape.
 */
export function buildEditOrderRequest(
    order: EditedOrderIdentity,
    details: EditOrderDetails,
    items: CartItem[],
): EditOrderRequest {
    return {
        id: order.id,
        order_no: order.order_no,
        tel: details.tel,
        customer_name: details.customerName,
        delivery_method: details.deliveryMethod,
        payment_type: details.paymentType,
        address: order.address,
        notes: details.notes,
        items: buildOrderItems(items),
        amount_paid: computeAmountPaid(items),
    };
}
