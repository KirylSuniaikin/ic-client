// Dispatcher panel types (DELIVERY_SPEC.md §4). Mirrors the backend DTOs in
// backend/.../domain/delivery/dto — keep the two in step.

export type CourierStats = {
    courierId: string;
    name: string | null;
    status: string;
    // Where the rider is, not what they are assigned to: couriers stopped belonging to a branch
    // on 2026-08-20, so the server derives the nearest kitchen from their last GPS fix. Null when
    // that fix is missing or too stale to trust — which is a real state, not a loading gap.
    nearestBranchId: string | null;
    nearestBranchName: string | null;
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

/**
 * Mirrors backend `DeliveryCardTO`. One live delivery on the dispatcher board's card panel.
 *
 * Deliberately carries no item list: the board answers "which delivery is about to be late and
 * who do I phone about it", not "what is in the box". The order board already answers the latter.
 *
 * Every timestamp below is a naive Bahrain-local `LocalDateTime` string with no zone — parse it
 * through `toEpochMsBahrain`, never `new Date(s)`, which would read it as UTC and land three
 * hours out.
 */
export type DeliveryCard = {
    orderId: number;
    orderNo: number | null;
    status: string;
    branchId: string | null;
    branchName: string | null;
    addressLine: string | null;
    /** PII. Null when the order has no customer. Never `""` — see DeliveryCardTO. */
    customerPhone: string | null;
    /** PII. Null when unassigned or unset. Never `""`. */
    courierPhone: string | null;
    /** Null on purpose: an order can be live before the kitchen has fixed a ready time. */
    readyAt: string | null;
    estimatedHandoverAt: string | null;
    estimatedDeliveredAt: string | null;
    /**
     * `estimatedDeliveredAt − readyAt`, in minutes — how late this order is heading. Null, never
     * zero, whenever it cannot be computed. The server has already sorted the list on it, most at
     * risk first, so the board renders cards in the order they arrive and never re-sorts them.
     */
    riskMinutes: number | null;
};

/**
 * Mirrors backend `NoOfferReason`. Why a courier did not get the selected order's offer.
 *
 * Produced by the assignment engine itself (`CourierScoringService.checkEligibility` plus the
 * refusal rows), never recomputed here: a reason that disagreed with the engine would be worse
 * than no reason at all, because the manager would act on it.
 */
export type NoOfferReason =
    | 'DECLINED'
    | 'NO_ANSWER'
    | 'OFFLINE'
    | 'BLACKLISTED'
    | 'PINGING_OTHER_ORDER'
    | 'NO_RESOLVABLE_FREE_AT'
    | 'POSITION_STALE'
    | 'TOO_FAR'
    | 'BUSY_UNTIL';

/**
 * Mirrors backend `CourierBoardRowTO`. One courier on the board's second panel, annotated for the
 * card the manager has selected (unannotated when none is).
 */
export type CourierBoardRow = {
    courierId: string;
    name: string | null;
    /**
     * May be null — riders predate the column. Render it as genuinely absent rather than as an
     * empty string, so "not filled in" stays distinguishable from "filled in as blank".
     */
    phone: string | null;
    status: string;
    /** When this courier frees up. Null when the engine could not resolve one, or no card is selected. */
    freeAt: string | null;
    /**
     * Zero-based ordinal within the eligible set for the selected order; null when not eligible.
     * Deliberately NOT `courier_queue.position`, which is a sparse key (`min-1` / `max+1`) that
     * drifts unboundedly and may be huge or negative — a sort key, never a magnitude.
     */
    rank: number | null;
    /** The engine's own `distanceToKitchenKm + rank * queueFairnessKm`. Null when not ranked. */
    score: number | null;
    /** Null exactly when this courier IS eligible for the selected order (or none is selected). */
    noOfferReason: NoOfferReason | null;
    /** Offers actively refused — a different problem from `missedCount`, so never summed with it. */
    declinedCount: number;
    /** Offers that lapsed with no answer: possibly a dead phone rather than a choice. */
    missedCount: number;
    ordersInHand: number;
    onShiftSince: string | null;
    /** Null when the courier has no GPS fix at all — which means nowhere, never "near everything". */
    positionFixedAt: string | null;
    /** The server's own cutoff: a fix older than this is stale and must not read as a position. */
    positionStaleAfterMinutes: number;
};
