// Delivery endpoints staff call: the manager dispatcher (DELIVERY_SPEC.md §4) and the kitchen's
// own hand-over confirmation at the bottom of this file. Staff-authenticated, so these go through
// authFetch like the rest of shared/api/management.ts rather than the customer-token helpers.
import { BASE_URL, authFetch } from './client';
import { DeliveryApiError } from '../../domains/delivery/types';
import type {
    CourierBoardRow,
    CourierOrderSummary,
    CourierPeriodStats,
    CourierStats,
    DeliveryAssignmentAudit,
    DeliveryCard,
    ManualAssignResult,
    OrderRoute,
    UnassignedOrder,
} from '../../domains/management/couriers/types';

const BASE = `${BASE_URL}/management/delivery`;

/**
 * The dispatcher's roster.
 *
 * Off-shift riders are left out by default — the panel answers "who is working", and it used to
 * grow with the payroll instead of with the shift. `includeOffShift` asks the other question.
 */
export async function fetchCouriers(includeOffShift = false): Promise<CourierStats[]> {
    const query = includeOffShift ? '?includeOffShift=true' : '';
    const res = await authFetch(`${BASE}/couriers${query}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/** §2.3's queue: delivery orders still waiting for a courier. */
export async function fetchOrdersAwaitingCourier(): Promise<UnassignedOrder[]> {
    const res = await authFetch(`${BASE}/orders/awaiting-courier`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchCourierOrders(courierId: string): Promise<CourierOrderSummary[]> {
    const res = await authFetch(`${BASE}/couriers/${courierId}/orders`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/**
 * One rider's numbers over a window. `from`/`to` are inclusive Bahrain dates, `yyyy-MM-dd`.
 *
 * Named `from`/`to` and not the statistics page's `start_date`/`finish_date`: this is a
 * dispatcher endpoint, not part of that page's fetch shape. Both are optional server-side
 * (omitting them gives today), but the panel always sends them so the reading on screen and the
 * dates beside it can never disagree.
 */
export async function fetchCourierPeriodStats(
    courierId: string,
    from: string,
    to: string
): Promise<CourierPeriodStats> {
    const res = await authFetch(`${BASE}/couriers/${courierId}/stats?from=${from}&to=${to}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/**
 * Who assigned, unassigned, returned or cancelled this order, when, and from what state — the
 * timeline in the order dialog. 404 for an order that does not exist; a non-delivery order is a
 * 200 with no entries.
 */
export async function fetchOrderAssignmentAudit(orderId: number): Promise<DeliveryAssignmentAudit> {
    const res = await authFetch(`${BASE}/orders/${orderId}/audit`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/**
 * The photo the rider took at the door, for the one question it exists to answer: a customer says
 * the order never arrived and a manager needs to see where it was left.
 *
 * Returns the bytes, never a URL: the endpoint is MANAGER-gated and the JWT is attached by
 * authFetch, so a plain `<img src="/api/...">` would carry no credential and 401 — see
 * useAuthImageUrl.
 *
 * 404 is null, not an error. Retention sweeps the photo after seven days, so "gone" is the
 * NORMAL state for anything older than a week, and so is an order the rider never photographed.
 */
export async function fetchOrderProofPhoto(orderId: number): Promise<Blob | null> {
    const res = await authFetch(`${BASE}/orders/${orderId}/proof-photo`, { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.blob();
}

export async function fetchOrderRoute(orderId: number): Promise<OrderRoute> {
    const res = await authFetch(`${BASE}/orders/${orderId}/route`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/**
 * §2.3's escape hatch: assign a specific courier once the queue has been exhausted.
 *
 * Server-authoritative two-step (courier-capacity, task-spec.md §5): a first call with
 * `acknowledgeOverCapacity` omitted (defaulted to `false` here, not left to the server, so every
 * caller's intent is explicit on the wire) can come back `{ assigned: false, warning: {...} }`
 * without changing anything server-side. Re-sending the same request with
 * `acknowledgeOverCapacity: true` assigns exactly as it always has. `200 OK` now carries this body
 * instead of the old `204 No Content` — the parsed JSON is the caller's only way to see it.
 */
export async function manualAssign(
    orderId: number,
    courierId: string,
    acknowledgeOverCapacity?: boolean
): Promise<ManualAssignResult> {
    const res = await authFetch(`${BASE}/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId, acknowledgeOverCapacity: acknowledgeOverCapacity ?? false }),
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/**
 * Manager release/unassign (DELIVERY_SPEC.md H2/H7): takes the order off whoever holds it and
 * leaves it unassigned, with no re-offer. Idempotent server-side — an order nobody holds is a
 * no-op, not an error — which is what makes it safe to press on a stale row.
 */
export async function releaseOrder(orderId: number): Promise<void> {
    const res = await authFetch(`${BASE}/orders/${orderId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
}

/**
 * Manager cancel: stops a delivery without deleting the order or its history (DispatcherService
 * .cancel). Carries no money semantics at all — there is no refund code in this system, so the
 * customer is refunded by hand in the EazyPay console. 409 once the order has concluded.
 */
export async function cancelOrder(orderId: number): Promise<void> {
    const res = await authFetch(`${BASE}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
}

/**
 * The dispatcher board's card panel: every live delivery, already risk-ordered by the server
 * (most likely to be late first). `branchId` is a filter, not a lookup — an unknown branch yields
 * an empty list rather than a 404 — so passing null is the normal, board-wide case.
 */
export async function fetchDeliveryCards(branchId: string | null = null): Promise<DeliveryCard[]> {
    const query = branchId === null ? '' : `?branchId=${encodeURIComponent(branchId)}`;
    const res = await authFetch(`${BASE}/board/cards${query}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/**
 * The board's second panel. `orderId` is what links the two: with a card selected every row
 * carries the engine's own verdict for that order (rank, score, freeAt, why no offer was made);
 * without one it is a plain availability roster.
 *
 * A lookup, not a filter, unlike the cards — an unknown orderId 404s, because a table that
 * silently dropped the annotation would look answered when it is not.
 */
export async function fetchBoardCouriers(orderId: number | null = null): Promise<CourierBoardRow[]> {
    const query = orderId === null ? '' : `?orderId=${orderId}`;
    const res = await authFetch(`${BASE}/board/couriers${query}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/**
 * The kitchen tablet's confirmation that a delivery order was physically handed to the rider —
 * the transition the courier app used to own, until a rider tapping by accident started taking
 * live orders off the kitchen board. The courier's own button is disabled server-side now.
 *
 * Not under `BASE`: `/api/management/**` is MANAGER-and-up, and the person handing the food over
 * is a COOK, who would get a 403. `/api/kitchen/**` is gated to non-courier staff instead, which
 * is the whole point of the endpoint living on its own prefix.
 *
 * `204` on success and on a double tap (the server is idempotent), `404` for an unknown order,
 * and `409` when no courier is assigned yet — a real, expected state rather than a fault, since a
 * rider can be released or reassigned between the board being drawn and the button being pressed.
 * Thrown as {@link DeliveryApiError} rather than the module's plain `Error` precisely so the
 * caller can tell that one status apart and say so in words; the message keeps this module's
 * `Response: ${status}` shape.
 */
export async function markHandedOverToCourier(orderId: number): Promise<void> {
    const res = await authFetch(`${BASE_URL}/kitchen/delivery/orders/${orderId}/handed-over`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new DeliveryApiError(`Response: ${res.status}`, res.status);
}

// ---------------------------------------------------------------------------------------
// Courier-capacity Phase 5 (task-spec.md §6.3): part-primary siblings of the order-keyed
// functions above, for a genuinely split order. `manualAssign`, `releaseOrder`,
// `fetchOrderProofPhoto`, `markHandedOverToCourier` are UNCHANGED — every non-split call path
// keeps using them exactly as today.
// ---------------------------------------------------------------------------------------

/** Part-primary sibling of {@link manualAssign} — same body/response shape, scoped to one part. */
export async function manualAssignPart(
    partId: number,
    courierId: string,
    acknowledgeOverCapacity?: boolean
): Promise<ManualAssignResult> {
    const res = await authFetch(`${BASE}/parts/${partId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId, acknowledgeOverCapacity: acknowledgeOverCapacity ?? false }),
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

/** Part-primary sibling of {@link releaseOrder}. */
export async function releasePart(partId: number): Promise<void> {
    const res = await authFetch(`${BASE}/parts/${partId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
}

/** Part-primary sibling of {@link fetchOrderProofPhoto} — same 404-is-null contract. */
export async function fetchPartProofPhoto(partId: number): Promise<Blob | null> {
    const res = await authFetch(`${BASE}/parts/${partId}/proof-photo`, { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.blob();
}

/** Part-primary sibling of {@link markHandedOverToCourier} — same {@link DeliveryApiError} contract. */
export async function markPartHandedOverToCourier(partId: number, courierName?: string): Promise<void> {
    const res = await authFetch(`${BASE_URL}/kitchen/delivery/parts/${partId}/handed-over`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The name is the rider the kitchen tapped; the backend refuses it if the part was
        // reassigned meanwhile. Omitted entirely for a single-part order or an unnamed part.
        ...(courierName ? { body: JSON.stringify({ courierName }) } : {}),
    });
    if (!res.ok) throw new DeliveryApiError(`Response: ${res.status}`, res.status);
}
