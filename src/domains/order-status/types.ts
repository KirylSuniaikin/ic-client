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

// Mirrors the Phase 1a backend contract exactly:
// GET /api/customer/orders/{orderId}/courier-location → { couriers: TrackedCourier[] }
// (runs/1a/task-spec.md §5, already committed and frozen — this type is the frontend's mirror).
export type TrackedCourier = {
    name: string;
    latitude: number;
    longitude: number;
    positionAgeSeconds: number;
    /** Always 1 in this phase; kept for shape parity with Phase 6b's 0..N extension. */
    partIndex: number;
};

export type OrderTrackingResponse = {
    couriers: TrackedCourier[]; // length 0 or 1 in this phase
};
