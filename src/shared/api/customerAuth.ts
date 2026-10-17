import { BASE_URL } from './client';
import { applyClientPlatform } from './clientPlatform';
import { customerAuthFetch } from '../../domains/customer-auth/context/CustomerAuthProvider';
import { CustomerAuthApiError } from '../../domains/customer-auth/types';
import type {
    OtpRequestPayload,
    OtpVerifyPayload,
    CustomerTokenResponse,
    CustomerMeResponse,
    CustomerOrdersPageResponse,
    CustomerOrderDetail,
    CustomerActiveOrder,
    ReviewPrompt,
    ReviewPromptOutcome,
    SuggestedOrderResponse,
} from '../../domains/customer-auth/types';
import type { OrderTrackingResponse } from '../../domains/order-status/types';
import { ApplePayApiError } from '../../domains/order/applePayTypes';
import type {
    ApplePayEligibilityResponse,
    ApplePayOrderResponse,
    ApplePayPayRequest,
    ApplePayPaymentResponse,
} from '../../domains/order/applePayTypes';
import { CardPaymentApiError } from '../../domains/order/cardPaymentTypes';
import type {
    CardEligibilityResponse,
    CardOrderResponse,
    CardPayRequest,
    CardPaymentResponse,
    CardSessionResponse,
} from '../../domains/order/cardPaymentTypes';
import { BranchClosedError, ItemsUnavailableError } from '../../domains/order/types';
import type { CreateOrderRequest } from '../../domains/order/types';

// Type guard for a JSON error body shaped like `{ message: string }`.
// The `as` cast is scoped to this guard's internal narrowing of an
// otherwise-`unknown` parsed body — no `any`/unchecked cast leaks out to callers.
function isMessageBody(data: unknown): data is { message: string } {
    if (typeof data !== 'object' || data === null) return false;
    return typeof (data as { message?: unknown }).message === 'string';
}

async function extractErrorMessage(response: Response): Promise<string> {
    try {
        const data: unknown = await response.json();
        if (isMessageBody(data)) {
            return data.message;
        }
    } catch {
        // response body wasn't JSON (or was empty) — fall through to the generic message
    }
    return `Request failed with status ${response.status}`;
}

// task-spec.md §8. The unauthenticated endpoints below (OTP request/verify, refresh, logout)
// go straight to `fetch`, not `customerAuthFetch`, so each one composes the platform header
// itself via this local helper. The token-bearing endpoints further down route through
// `customerAuthFetch` instead (task-spec.md §6) so an expired access token is silently
// refreshed-and-retried rather than surfacing a 401 to the caller.
function withClientPlatform(headers?: HeadersInit): Headers {
    const result = new Headers(headers);
    applyClientPlatform(result);
    return result;
}

// All five customer-auth endpoints always send credentials: 'include' —
// the refresh/logout flow is cookie-driven (customer_refresh_token, HttpOnly).

export async function requestOtp(payload: OtpRequestPayload): Promise<void> {
    const response = await fetch(`${BASE_URL}/auth/otp/request`, {
        method: 'POST',
        credentials: 'include',
        headers: withClientPlatform({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }
}

export async function verifyOtp(payload: OtpVerifyPayload): Promise<CustomerTokenResponse> {
    const response = await fetch(`${BASE_URL}/auth/otp/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: withClientPlatform({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

export async function refreshCustomerToken(): Promise<CustomerTokenResponse> {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: withClientPlatform(),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

export async function logoutCustomer(): Promise<void> {
    const response = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: withClientPlatform(),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }
}

// Mirrors fetchCustomerMe's pattern exactly (Bearer token, credentials: include) —
// task-spec.md §5.5a. Registers the customer's name once, keyed by the phone the
// backend derives from this same accessToken (never sent in the body).
export async function registerCustomerName(accessToken: string, name: string): Promise<void> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/name`, {
        method: 'POST',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }
}

// task-spec.md §1b. Idempotent full replacement (PUT), the inverse of the register-once
// POST above — returns the refreshed CustomerMeResponse (server-trimmed) in one round trip.
export async function updateCustomerName(
    accessToken: string,
    name: string
): Promise<CustomerMeResponse> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/name`, {
        method: 'PUT',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

export async function fetchCustomerMe(accessToken: string): Promise<CustomerMeResponse> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/me`, {
        method: 'GET',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}` }),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

export async function fetchMyOrders(
    accessToken: string,
    page: number,
    size: number
): Promise<CustomerOrdersPageResponse> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/orders?page=${page}&size=${size}`, {
        method: 'GET',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}` }),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

export async function fetchOrderDetail(
    accessToken: string,
    orderId: number
): Promise<CustomerOrderDetail> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/orders/${orderId}`, {
        method: 'GET',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}` }),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

export async function fetchActiveOrder(accessToken: string): Promise<CustomerActiveOrder | null> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/orders/active`, {
        method: 'GET',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}` }),
    });

    if (response.status === 204) {
        return null;
    }

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

// Resolves to `null` on a 204 (nothing to ask right now) — same shape as fetchActiveOrder.
export async function fetchReviewPrompt(accessToken: string): Promise<ReviewPrompt | null> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/review-prompt`, {
        method: 'GET',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}` }),
    });

    if (response.status === 204) {
        return null;
    }

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

// Fire-and-forget: the ack is telemetry about a prompt the customer has already
// seen, so a failed report must never surface an error over their pizza.
export async function ackReviewPrompt(
    accessToken: string,
    orderId: number,
    outcome: ReviewPromptOutcome,
): Promise<void> {
    try {
        await customerAuthFetch(`${BASE_URL}/customer/review-prompt/ack`, {
            method: 'POST',
            credentials: 'include',
            headers: withClientPlatform({
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ orderId, outcome }),
        });
    } catch {
        // Network failure only — the prompt has already been shown and answered
        // on screen, and re-raising here would surface an error the customer can
        // do nothing about.
    }
}

// runs/1b/task-spec.md §5.3. Mirrors fetchOrderDetail's exact shape — same auth pattern, same
// error type — against the frozen Phase 1a tracking endpoint.
export async function fetchCourierLocation(
    accessToken: string,
    orderId: number
): Promise<OrderTrackingResponse> {
    const response = await fetch(`${BASE_URL}/customer/orders/${orderId}/courier-location`, {
        method: 'GET',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}` }),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

// Apple Pay (task-spec.md §5 F-1..F-5). Errors carry a stable message token the caller keys off.
const APPLE_PAY_FALLBACK_CODE = 'APPLE_PAY_UNKNOWN_ERROR';

function isUnavailableIdsBody(data: unknown): data is { message: string; unavailableIds: number[] } {
    if (typeof data !== 'object' || data === null) return false;
    // Scoped narrowing of an otherwise-`unknown` parsed body, same as isMessageBody above.
    const body = data as { message?: unknown; unavailableIds?: unknown };
    return typeof body.message === 'string' && Array.isArray(body.unavailableIds);
}

async function readJsonOrNull(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

// `code` is the body's `message` token, or null when the body carried none (caller picks its fallback).
type PaymentErrorFactory = (code: string | null, status: number) => Error;

async function throwPaymentError(response: Response, errorFactory: PaymentErrorFactory): Promise<never> {
    const data = await readJsonOrNull(response);
    if (response.status === 409 && isUnavailableIdsBody(data)) {
        throw new ItemsUnavailableError(data.message, data.unavailableIds);
    }
    if (response.status === 423) {
        throw new BranchClosedError(isMessageBody(data) ? data.message : '');
    }
    throw errorFactory(isMessageBody(data) ? data.message : null, response.status);
}

async function customerPaymentRequest<T>(
    basePath: string,
    errorFactory: PaymentErrorFactory,
    accessToken: string,
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await customerAuthFetch(`${BASE_URL}${basePath}${path}`, {
        method,
        credentials: 'include',
        headers: withClientPlatform(headers),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
        return await throwPaymentError(response, errorFactory);
    }
    return await response.json();
}

const applePayError: PaymentErrorFactory = (code, status) =>
    new ApplePayApiError(code ?? APPLE_PAY_FALLBACK_CODE, status);

async function applePayRequest<T>(
    accessToken: string,
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
): Promise<T> {
    return await customerPaymentRequest<T>('/customer/apple-pay', applePayError, accessToken, path, method, body);
}

export async function fetchApplePayEligibility(accessToken: string): Promise<ApplePayEligibilityResponse> {
    return await applePayRequest<ApplePayEligibilityResponse>(accessToken, '/eligibility', 'GET');
}

// Response is Apple's opaque merchant session; passed straight to completeMerchantValidation.
export async function requestApplePayMerchantSession(accessToken: string, validationUrl: string): Promise<unknown> {
    return await applePayRequest<unknown>(accessToken, '/merchant-session', 'POST', { validationUrl });
}

export async function createApplePayOrder(
    accessToken: string,
    order: CreateOrderRequest,
): Promise<ApplePayOrderResponse> {
    return await applePayRequest<ApplePayOrderResponse>(accessToken, '/orders', 'POST', order);
}

export async function payApplePayOrder(
    accessToken: string,
    orderId: number,
    payload: ApplePayPayRequest,
): Promise<ApplePayPaymentResponse> {
    return await applePayRequest<ApplePayPaymentResponse>(accessToken, `/orders/${orderId}/pay`, 'POST', payload);
}

export async function fetchApplePayPaymentStatus(
    accessToken: string,
    orderId: number,
): Promise<ApplePayPaymentResponse> {
    return await applePayRequest<ApplePayPaymentResponse>(accessToken, `/orders/${orderId}/payment`, 'GET');
}

// Card / Hosted Session (task-spec.md §4.1 C-1..C-5).
const CARD_FALLBACK_CODE = 'CARD_UNKNOWN_ERROR';

const cardError: PaymentErrorFactory = (code, status) =>
    new CardPaymentApiError(code ?? CARD_FALLBACK_CODE, status);

async function cardRequest<T>(
    accessToken: string,
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
): Promise<T> {
    return await customerPaymentRequest<T>('/customer/card-payment', cardError, accessToken, path, method, body);
}

export async function fetchCardEligibility(accessToken: string): Promise<CardEligibilityResponse> {
    return await cardRequest<CardEligibilityResponse>(accessToken, '/eligibility', 'GET');
}

export async function createCardOrder(accessToken: string, order: CreateOrderRequest): Promise<CardOrderResponse> {
    return await cardRequest<CardOrderResponse>(accessToken, '/orders', 'POST', order);
}

export async function createCardSession(accessToken: string, orderId: number): Promise<CardSessionResponse> {
    return await cardRequest<CardSessionResponse>(accessToken, `/orders/${orderId}/session`, 'POST');
}

export async function payCardOrder(
    accessToken: string,
    orderId: number,
    payload: CardPayRequest,
): Promise<CardPaymentResponse> {
    return await cardRequest<CardPaymentResponse>(accessToken, `/orders/${orderId}/pay`, 'POST', payload);
}

export async function fetchCardPaymentStatus(accessToken: string, orderId: number): Promise<CardPaymentResponse> {
    return await cardRequest<CardPaymentResponse>(accessToken, `/orders/${orderId}/payment`, 'GET');
}

export async function fetchSuggestedItems(accessToken: string): Promise<SuggestedOrderResponse> {
    const response = await customerAuthFetch(`${BASE_URL}/customer/orders/suggested`, {
        method: 'GET',
        credentials: 'include',
        headers: withClientPlatform({ Authorization: `Bearer ${accessToken}` }),
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}
