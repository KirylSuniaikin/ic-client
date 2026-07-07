import { BASE_URL } from './client';
import { CustomerAuthApiError } from '../../domains/customer-auth/types';
import type {
    OtpRequestPayload,
    OtpVerifyPayload,
    CustomerTokenResponse,
    CustomerMeResponse,
    CustomerOrdersPageResponse,
    CustomerOrderDetail,
    CustomerActiveOrder,
} from '../../domains/customer-auth/types';

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

// All five customer-auth endpoints always send credentials: 'include' —
// the refresh/logout flow is cookie-driven (customer_refresh_token, HttpOnly).

export async function requestOtp(payload: OtpRequestPayload): Promise<void> {
    const response = await fetch(`${BASE_URL}/auth/otp/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }
}

export async function fetchCustomerMe(accessToken: string): Promise<CustomerMeResponse> {
    const response = await fetch(`${BASE_URL}/customer/me`, {
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
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
    const response = await fetch(`${BASE_URL}/customer/orders?page=${page}&size=${size}`, {
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
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
    const response = await fetch(`${BASE_URL}/customer/orders/${orderId}`, {
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}

export async function fetchActiveOrder(accessToken: string): Promise<CustomerActiveOrder | null> {
    const response = await fetch(`${BASE_URL}/customer/orders/active`, {
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 204) {
        return null;
    }

    if (!response.ok) {
        throw new CustomerAuthApiError(await extractErrorMessage(response), response.status);
    }

    return await response.json();
}
