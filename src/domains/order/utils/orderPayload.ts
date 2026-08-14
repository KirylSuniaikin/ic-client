import type { CartItem } from "../../menu/types";
import type { OrderItemRequest } from "../types";

// Extracted verbatim from useCheckout.ts's `handleCheckout` order-object literal (the `items:`
// map and `amount_paid:` reduce) so kiosk and non-kiosk checkout share one money/item-mapping
// path. Not yet wired into useCheckout.ts — that happens in Phase 7. Do not touch the
// structurally-similar map+reduce inside `buildOrderTO` (used by the admin edit-order path,
// EditOrderRequest) — that is a different request type and out of scope here.

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
