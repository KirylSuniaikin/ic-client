import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
    refreshCustomerToken,
    fetchCustomerMe,
    fetchCardEligibility,
    createCardOrder,
    createCardSession,
    payCardOrder,
    fetchCardPaymentStatus,
} from "../../../shared/api/customerAuth";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import {
    CustomerAuthProvider,
    __resetCustomerAuthStoreForTests,
} from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider } from "../../customer-auth/context/CustomerAuthUiProvider";
import "../../../shared/i18n";
import { useCardCheckout } from "./useCardCheckout";
import { CardPaymentApiError } from "../cardPaymentTypes";
import type { CardPaymentResponse } from "../cardPaymentTypes";
import { loadHostedSessionScript, HostedSessionLoadError } from "../utils/hostedSessionLoader";
import { BranchClosedError, ItemsUnavailableError } from "../types";
import type { CartItem } from "../../menu/types";
import type { CustomerMeResponse } from "../../customer-auth/types";

jest.mock("../../../shared/api/customerAuth");
jest.mock("../../../shared/api/management");
jest.mock("../utils/hostedSessionLoader");

const mockRefreshToken = jest.mocked(refreshCustomerToken);
const mockMe = jest.mocked(fetchCustomerMe);
const mockEligibility = jest.mocked(fetchCardEligibility);
const mockCreateOrder = jest.mocked(createCardOrder);
const mockCreateSession = jest.mocked(createCardSession);
const mockPay = jest.mocked(payCardOrder);
const mockStatus = jest.mocked(fetchCardPaymentStatus);
const mockBanned = jest.mocked(getAllBannedCstmrs);
const mockLoad = jest.mocked(loadHostedSessionScript);

const TOKEN_SENTINEL = "ACCESS-TOKEN-SENTINEL";
const SESSION_SENTINEL = "SESSION-ID-SENTINEL";
const CARD_SENTINEL = "CARD-NUMBER-SENTINEL";
const SCRIPT_URL = "https://eazypay.gateway.mastercard.com/form/version/100/merchant/M1/session.js";

const PROFILE: CustomerMeResponse = {
    id: "c1", phone: "97333111222", preferredBranchId: null, name: "Sara",
    address: null, amountOfOrders: 3, lastOrderDate: null,
};

class FakeSdk implements PaymentSessionStatic {
    options: PaymentSessionConfigureOptions | null = null;
    configureCalls = 0;
    configure = jest.fn<void, [PaymentSessionConfigureOptions]>(options => {
        this.options = options;
        this.configureCalls += 1;
    });
    updateSessionFromForm = jest.fn<void, ["card"]>();
}

let sdk: FakeSdk;

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

type Overrides = { isAdmin?: boolean; isKiosk?: boolean; cartItems?: CartItem[]; orderType?: string };

function makeParams(overrides: Overrides = {}) {
    return {
        isAdmin: overrides.isAdmin ?? false,
        isKiosk: overrides.isKiosk ?? false,
        cartOpen: true,
        cartItems: overrides.cartItems ?? [makeItem()],
        orderType: overrides.orderType ?? "Pick Up",
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

async function renderReady(overrides: Overrides = {}) {
    const params = makeParams(overrides);
    const hook = renderHook(() => useCardCheckout(params), { wrapper });
    await waitFor(() => expect(mockRefreshToken).toHaveBeenCalled());
    return { ...hook, params };
}

async function renderAvailable(overrides: Overrides = {}) {
    const rendered = await renderReady(overrides);
    await waitFor(() => expect(rendered.result.current.available).toBe(true));
    return rendered;
}

type Rendered = Awaited<ReturnType<typeof renderAvailable>>;

// Starts the flow and mounts the (fake) drawer field container, as MUI's portal would.
async function startAndMount(rendered: Rendered): Promise<void> {
    act(() => { rendered.result.current.start(); });
    await waitFor(() => expect(mockCreateSession).toHaveBeenCalled());
    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    await act(async () => { rendered.result.current.fieldContainerRef(document.createElement("div")); });
    await waitFor(() => expect(sdk.configure).toHaveBeenCalled());
}

async function startReady(rendered: Rendered): Promise<void> {
    await startAndMount(rendered);
    await act(async () => { sdk.options?.callbacks.initialized({ status: "ok" }); });
    await waitFor(() => expect(rendered.result.current.step).toBe("ready"));
}

// A result carrying card-derived data, as the real SDK does, to prove none of it is read or logged.
function updateResultWithSourceOfFunds(): HostedSessionUpdateResult {
    const raw = {
        status: "ok" as const,
        session: { id: SESSION_SENTINEL },
        sourceOfFunds: { provided: { card: { number: CARD_SENTINEL } } },
    };
    return raw;
}

async function submitOk(rendered: Rendered): Promise<void> {
    act(() => { rendered.result.current.submit(); });
    await act(async () => { sdk.options?.callbacks.formSessionUpdate(updateResultWithSourceOfFunds()); });
}

function payResponse(status: CardPaymentResponse["status"], reason: CardPaymentResponse["reason"] = null): CardPaymentResponse {
    return { orderId: 4821, status, reason, amount: "5.000", currency: "BHD" };
}

let consoleSpies: Array<ReturnType<typeof jest.spyOn>>;

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    sdk = new FakeSdk();
    __resetCustomerAuthStoreForTests();
    mockRefreshToken.mockReset();
    mockRefreshToken.mockResolvedValue({ accessToken: TOKEN_SENTINEL, isNewAccount: false });
    mockMe.mockReset();
    mockMe.mockResolvedValue(PROFILE);
    mockEligibility.mockReset();
    mockEligibility.mockResolvedValue({ enabled: true });
    mockBanned.mockReset();
    mockBanned.mockResolvedValue([]);
    mockCreateOrder.mockReset();
    mockCreateOrder.mockResolvedValue({ orderId: 4821, amount: "5.000", currency: "BHD", status: "Pending Payment" });
    mockCreateSession.mockReset();
    mockCreateSession.mockResolvedValue({ sessionId: SESSION_SENTINEL, scriptUrl: SCRIPT_URL, apiVersion: "100" });
    mockLoad.mockReset();
    mockLoad.mockResolvedValue(sdk);
    mockPay.mockReset();
    mockPay.mockResolvedValue(payResponse("APPROVED"));
    mockStatus.mockReset();
    consoleSpies = [
        jest.spyOn(console, "error").mockImplementation(() => undefined),
        jest.spyOn(console, "warn").mockImplementation(() => undefined),
        jest.spyOn(console, "log").mockImplementation(() => undefined),
        jest.spyOn(console, "info").mockImplementation(() => undefined),
    ];
});

afterEach(() => {
    delete window.fbq;
    delete window.ttq;
    jest.useRealTimers();
});

describe("useCardCheckout — button visibility", () => {
    it("is available when every condition holds", async () => {
        const { result } = await renderReady();

        await waitFor(() => expect(result.current.available).toBe(true));
    });

    it("is hidden when ineligible", async () => {
        mockEligibility.mockResolvedValue({ enabled: false });
        const { result } = await renderReady();

        await waitFor(() => expect(mockEligibility).toHaveBeenCalled());
        expect(result.current.available).toBe(false);
    });

    it("is hidden when the customer is banned", async () => {
        mockBanned.mockResolvedValue([{ id: 1, telephoneNo: PROFILE.phone }]);
        const { result } = await renderReady();

        await waitFor(() => expect(mockBanned).toHaveBeenCalled());
        expect(result.current.available).toBe(false);
    });

    it("is hidden when the customer has no name", async () => {
        mockMe.mockResolvedValue({ ...PROFILE, name: "" });
        const { result } = await renderReady();

        await waitFor(() => expect(mockMe).toHaveBeenCalled());
        expect(result.current.available).toBe(false);
    });

    it("is hidden for admin and kiosk and does not prefetch", async () => {
        const admin = await renderReady({ isAdmin: true });
        const kiosk = await renderReady({ isKiosk: true });

        expect(admin.result.current.available).toBe(false);
        expect(kiosk.result.current.available).toBe(false);
        expect(mockEligibility).not.toHaveBeenCalled();
    });

    it("is hidden with an empty cart", async () => {
        const { result } = await renderReady({ cartItems: [] });

        await waitFor(() => expect(mockEligibility).toHaveBeenCalled());
        expect(result.current.available).toBe(false);
    });
});

describe("useCardCheckout — happy path", () => {
    it("creates the order, session, loads the script, configures, pays and completes", async () => {
        const rendered = await renderAvailable();
        const { result, params } = rendered;
        window.fbq = jest.fn();

        await startReady(rendered);
        expect(result.current.drawerOpen).toBe(true);
        expect(mockLoad).toHaveBeenCalledWith(SCRIPT_URL, "100");

        await submitOk(rendered);

        await waitFor(() => expect(params.setCartItems).toHaveBeenCalledWith([]));
        expect(sdk.updateSessionFromForm).toHaveBeenCalledWith("card");
        expect(params.setPaymentMethod).toHaveBeenCalled();
        expect(params.setOrderType).toHaveBeenCalledWith("Pick Up");
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
        expect(result.current.drawerOpen).toBe(false);
        expect(result.current.busy).toBe(false);
    });

    it("configures the four hosted fields with the javascript frame mitigation and no nameOnCard", async () => {
        const rendered = await renderAvailable();

        await startAndMount(rendered);

        const options = sdk.options;
        expect(options?.session).toBe(SESSION_SENTINEL);
        expect(options?.frameEmbeddingMitigation).toEqual(["javascript"]);
        expect(options?.fields.card).toEqual({
            number: "#card-number",
            securityCode: "#security-code",
            expiryMonth: "#expiry-month",
            expiryYear: "#expiry-year",
        });
    });

    it("sends the order with payment_type Card and no card field, then pays with the session id and no amount", async () => {
        const rendered = await renderAvailable();
        await startReady(rendered);
        await submitOk(rendered);
        await waitFor(() => expect(mockPay).toHaveBeenCalled());

        const [, orderRequest] = mockCreateOrder.mock.calls[0];
        expect(orderRequest.payment_type).toBe("Card");
        expect(JSON.stringify(orderRequest)).not.toContain(SESSION_SENTINEL);
        expect(JSON.stringify(orderRequest)).not.toContain(CARD_SENTINEL);
        const [token, orderId, payRequest] = mockPay.mock.calls[0];
        expect(token).toBe(TOKEN_SENTINEL);
        expect(orderId).toBe(4821);
        expect(payRequest.sessionId).toBe(SESSION_SENTINEL);
        expect(payRequest.attemptKey).toBeTruthy();
        expect(Object.keys(payRequest)).not.toContain("amount");
    });
});

describe("useCardCheckout — preparation failures", () => {
    it("aborts before the session when the order amount differs from the local total", async () => {
        mockCreateOrder.mockResolvedValue({ orderId: 4821, amount: "9.000", currency: "BHD", status: "Pending Payment" });
        const { result } = await renderAvailable();

        act(() => { result.current.start(); });

        await waitFor(() => expect(result.current.error).toContain("order total changed"));
        expect(mockCreateSession).not.toHaveBeenCalled();
        expect(result.current.drawerOpen).toBe(false);
        expect(result.current.busy).toBe(false);
    });

    it("refuses to configure when the page is framed", async () => {
        const original = Object.getOwnPropertyDescriptor(window, "top");
        Object.defineProperty(window, "top", { value: {}, configurable: true });
        try {
            const rendered = await renderAvailable();
            act(() => { rendered.result.current.start(); });

            await waitFor(() => expect(rendered.result.current.error).toContain("not available on this page"));
            await act(async () => { rendered.result.current.fieldContainerRef(document.createElement("div")); });
            expect(sdk.configure).not.toHaveBeenCalled();
            expect(rendered.result.current.drawerOpen).toBe(false);
        } finally {
            if (original) Object.defineProperty(window, "top", original);
            else Reflect.deleteProperty(window, "top");
        }
    });

    it("moves to needsNewSession with the script-failed message when the script cannot load", async () => {
        mockLoad.mockRejectedValue(new HostedSessionLoadError("HOSTED_SESSION_LOAD_FAILED"));
        const { result } = await renderAvailable();

        act(() => { result.current.start(); });

        await waitFor(() => expect(result.current.step).toBe("needsNewSession"));
        expect(result.current.error).toContain("could not be loaded");
        expect(result.current.drawerOpen).toBe(true);
    });

    it("reports a session failure and allows retry", async () => {
        mockCreateSession.mockRejectedValueOnce(new CardPaymentApiError("CARD_SESSION_FAILED", 502));
        const { result } = await renderAvailable();

        act(() => { result.current.start(); });
        await waitFor(() => expect(result.current.step).toBe("needsNewSession"));
        expect(result.current.error).toContain("could not be started");

        act(() => { result.current.retryWithNewSession(); });
        await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(2));
    });

    it("shows the retry message when initialisation reports system_error", async () => {
        const rendered = await renderAvailable();
        await startAndMount(rendered);

        await act(async () => { sdk.options?.callbacks.initialized({ status: "system_error" }); });

        expect(rendered.result.current.step).toBe("needsNewSession");
        expect(rendered.result.current.error).toContain("try again shortly");
    });

    it("reuses the existing handling for unavailable items and a closed branch", async () => {
        mockCreateOrder.mockRejectedValueOnce(new ItemsUnavailableError("gone", [7]));
        const first = await renderAvailable();
        act(() => { first.result.current.start(); });
        await waitFor(() => expect(first.params.setUnavailablePopupOpen).toHaveBeenCalledWith(true));
        expect(first.params.setCartItems).toHaveBeenCalledWith([]);
        expect(first.result.current.drawerOpen).toBe(false);

        mockCreateOrder.mockRejectedValueOnce(new BranchClosedError("closed"));
        const second = await renderAvailable();
        act(() => { second.result.current.start(); });
        await waitFor(() => expect(second.result.current.error).toBe("closed"));
    });
});

describe("useCardCheckout — submit", () => {
    it("shows field errors from the error keys only and makes no server call", async () => {
        const rendered = await renderAvailable();
        await startReady(rendered);

        act(() => { rendered.result.current.submit(); });
        await act(async () => {
            sdk.options?.callbacks.formSessionUpdate({
                status: "fields_in_error",
                errors: { cardNumber: "invalid card MESSAGE-SENTINEL", securityCode: "x" },
            });
        });

        expect(rendered.result.current.fieldErrors).toEqual({ cardNumber: true, securityCode: true });
        expect(rendered.result.current.step).toBe("ready");
        expect(JSON.stringify(rendered.result.current)).not.toContain("MESSAGE-SENTINEL");
        expect(mockPay).not.toHaveBeenCalled();
    });

    it.each(["system_error", "request_timeout"] as const)("returns to ready with the retry message on %s", async status => {
        const rendered = await renderAvailable();
        await startReady(rendered);

        act(() => { rendered.result.current.submit(); });
        await act(async () => { sdk.options?.callbacks.formSessionUpdate({ status }); });

        expect(rendered.result.current.step).toBe("ready");
        expect(rendered.result.current.error).toContain("try again shortly");
        expect(mockPay).not.toHaveBeenCalled();
    });

    it("makes one pay call for a double submit", async () => {
        const rendered = await renderAvailable();
        await startReady(rendered);

        act(() => {
            rendered.result.current.submit();
            rendered.result.current.submit();
        });
        await act(async () => { sdk.options?.callbacks.formSessionUpdate(updateResultWithSourceOfFunds()); });
        await act(async () => { sdk.options?.callbacks.formSessionUpdate(updateResultWithSourceOfFunds()); });

        await waitFor(() => expect(mockPay).toHaveBeenCalledTimes(1));
        expect(sdk.updateSessionFromForm).toHaveBeenCalledTimes(1);
    });

    it("sends exactly one pay when formSessionUpdate fires twice while the pay is in flight", async () => {
        mockPay.mockReturnValue(new Promise(() => undefined));
        const rendered = await renderAvailable();
        await startReady(rendered);

        act(() => { rendered.result.current.submit(); });
        await act(async () => { sdk.options?.callbacks.formSessionUpdate(updateResultWithSourceOfFunds()); });
        await act(async () => { sdk.options?.callbacks.formSessionUpdate(updateResultWithSourceOfFunds()); });

        expect(mockPay).toHaveBeenCalledTimes(1);
        expect(rendered.result.current.step).toBe("paying");
    });

    it("ignores submit before the form is ready", async () => {
        const rendered = await renderAvailable();
        await startAndMount(rendered);

        act(() => { rendered.result.current.submit(); });

        expect(sdk.updateSessionFromForm).not.toHaveBeenCalled();
    });
});

describe("useCardCheckout — decline and retry", () => {
    it.each([
        ["DECLINED", "was declined"],
        ["AUTHENTICATION_REQUIRED", "extra authentication"],
        ["REJECTED", "was rejected"],
    ] as const)("shows the %s message and needs a new session", async (reason, text) => {
        mockPay.mockResolvedValue(payResponse("DECLINED", reason));
        const rendered = await renderAvailable();
        await startReady(rendered);

        await submitOk(rendered);

        await waitFor(() => expect(rendered.result.current.step).toBe("needsNewSession"));
        expect(rendered.result.current.error).toContain(text);
        expect(rendered.result.current.drawerOpen).toBe(true);
    });

    it("retry creates a new session and every submit uses a fresh attemptKey", async () => {
        mockPay.mockResolvedValueOnce(payResponse("DECLINED", "DECLINED"));
        const rendered = await renderAvailable();
        await startReady(rendered);
        await submitOk(rendered);
        await waitFor(() => expect(rendered.result.current.step).toBe("needsNewSession"));
        mockCreateSession.mockResolvedValueOnce({ sessionId: "SECOND-SESSION", scriptUrl: SCRIPT_URL, apiVersion: "100" });

        act(() => { rendered.result.current.retryWithNewSession(); });
        await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(sdk.configureCalls).toBe(2));
        await act(async () => { sdk.options?.callbacks.initialized({ status: "ok" }); });
        await submitOk(rendered);

        await waitFor(() => expect(mockPay).toHaveBeenCalledTimes(2));
        expect(mockCreateSession.mock.calls[1][1]).toBe(4821);
        expect(mockPay.mock.calls[1][2].sessionId).toBe("SECOND-SESSION");
        expect(mockPay.mock.calls[1][2].attemptKey).not.toBe(mockPay.mock.calls[0][2].attemptKey);
    });
});

describe("useCardCheckout — pending and polling", () => {
    async function reachPending(): Promise<Rendered> {
        mockPay.mockResolvedValue(payResponse("PENDING"));
        const rendered = await renderAvailable();
        await startReady(rendered);
        jest.useFakeTimers();
        await submitOk(rendered);
        return rendered;
    }

    async function tick(ms: number): Promise<void> {
        await act(async () => { jest.advanceTimersByTime(ms); });
    }

    it("closes the drawer, shows the notice and polls until APPROVED", async () => {
        const rendered = await reachPending();
        mockStatus.mockResolvedValueOnce(payResponse("PENDING")).mockResolvedValueOnce(payResponse("APPROVED"));

        expect(rendered.result.current.notice).toContain("confirming your payment");
        expect(rendered.result.current.drawerOpen).toBe(false);
        expect(rendered.result.current.busy).toBe(true);
        await tick(3000);
        await tick(3000);

        expect(mockStatus).toHaveBeenCalledTimes(2);
        expect(rendered.params.setCartItems).toHaveBeenCalledWith([]);
        expect(rendered.result.current.notice).toBeNull();
        expect(rendered.result.current.busy).toBe(false);
    });

    it("unblocks with the decline message when polling resolves DECLINED", async () => {
        const rendered = await reachPending();
        mockStatus.mockResolvedValue(payResponse("DECLINED", "REJECTED"));

        await tick(3000);

        expect(rendered.result.current.error).toContain("was rejected");
        expect(rendered.result.current.busy).toBe(false);
    });

    it("shows a persistent notice after the poll timeout and keeps start blocked", async () => {
        const rendered = await reachPending();
        mockStatus.mockResolvedValue(payResponse("PENDING"));

        for (let i = 0; i < 52; i++) await tick(3000);

        expect(rendered.result.current.notice).toContain("could not confirm your payment yet");
        expect(rendered.result.current.busy).toBe(true);
        mockCreateOrder.mockClear();
        act(() => { rendered.result.current.start(); });
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("shows the review notice for REVIEW", async () => {
        mockPay.mockResolvedValue(payResponse("REVIEW"));
        const rendered = await renderAvailable();
        await startReady(rendered);

        await submitOk(rendered);

        await waitFor(() => expect(rendered.result.current.notice).toContain("manual check"));
        expect(rendered.result.current.busy).toBe(true);
    });

    it("polls instead of resubmitting after an ambiguous pay error", async () => {
        mockPay.mockRejectedValue(new CardPaymentApiError("CARD_UNKNOWN_ERROR", 502));
        const rendered = await renderAvailable();
        await startReady(rendered);
        jest.useFakeTimers();
        mockStatus.mockResolvedValue(payResponse("APPROVED"));

        await submitOk(rendered);
        await tick(3000);

        expect(mockPay).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(rendered.params.setCartItems).toHaveBeenCalledWith([]);
    });

    it("unblocks after a definitive rejection without polling", async () => {
        mockPay.mockRejectedValue(new CardPaymentApiError("CARD_ORDER_NOT_PAYABLE", 409));
        const rendered = await renderAvailable();
        await startReady(rendered);

        await submitOk(rendered);

        await waitFor(() => expect(rendered.result.current.busy).toBe(false));
        expect(rendered.result.current.error).toContain("could not be completed");
        expect(mockStatus).not.toHaveBeenCalled();
    });
});

describe("useCardCheckout — drawer lifecycle", () => {
    it("reuses the order idempotency key when re-opened with an unchanged cart", async () => {
        const rendered = await renderAvailable();
        await startReady(rendered);
        act(() => { rendered.result.current.closeDrawer(); });
        await waitFor(() => expect(rendered.result.current.busy).toBe(false));

        act(() => { rendered.result.current.start(); });
        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledTimes(2));

        expect(mockCreateOrder.mock.calls[1][1].idempotency_key).toBe(mockCreateOrder.mock.calls[0][1].idempotency_key);
    });

    it("uses a fresh idempotency key for an identical cart after a payment was approved", async () => {
        const rendered = await renderAvailable();
        await startReady(rendered);
        await submitOk(rendered);
        await waitFor(() => expect(rendered.result.current.busy).toBe(false));
        expect(mockPay).toHaveBeenCalledTimes(1);

        act(() => { rendered.result.current.start(); });
        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledTimes(2));

        expect(mockCreateOrder.mock.calls[1][1].idempotency_key).not.toBe(mockCreateOrder.mock.calls[0][1].idempotency_key);
    });

    it("ignores a second start while busy", async () => {
        const rendered = await renderAvailable();

        act(() => {
            rendered.result.current.start();
            rendered.result.current.start();
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledTimes(1));
    });

    it("cannot be closed while the payment is being sent", async () => {
        mockPay.mockReturnValue(new Promise(() => undefined));
        const rendered = await renderAvailable();
        await startReady(rendered);
        await submitOk(rendered);
        await waitFor(() => expect(rendered.result.current.step).toBe("paying"));

        act(() => { rendered.result.current.closeDrawer(); });

        expect(rendered.result.current.drawerOpen).toBe(true);
    });
});

describe("useCardCheckout — logging", () => {
    it("never logs the session id, the update result or any card-derived value", async () => {
        mockPay.mockRejectedValueOnce(new CardPaymentApiError("CARD_UNKNOWN_ERROR", 502));
        mockStatus.mockResolvedValue(payResponse("PENDING"));
        const rendered = await renderAvailable();
        await startReady(rendered);
        await submitOk(rendered);
        await waitFor(() => expect(mockPay).toHaveBeenCalled());

        const logged = consoleSpies.flatMap(spy => spy.mock.calls).map(args => JSON.stringify(args)).join("\n");
        expect(logged).not.toContain(SESSION_SENTINEL);
        expect(logged).not.toContain(CARD_SENTINEL);
        expect(logged).not.toContain("sourceOfFunds");
        expect(logged).not.toContain(TOKEN_SENTINEL);
    });
});

describe("useCardCheckout — audit additions", () => {
    it("shows the retry message when initialisation reports request_timeout", async () => {
        const rendered = await renderAvailable();
        await startAndMount(rendered);

        await act(async () => { sdk.options?.callbacks.initialized({ status: "request_timeout" }); });

        expect(rendered.result.current.step).toBe("needsNewSession");
        expect(rendered.result.current.error).toContain("try again shortly");
    });

    it.each([
        "CARD_INVALID_REQUEST", "CARD_NOT_AVAILABLE", "CARD_ORDER_NOT_PAYABLE", "CARD_INVALID_AMOUNT",
    ])("treats %s as definitive: unblocks and never polls", async code => {
        mockPay.mockRejectedValue(new CardPaymentApiError(code, 409));
        const rendered = await renderAvailable();
        await startReady(rendered);

        await submitOk(rendered);

        await waitFor(() => expect(rendered.result.current.busy).toBe(false));
        expect(mockStatus).not.toHaveBeenCalled();
        expect(mockPay).toHaveBeenCalledTimes(1);
    });

    it("keeps start blocked and never resubmits while an ambiguous pay error is being polled", async () => {
        mockPay.mockRejectedValue(new CardPaymentApiError("CARD_UNKNOWN_ERROR", 502));
        mockStatus.mockResolvedValue(payResponse("PENDING"));
        const rendered = await renderAvailable();
        await startReady(rendered);
        jest.useFakeTimers();

        await submitOk(rendered);
        await act(async () => { jest.advanceTimersByTime(3000); });

        expect(rendered.result.current.busy).toBe(true);
        expect(rendered.result.current.notice).toContain("confirming your payment");
        mockCreateOrder.mockClear();
        act(() => { rendered.result.current.start(); });
        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(mockPay).toHaveBeenCalledTimes(1);
        expect(sdk.updateSessionFromForm).toHaveBeenCalledTimes(1);
    });

    it("retry after a decline reuses the same order and does not create another", async () => {
        mockPay.mockResolvedValueOnce(payResponse("DECLINED", "DECLINED"));
        const rendered = await renderAvailable();
        await startReady(rendered);
        await submitOk(rendered);
        await waitFor(() => expect(rendered.result.current.step).toBe("needsNewSession"));

        act(() => { rendered.result.current.retryWithNewSession(); });
        await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(2));

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    it("amount mismatch also never loads the script, configures or pays", async () => {
        mockCreateOrder.mockResolvedValue({ orderId: 4821, amount: "9.000", currency: "BHD", status: "Pending Payment" });
        const { result } = await renderAvailable();

        act(() => { result.current.start(); });
        await waitFor(() => expect(result.current.error).toContain("order total changed"));

        expect(mockLoad).not.toHaveBeenCalled();
        expect(sdk.configure).not.toHaveBeenCalled();
        expect(mockPay).not.toHaveBeenCalled();
    });

    it("never logs the session id or any update-result field across field-error, system-error and decline paths", async () => {
        const leakyErrors = { cardNumber: `${CARD_SENTINEL} bad`, securityCode: `${CARD_SENTINEL} cvv` };
        mockPay.mockResolvedValueOnce(payResponse("DECLINED", "DECLINED"));
        const rendered = await renderAvailable();
        await startReady(rendered);

        act(() => { rendered.result.current.submit(); });
        await act(async () => {
            sdk.options?.callbacks.formSessionUpdate({ status: "fields_in_error", errors: leakyErrors });
        });
        act(() => { rendered.result.current.submit(); });
        await act(async () => { sdk.options?.callbacks.formSessionUpdate({ status: "system_error" }); });
        await submitOk(rendered);
        await waitFor(() => expect(rendered.result.current.step).toBe("needsNewSession"));
        act(() => { rendered.result.current.retryWithNewSession(); });
        await waitFor(() => expect(sdk.configureCalls).toBe(2));
        await act(async () => { sdk.options?.callbacks.initialized({ status: "system_error" }); });

        const calls = consoleSpies.flatMap(spy => spy.mock.calls);
        expect(calls.length).toBeGreaterThan(0);
        const logged = calls.map(args => JSON.stringify(args)).join("\n");
        for (const secret of [SESSION_SENTINEL, CARD_SENTINEL, "sourceOfFunds", TOKEN_SENTINEL]) {
            expect(logged).not.toContain(secret);
        }
    });
});
