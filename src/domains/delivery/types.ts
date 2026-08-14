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

export type DeliveryPaymentResult = {
    orderId: string;
    status: 'PAID' | 'FAILED';
    /** True while the provider is stubbed — the UI says so rather than implying a real charge. */
    stub: boolean;
};
