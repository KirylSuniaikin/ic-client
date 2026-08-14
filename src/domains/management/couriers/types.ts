// Dispatcher panel types (DELIVERY_SPEC.md §4). Mirrors the backend DTOs in
// backend/.../domain/delivery/dto — keep the two in step.

export type CourierStats = {
    courierId: string;
    name: string | null;
    status: string;
    currentBranchId: string | null;
    currentBranchName: string | null;
    accepted: number;
    // Actively refused, as opposed to `missed` (never answered). Counted apart because a rider
    // who declines is making a choice and one who goes silent may have a dead phone.
    declined: number;
    missed: number;
    delivered: number;
};

export type CourierOrderSummary = {
    orderId: number;
    orderNo: number | null;
    status: string;
    deliveredAt: string | null;
    // §8 metrics, in minutes. Null when the underlying timestamps were never recorded.
    waitTimeMinutes: number | null;
    travelTimeMinutes: number | null;
    geofenceWarning: boolean | null;
    geofenceDistanceM: number | null;
};

export type CourierRoutePoint = {
    latitude: number;
    longitude: number;
    recordedAt: string | null;
};

export type OrderRoute = {
    orderId: number;
    orderNo: number | null;
    waitTimeMinutes: number | null;
    travelTimeMinutes: number | null;
    // Null, never zero, when it cannot be derived — see DispatcherService for why.
    serviceTimeMinutes: number | null;
    geofenceWarning: boolean | null;
    geofenceDistanceM: number | null;
    destination: CourierRoutePoint | null;
    points: CourierRoutePoint[];
};

/**
 * Mirrors backend `UnassignedOrderTO`. §2.3 keeps an order nobody accepted alive — it is not
 * cancelled and does not fall back to Keeta, because the customer has already paid — so this is
 * the dispatcher's work queue and the only place a manual assignment starts from.
 */
export type UnassignedOrder = {
    orderId: number;
    orderNo: number | null;
    status: string;
    branchId: string | null;
    branchName: string | null;
    addressLine: string | null;
    /** How long it has been unclaimed. The list is oldest first for this reason. */
    waitingMinutes: number;
};
