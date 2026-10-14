// Delivery endpoints (DELIVERY_SPEC.md §1.2, §1.4). Follows shared/api/customerAuth.ts's
// shape: explicit token argument, typed error on non-2xx, no interceptor magic.
import { BASE_URL } from './client';
import { applyClientPlatform } from './clientPlatform';
import { DEMAND_SESSION_HEADER, getDemandSessionId } from './demandSession';
import { logger } from '../utils/logger';
import { DeliveryApiError } from '../../domains/delivery/types';
import type {
    CreateCustomerAddressRequest,
    CustomerAddress,
    DeliveryAvailability,
    DeliveryBasketLine,
    DeliveryPaymentMethod,
    DeliveryPaymentResult,
    KeetaFallbackEvent,
    UpdateCustomerAddressRequest,
} from '../../domains/delivery/types';

function isMessageBody(data: unknown): data is { message: string } {
    if (typeof data !== 'object' || data === null) return false;
    return typeof (data as { message?: unknown }).message === 'string';
}

/**
 * Headers for the two calls that feed the lost-demand figures: the platform, so a refusal can be
 * split by web / app / kiosk, and the anonymous session token, so one customer retrying the same
 * address is counted once. Never an Authorization header — both calls are made by guests.
 */
function demandHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init);
    applyClientPlatform(headers);
    headers.set(DEMAND_SESSION_HEADER, getDemandSessionId());
    return headers;
}

async function extractErrorMessage(response: Response): Promise<string> {
    try {
        const data: unknown = await response.json();
        if (isMessageBody(data)) {
            return data.message;
        }
    } catch {
        // body wasn't JSON (or was empty) — fall through to the generic message
    }
    return `Request failed with status ${response.status}`;
}

/**
 * The §1.2 availability gate. Unauthenticated by design — the cart calls it the moment Delivery
 * is picked, which for a guest is before the OTP step, so no token exists yet.
 *
 * Pass a pin once one exists (the Place-order pass); omit it for the early cart pass, which then
 * only asks whether any branch can deliver at all. Supplying one coordinate without the other is
 * a client bug and the server rejects it.
 *
 * Pass the basket so the server can also ask whether enough couriers can be back for it. With no
 * (or an empty) basket this is the plain GET, exactly as before; with one it is the POST twin.
 */
export async function getDeliveryAvailability(
    pin?: { latitude: number; longitude: number },
    basket?: DeliveryBasketLine[]
): Promise<DeliveryAvailability> {
    if (basket !== undefined && basket.length > 0) {
        const response = await fetch(`${BASE_URL}/delivery/availability`, {
            method: 'POST',
            headers: demandHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ lat: pin?.latitude, lng: pin?.longitude, items: basket }),
        });
        if (!response.ok) {
            throw new DeliveryApiError(await extractErrorMessage(response), response.status);
        }
        return await response.json();
    }

    const query =
        pin === undefined ? '' : `?lat=${encodeURIComponent(pin.latitude)}&lng=${encodeURIComponent(pin.longitude)}`;

    const response = await fetch(`${BASE_URL}/delivery/availability${query}`, {
        method: 'GET',
        headers: demandHeaders(),
    });

    if (!response.ok) {
        throw new DeliveryApiError(await extractErrorMessage(response), response.status);
    }
    return await response.json();
}

/**
 * Records that a refused customer pressed "Order on Keeta" — demand we sent to a competitor.
 *
 * Fire-and-forget: callers `void` it and open Keeta in the same tick, because the hop to Keeta must
 * stay inside the click (a popup opened after an await is blocked) and must never wait on, or be
 * stopped by, our own bookkeeping. `keepalive` lets the request outlive the page if the customer
 * leaves for Keeta in this tab. Never throws; a failure is only a warning, since the customer can
 * do nothing about it.
 */
export async function reportKeetaFallbackChosen(event: KeetaFallbackEvent): Promise<void> {
    try {
        const response = await fetch(`${BASE_URL}/delivery/keeta-fallback-events`, {
            method: 'POST',
            keepalive: true,
            headers: demandHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ stage: event.stage, reason: event.reason }),
        });
        if (!response.ok) {
            logger.warn(`Keeta fallback event was not recorded (HTTP ${response.status})`);
        }
    } catch (err) {
        logger.warn('Keeta fallback event could not be sent:', err);
    }
}

export async function listAddresses(accessToken: string): Promise<CustomerAddress[]> {
    const response = await fetch(`${BASE_URL}/customer/addresses`, {
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new DeliveryApiError(await extractErrorMessage(response), response.status);
    }
    return await response.json();
}

/**
 * Saves an address. The server deduplicates: a pin within 20 m of one the customer already has,
 * with the same flat, comes back as **200 with that existing address** rather than a 201 with a
 * new one (and rather than a 409, which would be an error the customer could not act on).
 *
 * Both outcomes are a success carrying an address, so callers need no status check — they should
 * upsert what comes back by `id`, which is what `useSavedAddresses` does.
 */
export async function createAddress(
    accessToken: string,
    body: CreateCustomerAddressRequest
): Promise<CustomerAddress> {
    const response = await fetch(`${BASE_URL}/customer/addresses`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new DeliveryApiError(await extractErrorMessage(response), response.status);
    }
    return await response.json();
}

/**
 * Fixes the text of a saved address (the pencil). PATCH, not PUT: the pin is not part of the
 * representation a customer may write — see `UpdateCustomerAddressRequest`.
 *
 * A 409 means the edit would collide with another saved address (same pin, same flat).
 */
export async function updateAddress(
    accessToken: string,
    addressId: string,
    body: UpdateCustomerAddressRequest
): Promise<CustomerAddress> {
    const response = await fetch(`${BASE_URL}/customer/addresses/${encodeURIComponent(addressId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new DeliveryApiError(await extractErrorMessage(response), response.status);
    }
    return await response.json();
}

/**
 * Removes a saved address from the customer's list.
 *
 * The server archives rather than deletes: `orders.delivery_address_id` points at the row, so a
 * hard delete would take the address off a past order's record. The customer sees it gone either
 * way, and a past delivery keeps knowing where it went.
 *
 * Idempotent — a second call on the same address is another 204, so a double tap on a slow
 * connection cannot surface an error the customer can do nothing about.
 */
export async function deleteAddress(accessToken: string, addressId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/customer/addresses/${encodeURIComponent(addressId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new DeliveryApiError(await extractErrorMessage(response), response.status);
    }
}

/**
 * Delivery checkout (§1.7): settle payment, then create the order — never the reverse.
 *
 * ⚠️ Backed by a **stub** until EazyPay is integrated; the server returns `stub: true` so the UI
 * can say so. It 501s unless the stub is explicitly enabled, which it is not in production.
 */
export async function payForDelivery(body: {
    method: DeliveryPaymentMethod;
    addressId: string;
    order: unknown;
}): Promise<DeliveryPaymentResult> {
    const res = await fetch(`${BASE_URL}/delivery/payment/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new DeliveryApiError(await extractErrorMessage(res), res.status);
    }
    return res.json();
}
