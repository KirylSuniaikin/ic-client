import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { BASE_URL } from "./client";
import {
    fetchApplePayEligibility,
    requestApplePayMerchantSession,
    createApplePayOrder,
    payApplePayOrder,
    fetchApplePayPaymentStatus,
} from "./customerAuth";
import { ApplePayApiError } from "../../domains/order/applePayTypes";
import { BranchClosedError, ItemsUnavailableError } from "../../domains/order/types";
import type { CreateOrderRequest } from "../../domains/order/types";
import { CLIENT_PLATFORM_HEADER, CLIENT_PLATFORM_WEB } from "./clientPlatform";
import { __resetCustomerAuthStoreForTests } from "../../domains/customer-auth/context/CustomerAuthProvider";

// Contract: backend ApplePayEligibilityController / ApplePayMerchantSessionController /
// ApplePayPaymentController under /api/customer/apple-pay.
const ROOT = `${BASE_URL}/customer/apple-pay`;
const ACCESS = "my-access-token";

const ORDER: CreateOrderRequest = {
    tel: "97333111222",
    customer_name: "Sara",
    type: "Pick Up",
    payment_type: "Card",
    branchId: "11111111-1111-1111-1111-111111111111",
    notes: "",
    items: [],
    amount_paid: 5,
    language: "en",
    idempotency_key: "key-1",
};

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
let savedFetch: typeof globalThis.fetch;

beforeEach(() => {
    savedFetch = global.fetch;
    mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    global.fetch = mockFetch as typeof fetch;
    __resetCustomerAuthStoreForTests();
});

afterEach(() => {
    global.fetch = savedFetch;
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

function lastCall(): { url: string; init: RequestInit; headers: Headers } {
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    return { url, init, headers: new Headers(init.headers) };
}

describe("fetchApplePayEligibility", () => {
    it("GETs /eligibility with the Bearer token, credentials and platform header, no body", async () => {
        mockFetch.mockResolvedValueOnce(json({ enabled: true }));

        const result = await fetchApplePayEligibility(ACCESS);

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/eligibility`);
        expect(init.method).toBe("GET");
        expect(init.credentials).toBe("include");
        expect(init.body).toBeUndefined();
        expect(headers.get("Authorization")).toBe(`Bearer ${ACCESS}`);
        expect(headers.get(CLIENT_PLATFORM_HEADER)).toBe(CLIENT_PLATFORM_WEB);
        expect(result).toEqual({ enabled: true });
    });

    it("maps the flag-off 404 token to ApplePayApiError", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "APPLE_PAY_NOT_AVAILABLE" }, 404));

        await expect(fetchApplePayEligibility(ACCESS)).rejects.toMatchObject({
            name: "ApplePayApiError", code: "APPLE_PAY_NOT_AVAILABLE", status: 404,
        });
    });
});

describe("requestApplePayMerchantSession", () => {
    it("POSTs {validationUrl} to /merchant-session and returns Apple's opaque session untouched", async () => {
        const session = { merchantSessionIdentifier: "ms", nonce: "n", epochTimestamp: 1 };
        mockFetch.mockResolvedValueOnce(json(session));

        const result = await requestApplePayMerchantSession(ACCESS, "https://apple-pay-gateway.apple.com/paymentservices/startSession");

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/merchant-session`);
        expect(init.method).toBe("POST");
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get("Authorization")).toBe(`Bearer ${ACCESS}`);
        expect(init.body).toBe(JSON.stringify({
            validationUrl: "https://apple-pay-gateway.apple.com/paymentservices/startSession",
        }));
        expect(result).toEqual(session);
    });

    it.each([
        ["APPLE_PAY_INVALID_VALIDATION_URL", 400],
        ["APPLE_PAY_NOT_CONFIGURED", 503],
    ])("maps %s (%i) to ApplePayApiError.code", async (code, status) => {
        mockFetch.mockResolvedValueOnce(json({ message: code }, status));

        await expect(requestApplePayMerchantSession(ACCESS, "https://x")).rejects.toMatchObject({ code, status });
    });
});

describe("createApplePayOrder", () => {
    it("POSTs the order JSON unchanged to /orders and parses the 201 body", async () => {
        const created = { orderId: 4821, amount: "5.000", currency: "BHD", status: "Pending Payment" };
        mockFetch.mockResolvedValueOnce(json(created, 201));

        const result = await createApplePayOrder(ACCESS, ORDER);

        const { url, init } = lastCall();
        expect(url).toBe(`${ROOT}/orders`);
        expect(init.method).toBe("POST");
        expect(init.body).toBe(JSON.stringify(ORDER));
        expect(result).toEqual(created);
    });

    it("passes orderType Delivery through as type Delivery (order-type-agnostic)", async () => {
        mockFetch.mockResolvedValueOnce(json({ orderId: 1, amount: "5.000", currency: "BHD", status: "Pending Payment" }, 201));

        await createApplePayOrder(ACCESS, { ...ORDER, type: "Delivery" });

        const body: unknown = JSON.parse(String(lastCall().init.body));
        expect(body).toMatchObject({ type: "Delivery", payment_type: "Card" });
    });

    it("maps 409 with unavailableIds to ItemsUnavailableError", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "Some items are unavailable", unavailableIds: [7, 9] }, 409));

        const failure: unknown = await createApplePayOrder(ACCESS, ORDER).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(ItemsUnavailableError);
        expect(failure).toMatchObject({ message: "Some items are unavailable", unavailableIds: [7, 9] });
    });

    it("maps 423 to BranchClosedError carrying the server message", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "Branch is closed" }, 423));

        const failure: unknown = await createApplePayOrder(ACCESS, ORDER).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(BranchClosedError);
        expect(failure).toMatchObject({ message: "Branch is closed" });
    });

    it.each([
        ["APPLE_PAY_PAYMENT_IN_PROGRESS", 409],
        ["APPLE_PAY_PHONE_MISMATCH", 403],
        ["APPLE_PAY_INVALID_REQUEST", 400],
    ])("maps the %s token (%i) to ApplePayApiError", async (code, status) => {
        mockFetch.mockResolvedValueOnce(json({ message: code }, status));

        const failure: unknown = await createApplePayOrder(ACCESS, ORDER).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(ApplePayApiError);
        expect(failure).toMatchObject({ code, status });
    });

    it("falls back to a stable code when the error body is not JSON", async () => {
        mockFetch.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));

        await expect(createApplePayOrder(ACCESS, ORDER)).rejects.toMatchObject({
            code: "APPLE_PAY_UNKNOWN_ERROR", status: 502,
        });
    });
});

describe("payApplePayOrder", () => {
    it("POSTs exactly attemptKey/paymentToken/fbc/fbp (no amount) to /orders/{id}/pay", async () => {
        const paid = { orderId: 4821, status: "APPROVED", amount: "5.000", currency: "BHD" };
        mockFetch.mockResolvedValueOnce(json(paid));

        const result = await payApplePayOrder(ACCESS, 4821, {
            attemptKey: "attempt-1", paymentToken: '{"data":"x"}', fbc: null, fbp: "fb.1",
        });

        const { url, init } = lastCall();
        expect(url).toBe(`${ROOT}/orders/4821/pay`);
        expect(init.method).toBe("POST");
        const body: unknown = JSON.parse(String(init.body));
        expect(body).toEqual({ attemptKey: "attempt-1", paymentToken: '{"data":"x"}', fbc: null, fbp: "fb.1" });
        expect(body).not.toHaveProperty("amount");
        expect(result).toEqual(paid);
    });

    it.each(["APPROVED", "DECLINED", "PENDING", "REVIEW"])("parses status %s", async status => {
        mockFetch.mockResolvedValueOnce(json({ orderId: 4821, status, amount: "5.000", currency: "BHD" }));

        const result = await payApplePayOrder(ACCESS, 4821, { attemptKey: "a", paymentToken: "t" });

        expect(result.status).toBe(status);
    });

    it("maps APPLE_PAY_ORDER_NOT_PAYABLE (409) to ApplePayApiError", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "APPLE_PAY_ORDER_NOT_PAYABLE" }, 409));

        await expect(payApplePayOrder(ACCESS, 4821, { attemptKey: "a", paymentToken: "t" }))
            .rejects.toMatchObject({ code: "APPLE_PAY_ORDER_NOT_PAYABLE", status: 409 });
    });
});

describe("fetchApplePayPaymentStatus", () => {
    it("GETs /orders/{id}/payment and parses the response", async () => {
        const body = { orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" };
        mockFetch.mockResolvedValueOnce(json(body));

        const result = await fetchApplePayPaymentStatus(ACCESS, 4821);

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/orders/4821/payment`);
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
        expect(headers.get("Authorization")).toBe(`Bearer ${ACCESS}`);
        expect(result).toEqual(body);
    });

    it("maps a 404 for someone else's order to ApplePayApiError", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "Not Found" }, 404));

        await expect(fetchApplePayPaymentStatus(ACCESS, 1)).rejects.toMatchObject({ status: 404 });
    });
});
