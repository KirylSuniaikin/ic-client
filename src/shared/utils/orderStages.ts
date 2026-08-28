// The customer-facing progress ladder, shared by the homepage island pill
// (domains/customer-auth) and the order-status screen (domains/order-status) so the two can
// never disagree about how far along an order is — the same reason timeUtils.ts lives here.
//
// The ladder itself is NOT invented here. It mirrors the backend's OrderPushNotifier
// (DELIVERY_STEP_BY_STATUS / STEP_BY_STATUS), which is what the native notification bar already
// draws on the lock screen. A customer who glances at the shade and then opens the app has to
// see the same number of steps in the same order, so that map is the authority and this is its
// copy for the web.

/** The one order-type string that means "someone rides this to the customer". */
export const DELIVERY_ORDER_TYPE = "Delivery";

export type OrderStage = {
    /** The raw backend status string this node represents. */
    readonly key: string;
    /** Key into the `customerAuth` i18n namespace. */
    readonly labelKey: string;
};

/**
 * Pickup: Kitchen Phase -> Oven -> Ready (OrderPushNotifier.STEP_BY_STATUS).
 * "Picked Up" is terminal and the surfaces hide before it, so it is not a visible node.
 */
export const PICKUP_STAGES: ReadonlyArray<OrderStage> = [
    { key: "Kitchen Phase", labelKey: "island.stage.preparing" },
    { key: "Oven", labelKey: "island.stage.inOven" },
    { key: "Ready", labelKey: "island.stage.ready" },
];

/**
 * Delivery: the pickup three plus the ride (OrderPushNotifier.DELIVERY_STEP_BY_STATUS,
 * DELIVERY_MAX_STEP = 4). "Delivered" IS a visible node — it is the goal the track points at —
 * even though reaching it is exactly what makes the surfaces disappear.
 */
export const DELIVERY_STAGES: ReadonlyArray<OrderStage> = [
    { key: "Kitchen Phase", labelKey: "island.stage.preparing" },
    { key: "Oven", labelKey: "island.stage.inOven" },
    { key: "Ready", labelKey: "island.stage.ready" },
    { key: "Out for delivery", labelKey: "island.stage.outForDelivery" },
    { key: "Delivered", labelKey: "island.stage.delivered" },
];

/** The status the ride occupies — the only stage whose fill is measured in time, not in steps. */
export const OUT_FOR_DELIVERY_STATUS = "Out for delivery";

export function isDeliveryOrder(orderType: string | null | undefined): boolean {
    return orderType === DELIVERY_ORDER_TYPE;
}

export function stagesFor(orderType: string | null | undefined): ReadonlyArray<OrderStage> {
    return isDeliveryOrder(orderType) ? DELIVERY_STAGES : PICKUP_STAGES;
}

/** Unknown/early statuses (e.g. "initial-creation") fall back to the first stage. */
export function stageIndexIn(stages: ReadonlyArray<OrderStage>, status: string | null): number {
    const idx = stages.findIndex((s) => s.key === status);
    return idx < 0 ? 0 : idx;
}

/**
 * How much of the final "on the way" segment the bar is allowed to fill.
 *
 * The remaining sliver belongs to the courier actually arriving. An estimate that has run out
 * is not an arrival, so the bar must never be able to reach the "Delivered" node on a timer —
 * only a real Delivered status does that, and by then the surfaces have hidden themselves.
 */
export const MAX_RIDE_FILL = 0.95;

export type RideProgress = {
    /** 0..MAX_RIDE_FILL — the share of the final segment that is filled. */
    readonly fraction: number;
    /** Whole minutes until the estimated arrival, floored at 0 once it has passed. */
    readonly minutesLeft: number;
    /** The estimate has been passed and the ride is running long. */
    readonly overdue: boolean;
};

/**
 * The ride's fill, from elapsed time between the moment it started and the moment it is
 * expected to end.
 *
 * `msToArrival` is what usePreciseCountdown already produces for `estimatedDeliveredAt`
 * (`arrival - now`, unclamped and so negative once overdue), which is what makes this move on
 * its own without a second clock.
 *
 * Returns **null** rather than a number whenever the ride cannot be quantified — either
 * timestamp missing (no courier assigned yet, no coordinates on the branch or the address), or
 * a non-positive window. Null is the caller's cue to show motion without a quantity; it must
 * never be read as 0%, which would claim the courier has not left.
 *
 * Once the estimate is passed the fraction holds at MAX_RIDE_FILL and `overdue` goes true: the
 * bar stops rather than lying, and the caller says "arriving any moment" instead of a count.
 */
export function computeRideProgress(
    handoverMs: number | null,
    arrivalMs: number | null,
    msToArrival: number,
): RideProgress | null {
    if (handoverMs === null || arrivalMs === null) return null;

    const rideMs = arrivalMs - handoverMs;
    if (rideMs <= 0) return null;

    const elapsedMs = rideMs - msToArrival;
    const rawFraction = elapsedMs / rideMs;

    return {
        fraction: Math.min(Math.max(rawFraction, 0), 1) * MAX_RIDE_FILL,
        minutesLeft: Math.max(Math.ceil(msToArrival / 60_000), 0),
        overdue: rawFraction >= 1,
    };
}
