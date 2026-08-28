// Delivery domain types (DELIVERY_SPEC.md §1.4, §1.2). Mirrors the backend DTOs in
// backend/.../domain/delivery/dto — keep the two in step; a silent field rename here surfaces
// as an undefined at render time, not as a type error.

/** Mirrors backend `CustomerAddressTO`. */
export type CustomerAddress = {
    id: string;
    label: string | null;
    block: string | null;
    road: string | null;
    building: string | null;
    flat: string | null;
    note: string | null;
    // The confirmed pin. Source of truth for routing, the radius check and the ETA — the text
    // fields above are what the courier actually reads (§1.4).
    latitude: number;
    longitude: number;
};

/** Mirrors backend `CreateCustomerAddressTO`. No owner field: the server takes it from the token. */
export type CreateCustomerAddressRequest = {
    label?: string | null;
    block?: string | null;
    road?: string | null;
    building?: string | null;
    flat?: string | null;
    note?: string | null;
    latitude: number;
    longitude: number;
};

/**
 * Mirrors backend `UpdateCustomerAddressTO` — the body of `PATCH /customer/addresses/{id}`.
 *
 * Text only, and deliberately so: `latitude`/`longitude` are absent because the pin drives
 * nearest-branch routing, the radius check and the ETA, and a saved address is referenced by
 * orders that may already be out for delivery. Moving it would retarget a live run and could turn
 * an in-range address out of range after the availability gate has passed. Moving a pin is "add a
 * new address" instead — which re-runs the gate.
 *
 * Every field is sent on every edit (the form has them all), so `null` clears the column rather
 * than meaning "unchanged".
 */
export type UpdateCustomerAddressRequest = {
    label: string | null;
    block: string | null;
    road: string | null;
    building: string | null;
    flat: string | null;
    note: string | null;
};

/**
 * Why delivery is unavailable (mirrors backend `DeliveryAvailabilityTO.Reason`). The copy differs
 * per reason: `OUTSIDE_RADIUS` is a permanent "not here", `NO_COURIER` is "not right now".
 */
export type DeliveryUnavailableReason = 'NO_BRANCH' | 'OUTSIDE_RADIUS' | 'NO_COURIER';

/**
 * Mirrors backend `DeliveryAvailabilityTO`. A refusal is a 200 with a reason, never an HTTP
 * error — the client renders the Keeta fallback from it (§1.2).
 */
export type DeliveryAvailability = {
    available: boolean;
    reason: DeliveryUnavailableReason | null;
    branchId: string | null;
    // Null whenever the estimate cannot be computed honestly; §1.5 requires a fallback string
    // for exactly that case, so never render these without a null check.
    etaMinutesMin: number | null;
    etaMinutesMax: number | null;
};

/** A pin, before it has been saved as an address. */
export type Coordinates = {
    latitude: number;
    longitude: number;
};

/** Typed error for non-2xx delivery responses, matching CustomerAuthApiError's shape. */
export class DeliveryApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'DeliveryApiError';
        this.status = status;
    }
}

/**
 * Composes the courier-facing address line from the Bahrain parts. Bahrain addressing is
 * Block / Road / Building / Flat rather than a street line, and Google's reverse-geocode is
 * unreliable at building level here (§1.4), so the parts are shown rather than a formatted
 * string from the API.
 */
export function formatAddressLine(address: CustomerAddress): string {
    const parts: string[] = [];
    if (address.block) parts.push(`Block ${address.block}`);
    if (address.road) parts.push(`Road ${address.road}`);
    if (address.building) parts.push(`Building ${address.building}`);
    if (address.flat) parts.push(`Flat ${address.flat}`);
    return parts.join(', ');
}

/** What EazyPay's hosted page exposes (§1.5 block 4). Values match the backend's enum. */
export type DeliveryPaymentMethod = 'CARD' | 'APPLE_PAY' | 'BENEFIT';

/**
 * Mirrors the backend `DeliveryPaymentResultTO`. The order exists when this comes back, but it is
 * NOT paid for: on a 201 `status` is always `"Pending Payment"`, and only the provider settling
 * the hosted session moves it into the kitchen flow.
 *
 * This type used to claim `{ orderId, 'PAID' | 'FAILED', stub }`, which described the pre-delivery
 * endpoint and no longer matched anything the server sends. Nothing caught it because the response
 * is never validated — it is `res.json()` straight into this shape.
 */
export type DeliveryPaymentResult = {
    /** The customer-facing order number — never `orders.id` (W4 requirement 5/6). */
    orderNo: number;
    /**
     * The order's real status at the time of the response. Always `"Pending Payment"` on a 201;
     * kept as a field rather than assumed, so a future status change is visible in the contract.
     */
    status: string;
    /** Where the customer must be sent to actually pay. Ignoring it leaves the order unpaid. */
    redirectUrl: string;
    /**
     * True while the provider is stubbed — the URL leads nowhere and the server auto-approves the
     * order instead, so the UI says so rather than implying a real charge.
     */
    stub: boolean;
};
