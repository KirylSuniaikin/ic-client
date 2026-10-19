import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { BASE_URL, CUSTOMER_AUTH_BASE_URL } from "../../../shared/api/client";
import {
    CustomerAuthProvider,
    __resetCustomerAuthStoreForTests,
} from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider } from "../../customer-auth/context/CustomerAuthUiProvider";
import "../../../shared/i18n";
import { useApplePayCheckout } from "./useApplePayCheckout";
import { writeChosenBranch } from "../../branch/utils/customerBranch";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

// The real API functions run against a mocked global fetch serving the frozen §5 JSON.
const ACCESS_TOKEN = "ACCESS-TOKEN-SENTINEL";
const PAYMENT_DATA_SENTINEL = "PAYMENT-DATA-SENTINEL";
const ROOT = `${BASE_URL}/customer/apple-pay`;

const PROFILE = {
    id: "c1", phone: "97333111222", preferredBranchId: null, name: "Sara",
    address: null, amountOfOrders: 3, lastOrderDate: null,
};

// Saar: any branch other than DEFAULT_BRANCH_ID (Al-Hidd) proves the chosen branch is sent.
const SAAR: IBranch = {
    id: "2e8c35f7-d75e-4442-b496-cbb929842c11",
    externalId: "ext-saar",
    branchNo: 2,
    branchName: "Saar",
    locale: "en",
    latitude: 26.19,
    longitude: 50.49,
};

class FakeApplePaySession implements ApplePaySessionInstance {
    static instances: FakeApplePaySession[] = [];
    static readonly STATUS_SUCCESS = 0;
    static readonly STATUS_FAILURE = 1;
    static canMakePayments(): boolean { return true; }
    static supportsVersion(): boolean { return true; }

    onvalidatemerchant: ((event: ApplePayValidateMerchantEvent) => void) | null = null;
    onpaymentauthorized: ((event: ApplePayPaymentAuthorizedEvent) => void) | null = null;
    oncancel: (() => void) | null = null;
    begin = jest.fn<void, []>();
    abort = jest.fn<void, []>();
    completeMerchantValidation = jest.fn<void, [unknown]>();
    completePayment = jest.fn<void, [number]>();

    constructor(public version: number, public request: ApplePayPaymentRequest) {
        FakeApplePaySession.instances.push(this);
    }
}

function makeItem(): CartItem {
    return {
        id: 7, name: "Water", size: "M", category: "Beverages", isThinDough: false, isGarlicCrust: false,
        extraIngredients: [], toppings: [], note: "", quantity: 2, description: "", amount: 2.5,
        discountAmount: 0, comboItems: null, photo: "",
    };
}

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return React.createElement(
        CustomerAuthProvider, null,
        React.createElement(CustomerAuthUiProvider, null, children),
    );
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

type Call = { method: string; url: string; body: unknown };
let calls: Call[] = [];
type Handler = () => Response;
let routes: Record<string, Handler> = {};

function installFetch(): void {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
        calls.push({ method, url, body });
        const handler = routes[`${method} ${url}`];
        return handler ? handler() : json({ message: "Not Found" }, 404);
    }) as typeof fetch;
}

function callsTo(method: string, path: string): Call[] {
    return calls.filter(c => c.method === method && c.url === path);
}

function makeParams(orderType: string) {
    return {
        isAdmin: false,
        isKiosk: false,
        cartOpen: true,
        cartItems: [makeItem()],
        orderType,
        setCartItems: jest.fn<void, [CartItem[] | ((prev: CartItem[]) => CartItem[])]>(),
        setCartOpen: jest.fn<void, [boolean | ((prev: boolean) => boolean)]>(),
        setPaymentMethod: jest.fn<void, [string | ((prev: string) => string)]>(),
        setOrderType: jest.fn<void, [string | ((prev: string) => string)]>(),
        refreshMenu: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
        setUnavailableItems: jest.fn<void, [string[] | ((prev: string[]) => string[])]>(),
        setUnavailableMessage: jest.fn<void, [string | null | ((prev: string | null) => string | null)]>(),
        setUnavailablePopupOpen: jest.fn<void, [boolean | ((prev: boolean) => boolean)]>(),
    };
}

async function renderAvailable(orderType = "Pick Up") {
    const params = makeParams(orderType);
    const hook = renderHook(() => useApplePayCheckout(params), { wrapper });
    await waitFor(() => expect(hook.result.current.available).toBe(true));
    return { ...hook, params };
}

function tap(start: () => void): FakeApplePaySession {
    act(() => { start(); });
    return FakeApplePaySession.instances[0];
}

async function authorize(session: FakeApplePaySession): Promise<void> {
    await act(async () => {
        session.onpaymentauthorized?.({ payment: { token: { paymentData: { data: PAYMENT_DATA_SENTINEL } } } });
    });
}

const PAY_PATH = `${ROOT}/orders/4821/pay`;
const STATUS_PATH = `${ROOT}/orders/4821/payment`;

function payResponse(status: string): Handler {
    return () => json({ orderId: 4821, status, amount: "5.000", currency: "BHD" });
}

let savedFetch: typeof globalThis.fetch;

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    savedFetch = global.fetch;
    FakeApplePaySession.instances = [];
    window.ApplePaySession = FakeApplePaySession;
    __resetCustomerAuthStoreForTests();
    localStorage.clear();
    calls = [];
    routes = {
        [`POST ${CUSTOMER_AUTH_BASE_URL}/auth/refresh`]: () => json({ accessToken: ACCESS_TOKEN, isNewAccount: false }),
        [`GET ${ROOT}/eligibility`]: () => json({ enabled: true }),
        [`GET ${BASE_URL}/customer/me`]: () => json(PROFILE),
        [`GET ${BASE_URL}/blacklist/get_all`]: () => json([]),
        [`POST ${ROOT}/merchant-session`]: () => json({ merchantSessionIdentifier: "ms" }),
        [`POST ${ROOT}/orders`]: () => json({ orderId: 4821, amount: "5.000", currency: "BHD", status: "Pending Payment" }, 201),
        [`POST ${PAY_PATH}`]: payResponse("APPROVED"),
        [`GET ${STATUS_PATH}`]: payResponse("PENDING"),
    };
    installFetch();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
    global.fetch = savedFetch;
    delete window.ApplePaySession;
    jest.useRealTimers();
});

describe("useApplePayCheckout — end to end over the real API functions", () => {
    it("validates the merchant, creates the order, pays and completes on APPROVED", async () => {
        const { result, params } = await renderAvailable();
        const session = tap(result.current.start);

        await act(async () => { session.onvalidatemerchant?.({ validationURL: "https://apple-pay-gateway.apple.com/s" }); });
        await authorize(session);

        expect(callsTo("POST", `${ROOT}/merchant-session`)[0].body).toEqual({
            validationUrl: "https://apple-pay-gateway.apple.com/s",
        });
        expect(session.completeMerchantValidation).toHaveBeenCalledWith({ merchantSessionIdentifier: "ms" });
        const order = callsTo("POST", `${ROOT}/orders`)[0].body;
        expect(order).toMatchObject({
            tel: PROFILE.phone, customer_name: "Sara", type: "Pick Up", payment_type: "Card", amount_paid: 5,
        });
        const pay = callsTo("POST", PAY_PATH)[0].body;
        expect(pay).toMatchObject({ paymentToken: JSON.stringify({ data: PAYMENT_DATA_SENTINEL }) });
        expect(pay).toHaveProperty("attemptKey");
        expect(pay).not.toHaveProperty("amount");
        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_SUCCESS);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(result.current.busy).toBe(false);
    });

    it("sends the chosen pickup branch in the order body", async () => {
        writeChosenBranch(SAAR);
        const { result } = await renderAvailable();
        const session = tap(result.current.start);

        await authorize(session);

        expect(callsTo("POST", `${ROOT}/orders`)[0].body).toMatchObject({ branchId: SAAR.id });
    });

    it("sends orderType Delivery as type Delivery (order-type-agnostic)", async () => {
        const { result } = await renderAvailable("Delivery");
        const session = tap(result.current.start);

        await authorize(session);

        expect(callsTo("POST", `${ROOT}/orders`)[0].body).toMatchObject({ type: "Delivery" });
    });

    it("DECLINED fails the sheet, shows the localized error and keeps the cart", async () => {
        routes[`POST ${PAY_PATH}`] = payResponse("DECLINED");
        const { result, params } = await renderAvailable();
        const session = tap(result.current.start);

        await authorize(session);

        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
        expect(result.current.error).toBe("Your payment was declined. You were not charged.");
        expect(params.setCartItems).not.toHaveBeenCalled();
    });

    it("409 with unavailableIds on create shows the unavailable popup and never pays", async () => {
        routes[`POST ${ROOT}/orders`] = () => json({ message: "Some items are unavailable", unavailableIds: [7] }, 409);
        const { result, params } = await renderAvailable();
        const session = tap(result.current.start);

        await authorize(session);

        expect(params.setUnavailablePopupOpen).toHaveBeenCalledWith(true);
        expect(params.setUnavailableItems).toHaveBeenCalledWith(["Water"]);
        expect(callsTo("POST", PAY_PATH)).toHaveLength(0);
        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
    });

    it("423 on create reports the branch-closed message and never pays", async () => {
        routes[`POST ${ROOT}/orders`] = () => json({ message: "Branch is closed" }, 423);
        const { result } = await renderAvailable();
        const session = tap(result.current.start);

        await authorize(session);

        expect(result.current.error).toBe("Branch is closed");
        expect(callsTo("POST", PAY_PATH)).toHaveLength(0);
    });

    it("409 APPLE_PAY_PAYMENT_IN_PROGRESS on create shows the in-progress message", async () => {
        routes[`POST ${ROOT}/orders`] = () => json({ message: "APPLE_PAY_PAYMENT_IN_PROGRESS" }, 409);
        const { result } = await renderAvailable();
        const session = tap(result.current.start);

        await authorize(session);

        expect(result.current.error).toBe("A previous Apple Pay payment is still being confirmed. Please wait.");
    });

    it("PENDING from pay polls GET /payment and resolves to success; button stays blocked meanwhile", async () => {
        routes[`POST ${PAY_PATH}`] = payResponse("PENDING");
        const statuses = ["PENDING", "APPROVED"];
        routes[`GET ${STATUS_PATH}`] = () => payResponse(statuses.shift() ?? "APPROVED")();
        const { result, params } = await renderAvailable();
        const session = tap(result.current.start);
        jest.useFakeTimers();

        await authorize(session);

        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
        expect(result.current.busy).toBe(true);
        await act(async () => { jest.advanceTimersByTime(3000); });
        expect(result.current.busy).toBe(true);
        await act(async () => { jest.advanceTimersByTime(3000); });

        expect(callsTo("GET", STATUS_PATH)).toHaveLength(2);
        expect(callsTo("POST", PAY_PATH)).toHaveLength(1);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(result.current.busy).toBe(false);
    });

    it("a PAY timeout (504) keeps polling through the 120 s grace window, never re-paying, then resolves", async () => {
        routes[`POST ${PAY_PATH}`] = () => json({ message: "Gateway Timeout" }, 504);
        let polls = 0;
        routes[`GET ${STATUS_PATH}`] = () => payResponse(++polls > 41 ? "APPROVED" : "PENDING")();
        const { result, params } = await renderAvailable();
        const session = tap(result.current.start);
        jest.useFakeTimers();

        await authorize(session);
        for (let i = 0; i < 42; i++) {
            await act(async () => { jest.advanceTimersByTime(3000); });
        }

        expect(callsTo("POST", PAY_PATH)).toHaveLength(1);
        expect(callsTo("POST", `${ROOT}/orders`)).toHaveLength(1);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(result.current.busy).toBe(false);
    });

    it("a poll that resolves to REVIEW shows the manual-check notice and stays blocked", async () => {
        routes[`POST ${PAY_PATH}`] = payResponse("PENDING");
        routes[`GET ${STATUS_PATH}`] = payResponse("REVIEW");
        const { result, params } = await renderAvailable();
        const session = tap(result.current.start);
        jest.useFakeTimers();

        await authorize(session);
        await act(async () => { jest.advanceTimersByTime(3000); });

        expect(result.current.notice).toBe("Your payment needs a manual check. Please contact the restaurant.");
        expect(result.current.busy).toBe(true);
        expect(params.setCartItems).not.toHaveBeenCalled();
    });

    it("a 502 merchant-validation failure aborts the session and shows the localized error", async () => {
        routes[`POST ${ROOT}/merchant-session`] = () => json({ message: "APPLE_PAY_MERCHANT_VALIDATION_FAILED" }, 502);
        const { result } = await renderAvailable();
        const session = tap(result.current.start);

        await act(async () => { session.onvalidatemerchant?.({ validationURL: "https://apple-pay-gateway.apple.com/s" }); });

        expect(session.abort).toHaveBeenCalled();
        expect(session.completeMerchantValidation).not.toHaveBeenCalled();
        expect(result.current.error).toBe("Apple Pay could not verify the merchant. Please try again.");
        expect(result.current.busy).toBe(false);
    });

    it("a definitive APPLE_PAY_ORDER_NOT_PAYABLE (409) on pay unblocks without polling", async () => {
        routes[`POST ${PAY_PATH}`] = () => json({ message: "APPLE_PAY_ORDER_NOT_PAYABLE" }, 409);
        const { result } = await renderAvailable();
        const session = tap(result.current.start);

        await authorize(session);

        expect(callsTo("GET", STATUS_PATH)).toHaveLength(0);
        expect(result.current.busy).toBe(false);
        expect(result.current.error).toBe("Apple Pay payment could not be completed. You were not charged.");
    });

    it("if the backend is still PENDING after the window, the customer gets a do-not-pay-again notice and stays blocked", async () => {
        routes[`POST ${PAY_PATH}`] = payResponse("PENDING");
        const { result } = await renderAvailable();
        const session = tap(result.current.start);
        jest.useFakeTimers();

        await authorize(session);
        for (let i = 0; i < 55; i++) {
            await act(async () => { jest.advanceTimersByTime(3000); });
        }

        expect(result.current.notice).toContain("do not pay again");
        expect(result.current.notice).toContain("could not confirm");
        expect(result.current.busy).toBe(true);
        act(() => { result.current.start(); });
        expect(FakeApplePaySession.instances).toHaveLength(1);
        expect(callsTo("POST", PAY_PATH)).toHaveLength(1);
    });
});
