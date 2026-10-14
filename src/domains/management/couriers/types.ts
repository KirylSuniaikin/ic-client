// Dispatcher panel types (DELIVERY_SPEC.md §4). Mirrors the backend DTOs in
// backend/.../domain/delivery/dto — keep the two in step.
import type { CourierProductivitySingle } from "../statistics/types";

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
    /**
     * True when the rider was refused for the geofence breach and pushed past it anyway. Only
     * readable NEXT TO `geofenceWarning`, never instead of it: a warning on its own can be GPS
     * drift, a warning the rider had to override by hand is a rider making a claim.
     */
    geofenceOverridden: boolean | null;
    // Courier-capacity Phase 5: always populated — 1/1 for a non-split order's part 1.
    partId: number;
    partIndex: number;
    partsTotal: number;
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
    /** See CourierOrderSummary — the pair is only readable together. */
    geofenceOverridden: boolean | null;
    destination: CourierRoutePoint | null;
    /**
     * Where the rider actually was when the kitchen handed the order over: the sample closest in
     * time to `inTransitAt`. Picked by the server, not by the map, so the marker cannot mean one
     * thing here and another anywhere else the route is drawn. Null when the order was never
     * handed over, or when no sample was recorded against it.
     */
    pickup: CourierRoutePoint | null;
    points: CourierRoutePoint[];
};

/**
 * Mirrors backend `CourierPeriodStatsTO`. One rider's numbers over a chosen window — the panel
 * behind the roster row, and the home of the declined/missed counters that used to sit on the
 * card itself.
 *
 * They moved because lifetime counters answered nothing: "taken" and "done" are equal by
 * construction whenever every accepted order is delivered, and a lifetime refusal count says
 * nothing about last week. Every number here is bounded by `from`/`to`, which is what makes any
 * of them a fact a manager can act on.
 */
export type CourierPeriodStats = {
    courierId: string;
    /** Inclusive Bahrain dates, `yyyy-MM-dd`, echoed back by the server. */
    from: string;
    to: string;
    /**
     * Mean `deliveredAt − inTransitAt` — the drive itself, not the wait at the pass. Null, never
     * zero, when it cannot be derived: zero would read as "instant".
     */
    averageDeliveryMinutes: number | null;
    deliveredCount: number;
    /** What the rider carried, not what they earned — there is no commission model here. */
    deliveredTotal: number;
    /**
     * Summed over the calendar month containing `from`, NOT over the window: the window defaults
     * to today, and "hours worked today" is not the number anyone means by a rider's workload.
     */
    hoursWorkedThisMonth: number;
    /** Actively refused — a choice. Never summed with `missed`. */
    declined: number;
    /** Lapsed with no answer, which may be a dead phone rather than a decision. */
    missed: number;
    /**
     * Distance and on-shift time split for the same window. Optional because a backend deployed
     * before it existed does not send it, and the panel must still render the rest.
     */
    productivity?: CourierProductivitySingle;
};

/**
 * The part of an order every dispatcher dialog needs: which order it is and where it is going.
 *
 * Both {@link UnassignedOrder} and {@link DeliveryCard} satisfy it structurally, which is what
 * lets ONE dialog serve the two places a manager opens an order from — the waiting-for-a-courier
 * queue and the live-deliveries board — instead of a second dialog that would drift from the
 * first. It is deliberately not a base the other two extend: they mirror two different backend
 * DTOs, and pretending one is a subtype of the other would invite fields to migrate between them.
 */
export type DispatchableOrder = {
    orderId: number;
    orderNo: number | null;
    branchName: string | null;
    addressLine: string | null;
    // Courier-capacity Phase 5: optional so a caller with no part concept (a plain DeliveryCard
    // opened non-split) still satisfies this type structurally. Present and > 1 on partsTotal
    // means this specific target IS one part of a genuinely split order.
    partId?: number;
    partIndex?: number;
    partsTotal?: number;
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
    /** Any size counts as 1; drinks/sides carry no dough type and are excluded by construction. */
    pizzaCount: number;
    /** `Math.ceil(pizzaCount / capacity)` — the same definition the backend uses everywhere. */
    couriersNeeded: number;
    /** `pizzaCount > capacity` — one rider cannot physically carry this order. */
    oversized: boolean;
    // Courier-capacity Phase 5: always populated — 1/1 for a non-split order's part 1. One row
    // per still-unassigned PART, so a genuinely split order can have several rows here.
    partId: number;
    partIndex: number;
    partsTotal: number;
};

/**
 * Mirrors backend `OverCapacityWarningTO`. The manual-assign endpoint's non-blocking warning: a
 * manager can always push past it, but the four numbers are what they are deciding against.
 */
export type OverCapacityWarning = {
    riderPizzas: number;
    orderPizzas: number;
    totalPizzas: number;
    capacity: number;
};

/**
 * Mirrors backend `ManualAssignResultTO`. The manual-assign endpoint's server-authoritative
 * two-step: `assigned: false` means nothing changed and `warning` is what to show before the
 * caller re-sends with `acknowledgeOverCapacity: true`.
 */
export type ManualAssignResult = {
    assigned: boolean;
    warning: OverCapacityWarning | null;
};

/**
 * Mirrors backend `DeliveryCardTO`. One live delivery on the dispatcher board's card panel.
 *
 * It carries the order's items and the customer's name because the card is opened, not just read.
 * A dispatcher opens one because they are about to ring somebody — a customer whose food is late,
 * or the rider holding it — and both conversations start with which order this is. Sending it with
 * the card rather than fetching it on open keeps the popup instant and costs one extra query for
 * the whole board.
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
    /** PII. Null when the order has no customer, or no name was taken. */
    customerName: string | null;
    /** PII. Null when the order has no customer. Never `""` — see DeliveryCardTO. */
    customerPhone: string | null;
    /** PII. Null when unassigned or unset. Never `""`. */
    courierPhone: string | null;
    /** Null on purpose: an order can be live before the kitchen has fixed a ready time. */
    readyAt: string | null;
    estimatedHandoverAt: string | null;
    estimatedDeliveredAt: string | null;
    /**
     * The outer edge of the window quoted at checkout — `createdAt + estimation +
     * quotedDriveMinutes + etaSpread`. The moment this order becomes a problem, and what the
     * card's countdown runs to.
     *
     * Fixed, not recomputed: every part is stored at creation, so it does not move while the order
     * is in flight. `estimatedDeliveredAt` above is the opposite by design — re-derived from the
     * rider's live position — which makes it a forecast rather than a promise, and a countdown to
     * a moving target is not a countdown.
     *
     * Null for every order predating the road quote, which can never be backfilled.
     */
    promisedAt: string | null;
    /** The whole promised journey in minutes — the scale the countdown ring is drawn against. */
    promisedTotalMinutes: number | null;
    /**
     * `estimatedDeliveredAt − readyAt`, in minutes — how late this order is heading. Null, never
     * zero, whenever it cannot be computed. The server has already sorted the list on it, most at
     * risk first, so the board renders cards in the order they arrive and never re-sorts them.
     */
    riskMinutes: number | null;
    /**
     * The window `riskMinutes` is meant to stay inside — the backend's
     * `delivery.freshness.max-minutes-after-ready`, sent with the figure because this client
     * cannot derive it: `deliveryRadiusKm` is that budget times the average speed after two
     * clamps, and does not invert. Nullable so a payload from before the field still parses.
     */
    freshnessBudgetMinutes: number | null;
    /**
     * Name and quantity only — enough to confirm which order is being discussed on a phone call.
     * Sizes, dough and per-item notes deliberately stay on the kitchen card: repeating the
     * customisation grammar here would mean a second rendering of it that could disagree.
     *
     * Empty rather than null for an order with no items, so the popup can say "no items on file"
     * instead of quietly dropping the section.
     */
    items: DeliveryCardItem[];
    // Courier-capacity Phase 5: null/1 for a non-split order. `courierPhone` above is kept =
    // part 1's for backward compatibility; a client rendering `parts` ignores it.
    partsTotal?: number;
    parts?: DeliveryCardPart[];
};

/** One line of {@link DeliveryCard.items}; mirrors backend `DeliveryCardItemTO`. */
export type DeliveryCardItem = {
    name: string | null;
    quantity: number | null;
};

/** Mirrors backend `DeliveryCardTO.DeliveryCardPartTO`. One row per part of a split order. */
export type DeliveryCardPart = {
    partId: number;
    partIndex: number;
    courierPhone: string | null;
    assigned: boolean;
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

// ---------------------------------------------------------------------------
// Assignment audit trail (M6) — mirrors backend DeliveryAssignmentAuditTO
// (GET /api/management/delivery/orders/{orderId}/audit).
//
// There is no atomic reassign on the server: a reassignment is an UNASSIGNED followed by an
// ASSIGNED on the same part, and the timeline labels the pair.
// ---------------------------------------------------------------------------

export type AssignmentAuditAction = "ASSIGNED" | "UNASSIGNED" | "RETURNED_UNDELIVERED" | "CANCELLED";

export type AssignmentAuditCause =
    | "OFFER_ACCEPTED"
    | "PRE_ASSIGNMENT_ACCEPTED"
    | "AUTO_ACCEPTED"
    | "MANUAL_ASSIGN"
    | "MANUAL_RELEASE"
    | "RESERVATION_DROPPED_AT_READY"
    | "ORDER_CANCELLED"
    | "RETURNED_BY_COURIER"
    | "MANUAL_CANCEL";

/** SYSTEM is the assignment engine or a timeout acting on its own. */
export type AuditActorType = "STAFF" | "COURIER" | "SYSTEM";

/** Where the part stood just before the change. */
export type DeliveryPartStage =
    | "AWAITING_COURIER"
    | "GOING_TO_KITCHEN"
    | "AT_KITCHEN"
    | "ON_THE_ROAD"
    | "DELIVERED";

export type DeliveryAssignmentAuditEntry = {
    id: number;
    occurredAt: string;
    action: AssignmentAuditAction;
    cause: AssignmentAuditCause;
    actorType: AuditActorType;
    /** Null for SYSTEM. */
    actorStaffId: number | null;
    /** Null for SYSTEM, or when the staff row no longer exists. */
    actorName: string | null;
    /** The rider gaining or losing the part. */
    courierId: string | null;
    courierName: string | null;
    /** All three null on a CANCELLED entry, which is about the whole order. */
    partId: number | null;
    partIndex: number | null;
    partsTotal: number | null;
    fromOrderStatus: string | null;
    fromStage: DeliveryPartStage | null;
};

export type DeliveryAssignmentAudit = {
    orderId: number;
    orderCreatedAt: string | null;
    /** Recording began here; an order placed before it has an incomplete history. */
    dataSince: string;
    /** Oldest first. */
    entries: DeliveryAssignmentAuditEntry[];
};
