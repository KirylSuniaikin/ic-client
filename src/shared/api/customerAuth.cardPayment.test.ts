import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { BASE_URL } from "./client";
import {
    fetchCardEligibility,
    createCardOrder,
    createCardSession,
    payCardOrder,
    fetchCardPaymentStatus,
} from "./customerAuth";
import { CardPaymentApiError } from "../../domains/order/cardPaymentTypes";
import { BranchClosedError, ItemsUnavailableError } from "../../domains/order/types";
import type { CreateOrderRequest } from "../../domains/order/types";
import { CLIENT_PLATFORM_HEADER, CLIENT_PLATFORM_WEB } from "./clientPlatform";
import { __resetCustomerAuthStoreForTests } from "../../domains/customer-auth/context/CustomerAuthProvider";

// Contract: task-spec.md §4.1 C-1..C-5 under /api/customer/card-payment.
const ROOT = `${BASE_URL}/customer/card-payment`;
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

function expectAuthenticated(headers: Headers, init: RequestInit): void {
    expect(init.credentials).toBe("include");
    expect(headers.get("Authorization")).toBe(`Bearer ${ACCESS}`);
    expect(headers.get(CLIENT_PLATFORM_HEADER)).toBe(CLIENT_PLATFORM_WEB);
}

describe("fetchCardEligibility", () => {
    it("GETs /eligibility with Bearer, credentials and no body", async () => {
        mockFetch.mockResolvedValueOnce(json({ enabled: true }));

        const result = await fetchCardEligibility(ACCESS);

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/eligibility`);
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
        expectAuthenticated(headers, init);
        expect(result).toEqual({ enabled: true });
    });
});

describe("createCardOrder", () => {
    it("POSTs the order JSON unchanged to /orders", async () => {
        const created = { orderId: 4821, amount: "5.000", currency: "BHD", status: "Pending Payment" };
        mockFetch.mockResolvedValueOnce(json(created, 201));

        const result = await createCardOrder(ACCESS, ORDER);

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/orders`);
        expect(init.method).toBe("POST");
        expect(init.body).toBe(JSON.stringify(ORDER));
        expect(headers.get("Content-Type")).toBe("application/json");
        expectAuthenticated(headers, init);
        expect(result).toEqual(created);
    });

    it("maps 409 with unavailableIds to ItemsUnavailableError", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "Some items are unavailable", unavailableIds: [7, 9] }, 409));

        const failure: unknown = await createCardOrder(ACCESS, ORDER).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(ItemsUnavailableError);
        expect(failure).toMatchObject({ unavailableIds: [7, 9] });
    });

    it("maps 423 to BranchClosedError", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "Branch is closed" }, 423));

        const failure: unknown = await createCardOrder(ACCESS, ORDER).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(BranchClosedError);
        expect(failure).toMatchObject({ message: "Branch is closed" });
    });

    it.each([
        ["CARD_PAYMENT_IN_PROGRESS", 409],
        ["CARD_PHONE_MISMATCH", 403],
        ["CARD_INVALID_REQUEST", 400],
        ["CARD_NOT_AVAILABLE", 404],
    ])("maps the %s token (%i) to CardPaymentApiError", async (code, status) => {
        mockFetch.mockResolvedValueOnce(json({ message: code }, status));

        const failure: unknown = await createCardOrder(ACCESS, ORDER).catch((e: unknown) => e);

        expect(failure).toBeInstanceOf(CardPaymentApiError);
        expect(failure).toMatchObject({ code, status });
    });

    it("falls back to CARD_UNKNOWN_ERROR when the error body is not JSON", async () => {
        mockFetch.mockResolvedValueOnce(new Response("<html>bad gateway</html>", { status: 502 }));

        await expect(createCardOrder(ACCESS, ORDER)).rejects.toMatchObject({
            name: "CardPaymentApiError", code: "CARD_UNKNOWN_ERROR", status: 502,
        });
    });
});

describe("createCardSession", () => {
    it("POSTs without a body to /orders/{id}/session and returns the three session fields", async () => {
        const session = { sessionId: "SESSION0001", scriptUrl: "https://x.gateway.mastercard.com/s.js", apiVersion: "100" };
        mockFetch.mockResolvedValueOnce(json(session));

        const result = await createCardSession(ACCESS, 4821);

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/orders/4821/session`);
        expect(init.method).toBe("POST");
        expect(init.body).toBeUndefined();
        expectAuthenticated(headers, init);
        expect(result).toEqual(session);
    });

    it.each([
        ["CARD_SESSION_FAILED", 502],
        ["CARD_INVALID_AMOUNT", 422],
        ["CARD_ORDER_NOT_PAYABLE", 409],
    ])("maps %s (%i)", async (code, status) => {
        mockFetch.mockResolvedValueOnce(json({ message: code }, status));

        await expect(createCardSession(ACCESS, 4821)).rejects.toMatchObject({ code, status });
    });
});

describe("payCardOrder", () => {
    it("POSTs exactly attemptKey/sessionId/fbc/fbp (no amount) to /orders/{id}/pay", async () => {
        const paid = { orderId: 4821, status: "DECLINED", reason: "REJECTED", amount: "5.000", currency: "BHD" };
        mockFetch.mockResolvedValueOnce(json(paid));

        const result = await payCardOrder(ACCESS, 4821, {
            attemptKey: "attempt-1", sessionId: "SESSION0001", fbc: null, fbp: "fb.1",
        });

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/orders/4821/pay`);
        expect(init.method).toBe("POST");
        expectAuthenticated(headers, init);
        const body: unknown = JSON.parse(String(init.body));
        expect(body).toEqual({ attemptKey: "attempt-1", sessionId: "SESSION0001", fbc: null, fbp: "fb.1" });
        expect(body).not.toHaveProperty("amount");
        expect(result).toEqual(paid);
    });

    it("maps CARD_ORDER_NOT_PAYABLE (409) to CardPaymentApiError", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "CARD_ORDER_NOT_PAYABLE" }, 409));

        await expect(payCardOrder(ACCESS, 4821, { attemptKey: "a", sessionId: "s" }))
            .rejects.toMatchObject({ code: "CARD_ORDER_NOT_PAYABLE", status: 409 });
    });
});

describe("fetchCardPaymentStatus", () => {
    it("GETs /orders/{id}/payment", async () => {
        const status = { orderId: 4821, status: "APPROVED", reason: null, amount: "5.000", currency: "BHD" };
        mockFetch.mockResolvedValueOnce(json(status));

        const result = await fetchCardPaymentStatus(ACCESS, 4821);

        const { url, init, headers } = lastCall();
        expect(url).toBe(`${ROOT}/orders/4821/payment`);
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
        expectAuthenticated(headers, init);
        expect(result).toEqual(status);
    });

    it("maps CARD_PAYMENT_NOT_FOUND (404)", async () => {
        mockFetch.mockResolvedValueOnce(json({ message: "CARD_PAYMENT_NOT_FOUND" }, 404));

        await expect(fetchCardPaymentStatus(ACCESS, 4821))
            .rejects.toMatchObject({ code: "CARD_PAYMENT_NOT_FOUND", status: 404 });
    });
});
