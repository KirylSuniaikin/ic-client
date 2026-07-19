import type { TFunction } from "i18next";

// Shared by CustomerOrderDetailPopup (header chip + timeline) and CustomerProfilePopup
// (order-card chip) — lifted out of CustomerOrderDetailPopup.tsx so both can import it without
// a circular dependency (CustomerOrderDetailPopup already imports `statusStyle` FROM
// CustomerProfilePopup). Keys resolve against the `customerAuth` namespace's
// `orderDetail.status.*` tree.
//
// Covers every literal value the backend ever writes to `Order.status` / `order_status_history`
// (see backend `OrderStatus` enum's `label()` values) — the website/Keeta/Jahez creation paths
// only ever set "Kitchen Phase", but a customer's order history can include externally-sourced
// orders that passed through other transitions (e.g. a Jahez order briefly "Accepted" before
// acceptance flips it to "Kitchen Phase"), so every enum label is mapped defensively.
export const STATUS_LABEL_KEYS: Record<string, string> = {
    "initial-creation": "orderDetail.status.orderPlaced",
    "Kitchen Phase": "orderDetail.status.inProgress",
    "Oven": "orderDetail.status.inOven",
    "Ready": "orderDetail.status.readyForPickup",
    "Picked Up": "orderDetail.status.pickedUp",
    "Pending": "orderDetail.status.pending",
    "Accepted": "orderDetail.status.accepted",
    "Rejected": "orderDetail.status.rejected",
    "New": "orderDetail.status.new",
    "Out for delivery": "orderDetail.status.outForDelivery",
    "Delivered": "orderDetail.status.delivered",
    "Cancelled": "orderDetail.status.cancelled",
    "Timed out": "orderDetail.status.timedOut",
};

export function getStatusLabel(status: string, t: TFunction): string {
    const key = STATUS_LABEL_KEYS[status];
    return key ? t(key) : status;
}
