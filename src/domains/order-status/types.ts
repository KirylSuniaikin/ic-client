export type OrderStatusData = {
    id: number;
    orderStatus: string;
    orderNumber: number;
    orderCreated: string;
    estimationTime: number;
    error?: boolean;
    message?: string;
    branchId: string;
    /**
     * "Delivery" or the pickup type. The screen cannot tell the two apart from the status alone
     * at "Ready" — and that is exactly where the copy has to switch from "come and collect" to
     * "waiting for a courier" — so the backend sends it explicitly.
     */
    orderType: string;
    /**
     * Delivery only, and OMITTED (not null) on a pickup order — `@JsonInclude(NON_NULL)` on the
     * backend keeps a pickup payload byte-for-byte what it was. Absent means "not knowable yet"
     * (no courier assigned, or a branch/address without coordinates), never "now".
     *
     * Naive Bahrain-local timestamps: parse with formatBahrainClock / toEpochMsBahrain, never
     * `new Date(s)` — that reads them as UTC and lands three hours out.
     */
    handoverAt?: string;
    estimatedDeliveredAt?: string;
};

// Mirrors the Phase 6a backend contract exactly:
// GET /api/customer/orders/{orderId}/courier-location → { couriers: TrackedCourier[], parts?: TrackedPart[] }
// (runs/6a/task-spec.md §5, already committed and frozen — this type is the frontend's mirror).
export type TrackedCourier = {
    name: string;
    latitude: number;
    longitude: number;
    positionAgeSeconds: number;
    /** One entry per currently-out-for-delivery part, ordered ascending; length 0..N since Phase 6a. */
    partIndex: number;
    /**
     * Course over ground, degrees clockwise from north in [0, 360) — what the moped is turned to.
     * Null when the backend cannot tell (the rider is standing still, or the fix is stale); the
     * map then keeps the heading it last showed rather than snapping the moped back to north.
     */
    bearingDegrees: number | null;
    /**
     * Whole seconds until this part is expected at the door, never below 0 — the same forecast
     * the active-order pill shows, run for this part's own rider. A duration measured on the
     * server's clock, never a timestamp, because the phone's clock cannot be trusted to subtract
     * from. Null when there is nothing to forecast from (e.g. the order has no saved pin).
     */
    etaSeconds: number | null;
};

/** The order's drop-off pin: on the customer's own order, their own saved address. */
export type TrackingDestination = {
    latitude: number;
    longitude: number;
};

/**
 * One part's coarse progress. Present only when the order's parts have partsTotal > 1 — see
 * OrderTrackingResponse.parts. Deliberately two states only ("on the way" / "delivered"); a part
 * with a courier assigned but not yet departed reports delivered: false, indistinguishable from a
 * genuinely out-for-delivery, undelivered part (backend Requirement 5, runs/6a/task-spec.md §4).
 */
export type TrackedPart = {
    partIndex: number;
    partsTotal: number;
    delivered: boolean;
};

export type OrderTrackingResponse = {
    couriers: TrackedCourier[]; // 0..N since Phase 6a
    /** Absent for a single-part order; never present with length <= 1. */
    parts?: TrackedPart[];
    /**
     * Always serialised, null included (unlike `parts`). Null when the order has no saved pin,
     * and whenever a tracking gate closes the response. Present even while `couriers` is empty.
     */
    destination: TrackingDestination | null;
};
