import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
    refreshCustomerToken,
    verifyOtp,
    fetchCustomerMe,
    fetchApplePayEligibility,
    requestApplePayMerchantSession,
    createApplePayOrder,
    payApplePayOrder,
    fetchApplePayPaymentStatus,
} from "../../../shared/api/customerAuth";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import { writeChosenBranch } from "../../branch/utils/customerBranch";
import {
    CustomerAuthProvider,
    useCustomerAuth,
    __resetCustomerAuthStoreForTests,
} from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider } from "../../customer-auth/context/CustomerAuthUiProvider";
import "../../../shared/i18n";
import { useApplePayCheckout } from "./useApplePayCheckout";
import { ApplePayApiError } from "../applePayTypes";
import type { ApplePayPaymentResponse } from "../applePayTypes";
import { BranchClosedError, ItemsUnavailableError } from "../types";
import type { CartItem } from "../../menu/types";
import type { CustomerMeResponse } from "../../customer-auth/types";
import type { IBranch } from "../../management/inventory/types";

jest.mock("../../../shared/api/customerAuth");
jest.mock("../../../shared/api/management");

const mockRefreshToken = jest.mocked(refreshCustomerToken);
const mockMe = jest.mocked(fetchCustomerMe);
const mockEligibility = jest.mocked(fetchApplePayEligibility);
const mockMerchantSession = jest.mocked(requestApplePayMerchantSession);
const mockCreateOrder = jest.mocked(createApplePayOrder);
const mockPay = jest.mocked(payApplePayOrder);
const mockStatus = jest.mocked(fetchApplePayPaymentStatus);
const mockBanned = jest.mocked(getAllBannedCstmrs);

const TOKEN_SENTINEL = "ACCESS-TOKEN-SENTINEL";
const PAYMENT_DATA_SENTINEL = "PAYMENT-DATA-SENTINEL";

class FakeApplePaySession implements ApplePaySessionInstance {
    static instances: FakeApplePaySession[] = [];
    static canPay = true;
    static readonly STATUS_SUCCESS = 0;
    static readonly STATUS_FAILURE = 1;
    static throwOnConstruct = false;
    static canMakePayments(): boolean { return FakeApplePaySession.canPay; }
    static supportsVersion(): boolean { return true; }

    onvalidatemerchant: ((event: ApplePayValidateMerchantEvent) => void) | null = null;
    onpaymentauthorized: ((event: ApplePayPaymentAuthorizedEvent) => void) | null = null;
    oncancel: (() => void) | null = null;
    begin = jest.fn<void, []>();
    abort = jest.fn<void, []>();
    completeMerchantValidation = jest.fn<void, [unknown]>();
    completePayment = jest.fn<void, [number]>();

    constructor(public version: number, public request: ApplePayPaymentRequest) {
        if (FakeApplePaySession.throwOnConstruct) throw new Error("active session");
        FakeApplePaySession.instances.push(this);
    }
}

function installFakeSession(): void {
    FakeApplePaySession.instances = [];
    FakeApplePaySession.canPay = true;
    FakeApplePaySession.throwOnConstruct = false;
    window.ApplePaySession = FakeApplePaySession;
}

const PROFILE: CustomerMeResponse = {
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
    const hook = renderHook(() => useApplePayCheckout(params), { wrapper });
    await waitFor(() => expect(mockRefreshToken).toHaveBeenCalled());
    return { ...hook, params };
}

async function renderAvailable(overrides: Overrides = {}) {
    const rendered = await renderReady(overrides);
    await waitFor(() => expect(rendered.result.current.available).toBe(true));
    return rendered;
}

// Opens the sheet and returns the (single) fake session.
function tapAndGetSession(start: () => void): FakeApplePaySession {
    act(() => { start(); });
    return FakeApplePaySession.instances[0];
}

function authorizedEvent(): ApplePayPaymentAuthorizedEvent {
    return { payment: { token: { paymentData: { data: PAYMENT_DATA_SENTINEL } } } };
}

async function authorize(session: FakeApplePaySession): Promise<void> {
    await act(async () => { session.onpaymentauthorized?.(authorizedEvent()); });
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

let consoleSpies: Array<ReturnType<typeof jest.spyOn>>;

beforeEach(() => {
    installFakeSession();
    __resetCustomerAuthStoreForTests();
    localStorage.clear();
    mockRefreshToken.mockReset();
    mockRefreshToken.mockResolvedValue({ accessToken: TOKEN_SENTINEL, isNewAccount: false });
    mockMe.mockReset();
    mockMe.mockResolvedValue(PROFILE);
    mockEligibility.mockReset();
    mockEligibility.mockResolvedValue({ enabled: true });
    mockBanned.mockReset();
    mockBanned.mockResolvedValue([]);
    mockMerchantSession.mockReset();
    mockMerchantSession.mockResolvedValue({ merchantSessionIdentifier: "ms" });
    mockCreateOrder.mockReset();
    mockCreateOrder.mockResolvedValue({ orderId: 4821, amount: "5.000", currency: "BHD", status: "Pending Payment" });
    mockPay.mockReset();
    mockPay.mockResolvedValue({ orderId: 4821, status: "APPROVED", amount: "5.000", currency: "BHD" });
    mockStatus.mockReset();
    consoleSpies = [
        jest.spyOn(console, "error").mockImplementation(() => undefined),
        jest.spyOn(console, "warn").mockImplementation(() => undefined),
        jest.spyOn(console, "log").mockImplementation(() => undefined),
        jest.spyOn(console, "info").mockImplementation(() => undefined),
    ];
});

afterEach(() => {
    delete window.ApplePaySession;
    delete window.fbq;
    delete window.ttq;
    jest.useRealTimers();
});

describe("useApplePayCheckout — button visibility", () => {
    it("is available when every condition holds", async () => {
        const { result } = await renderReady();

        await waitFor(() => expect(result.current.available).toBe(true));
    });

    it("is hidden when there is no ApplePaySession", async () => {
        delete window.ApplePaySession;

        const { result } = await renderReady();

        expect(result.current.available).toBe(false);
        expect(mockEligibility).not.toHaveBeenCalled();
    });

    it("is hidden when canMakePayments() is false", async () => {
        FakeApplePaySession.canPay = false;

        const { result } = await renderReady();

        expect(result.current.available).toBe(false);
    });

    it("is hidden when eligibility says disabled", async () => {
        mockEligibility.mockResolvedValue({ enabled: false });

        const { result } = await renderReady();
        await waitFor(() => expect(mockEligibility).toHaveBeenCalled());

        expect(result.current.available).toBe(false);
    });

    it("is hidden when the eligibility request rejects", async () => {
        mockEligibility.mockRejectedValue(new ApplePayApiError("APPLE_PAY_NOT_AVAILABLE", 404));

        const { result } = await renderReady();
        await waitFor(() => expect(mockEligibility).toHaveBeenCalled());

        expect(result.current.available).toBe(false);
    });

    it("is hidden for a guest (no customer token)", async () => {
        mockRefreshToken.mockRejectedValue(new Error("no session"));

        const { result } = await renderReady();

        expect(result.current.available).toBe(false);
        expect(mockEligibility).not.toHaveBeenCalled();
    });

    it("is hidden when the phone is blacklisted", async () => {
        mockBanned.mockResolvedValue([{ id: 1, telephoneNo: PROFILE.phone }]);

        const { result } = await renderReady();
        await waitFor(() => expect(mockBanned).toHaveBeenCalled());

        expect(result.current.available).toBe(false);
    });

    it("is hidden when the profile has no name", async () => {
        mockMe.mockResolvedValue({ ...PROFILE, name: null });

        const { result } = await renderReady();
        await waitFor(() => expect(mockMe).toHaveBeenCalled());

        expect(result.current.available).toBe(false);
    });

    it("is hidden when the cart is empty", async () => {
        const { result } = await renderReady({ cartItems: [] });
        await waitFor(() => expect(mockEligibility).toHaveBeenCalled());

        expect(result.current.available).toBe(false);
    });

    it("is hidden for admin", async () => {
        const { result } = await renderReady({ isAdmin: true });

        expect(result.current.available).toBe(false);
        expect(mockEligibility).not.toHaveBeenCalled();
    });

    it("is hidden for kiosk", async () => {
        const { result } = await renderReady({ isKiosk: true });

        expect(result.current.available).toBe(false);
        expect(mockEligibility).not.toHaveBeenCalled();
    });
});

describe("useApplePayCheckout — token change", () => {
    it("hides the button and ignores the previous customer's prefetch until the new token's prefetch lands", async () => {
        mockMe.mockResolvedValue({ ...PROFILE, amountOfOrders: 0 });
        const params = makeParams();
        const { result } = renderHook(
            () => ({ checkout: useApplePayCheckout(params), auth: useCustomerAuth() }),
            { wrapper },
        );
        await waitFor(() => expect(result.current.checkout.available).toBe(true));
        let resolveProfile: (profile: CustomerMeResponse) => void = () => undefined;
        mockMe.mockReturnValue(new Promise<CustomerMeResponse>(resolve => { resolveProfile = resolve; }));
        jest.mocked(verifyOtp).mockResolvedValue({ accessToken: "TOKEN-B", isNewAccount: false });

        await act(async () => { await result.current.auth.login("97300000000", "1234"); });

        expect(result.current.checkout.available).toBe(false);
        act(() => { result.current.checkout.start(); });
        expect(FakeApplePaySession.instances).toHaveLength(0);
        expect(result.current.checkout.reminderOpen).toBe(false);

        await act(async () => { resolveProfile({ ...PROFILE, name: "Omar", amountOfOrders: 5 }); });
        await waitFor(() => expect(result.current.checkout.available).toBe(true));
    });
});

describe("useApplePayCheckout — gesture", () => {
    it("constructs the session and calls begin() in the same synchronous tick as the tap", async () => {
        const { result } = await renderAvailable();

        act(() => { result.current.start(); });

        expect(FakeApplePaySession.instances).toHaveLength(1);
        expect(FakeApplePaySession.instances[0].begin).toHaveBeenCalledTimes(1);
        expect(FakeApplePaySession.instances[0].version).toBe(6);
        expect(FakeApplePaySession.instances[0].request.total.amount).toBe("5.000");
    });

    it("creates exactly one session on a double tap", async () => {
        const { result } = await renderAvailable();

        act(() => { result.current.start(); result.current.start(); });

        expect(FakeApplePaySession.instances).toHaveLength(1);
    });

    it("creates no second session when tapped while a session is active", async () => {
        const { result } = await renderAvailable();
        act(() => { result.current.start(); });

        act(() => { result.current.start(); });

        expect(FakeApplePaySession.instances).toHaveLength(1);
    });

    it("allows a new session after the customer cancels the sheet", async () => {
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        act(() => { session.oncancel?.(); });
        act(() => { result.current.start(); });

        expect(FakeApplePaySession.instances).toHaveLength(2);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    // Outside Safari, Apple's SDK shows its QR and focuses it inside begin() itself from the second
    // session of a page load. The payment page lets go of focus on the busy render, so that render
    // must already be committed by then, or the page pulls focus straight back from the QR.
    it("commits busy before begin(), so the page has let go of focus when Apple's QR takes it", async () => {
        const { result } = await renderAvailable();
        const busyAtBegin: boolean[] = [];
        class BusyProbeSession extends FakeApplePaySession {
            begin = jest.fn<void, []>(() => { busyAtBegin.push(result.current.busy); });
        }
        window.ApplePaySession = BusyProbeSession;

        act(() => { result.current.start(); });

        expect(busyAtBegin).toEqual([true]);
    });

    it("reports sessionFailed and unlocks when the constructor throws", async () => {
        const { result } = await renderAvailable();
        FakeApplePaySession.throwOnConstruct = true;

        act(() => { result.current.start(); });

        expect(result.current.error).toBe("Apple Pay could not be started. Please try again.");
        expect(result.current.busy).toBe(false);
    });
});

describe("useApplePayCheckout — first-time customer reminder", () => {
    it("shows the reminder and creates no session on tap, then opens it synchronously on continue", async () => {
        mockMe.mockResolvedValue({ ...PROFILE, amountOfOrders: 0 });
        const { result, params } = await renderAvailable();

        act(() => { result.current.start(); });

        expect(result.current.reminderOpen).toBe(true);
        expect(FakeApplePaySession.instances).toHaveLength(0);
        expect(params.setCartOpen).toHaveBeenCalledWith(false);

        act(() => { result.current.continueFromReminder(); });

        expect(FakeApplePaySession.instances).toHaveLength(1);
        expect(FakeApplePaySession.instances[0].begin).toHaveBeenCalledTimes(1);
        expect(result.current.reminderOpen).toBe(false);
    });

    it("dismissing the reminder reopens the cart and creates no session", async () => {
        mockMe.mockResolvedValue({ ...PROFILE, amountOfOrders: null });
        const { result, params } = await renderAvailable();
        act(() => { result.current.start(); });

        act(() => { result.current.dismissReminder(); });

        expect(result.current.reminderOpen).toBe(false);
        expect(params.setCartOpen).toHaveBeenLastCalledWith(true);
        expect(FakeApplePaySession.instances).toHaveLength(0);
    });

    it("skips the reminder for a returning customer", async () => {
        const { result } = await renderAvailable();

        act(() => { result.current.start(); });

        expect(result.current.reminderOpen).toBe(false);
        expect(FakeApplePaySession.instances).toHaveLength(1);
    });
});

describe("useApplePayCheckout — merchant validation", () => {
    it("calls the merchant-session API and completeMerchantValidation", async () => {
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await act(async () => { session.onvalidatemerchant?.({ validationURL: "https://apple-pay-gateway.apple.com/x" }); });

        expect(mockMerchantSession).toHaveBeenCalledWith(TOKEN_SENTINEL, "https://apple-pay-gateway.apple.com/x");
        expect(session.completeMerchantValidation).toHaveBeenCalledWith({ merchantSessionIdentifier: "ms" });
    });

    it("aborts and shows the localized error when validation fails", async () => {
        mockMerchantSession.mockRejectedValue(new ApplePayApiError("APPLE_PAY_MERCHANT_VALIDATION_FAILED", 502));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await act(async () => { session.onvalidatemerchant?.({ validationURL: "https://apple-pay-gateway.apple.com/x" }); });

        expect(session.abort).toHaveBeenCalledTimes(1);
        expect(result.current.error).toBe("Apple Pay could not verify the merchant. Please try again.");
        expect(result.current.busy).toBe(false);
    });
});

describe("useApplePayCheckout — authorization", () => {
    it("creates the order then pays; APPROVED clears the cart, opens order detail and fires pixels", async () => {
        const fbq = jest.fn<void, unknown[]>();
        const track = jest.fn<void, [string, Record<string, unknown>?]>();
        window.fbq = fbq;
        window.ttq = { track };
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        const [, order] = mockCreateOrder.mock.calls[0];
        expect(order.tel).toBe(PROFILE.phone);
        expect(order.type).toBe("Pick Up");
        expect(order.amount_paid).toBe(5);
        expect(order.idempotency_key).toBeTruthy();
        const [, payedOrderId, payBody] = mockPay.mock.calls[0];
        expect(payedOrderId).toBe(4821);
        expect(payBody.paymentToken).toBe(JSON.stringify({ data: PAYMENT_DATA_SENTINEL }));
        expect(payBody).not.toHaveProperty("amount");
        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_SUCCESS);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
        expect(fbq).toHaveBeenCalledWith("track", "Purchase", { value: 5, currency: "BHD" }, { eventID: "4821" });
        expect(track).toHaveBeenCalledWith("PlaceAnOrder", expect.objectContaining({ order_id: 4821 }));
        expect(result.current.busy).toBe(false);
    });

    it("passes the orderType state through as the order type (order-type-agnostic)", async () => {
        const { result } = await renderAvailable({ orderType: "Delivery" });
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(mockCreateOrder.mock.calls[0][1].type).toBe("Delivery");
    });

    it("never calls pay when the created order amount differs from the sheet total", async () => {
        mockCreateOrder.mockResolvedValue({ orderId: 4821, amount: "9.990", currency: "BHD", status: "Pending Payment" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(mockPay).not.toHaveBeenCalled();
        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
        expect(result.current.busy).toBe(false);
    });

    it("DECLINED fails the sheet, shows the error and keeps the cart", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "DECLINED", amount: "5.000", currency: "BHD" });
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
        expect(result.current.error).toBe("Your payment was declined. You were not charged.");
        expect(params.setCartItems).not.toHaveBeenCalled();
        expect(result.current.busy).toBe(false);
    });

    it("409 with unavailableIds shows the unavailable popup and removes the items", async () => {
        mockCreateOrder.mockRejectedValue(new ItemsUnavailableError("gone", [7]));
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
        expect(params.setUnavailableItems).toHaveBeenCalledWith(["Water"]);
        expect(params.setUnavailableMessage).toHaveBeenCalledWith("gone");
        expect(params.setUnavailablePopupOpen).toHaveBeenCalledWith(true);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(params.refreshMenu).toHaveBeenCalled();
    });

    it("423 shows the branch-closed message and refreshes the menu", async () => {
        mockCreateOrder.mockRejectedValue(new BranchClosedError("We are closed"));
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(result.current.error).toBe("We are closed");
        expect(params.refreshMenu).toHaveBeenCalled();
        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
    });

    it("maps APPLE_PAY_PAYMENT_IN_PROGRESS to the inProgress message", async () => {
        mockCreateOrder.mockRejectedValue(new ApplePayApiError("APPLE_PAY_PAYMENT_IN_PROGRESS", 409));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(result.current.error).toBe("A previous Apple Pay payment is still being confirmed. Please wait.");
    });

    it("maps any other create-order error to the generic message", async () => {
        mockCreateOrder.mockRejectedValue(new ApplePayApiError("APPLE_PAY_INVALID_REQUEST", 400));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(result.current.error).toBe("Apple Pay payment could not be completed. You were not charged.");
        expect(result.current.busy).toBe(false);
    });
});

describe("useApplePayCheckout — pickup branch", () => {
    it("files the order against the chosen pickup branch", async () => {
        writeChosenBranch(SAAR);
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(mockCreateOrder.mock.calls[0][1].branchId).toBe(SAAR.id);
    });

    it("uses the branch chosen after a mid-cart switch", async () => {
        const { result, rerender } = await renderAvailable();
        writeChosenBranch(SAAR);
        rerender();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(mockCreateOrder.mock.calls[0][1].branchId).toBe(SAAR.id);
    });

    it("falls back to DEFAULT_BRANCH_ID when no branch is stored", async () => {
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(mockCreateOrder.mock.calls[0][1].branchId).toBe(DEFAULT_BRANCH_ID);
    });
});

describe("useApplePayCheckout — PENDING", () => {
    it("fails the sheet, polls, resolves to success, and keeps the button blocked meanwhile", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockResolvedValueOnce({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockResolvedValueOnce({ orderId: 4821, status: "APPROVED", amount: "5.000", currency: "BHD" });
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();

        await authorize(session);

        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
        expect(result.current.notice).toBe("We are confirming your payment. Please do not pay again.");
        expect(result.current.busy).toBe(true);
        act(() => { result.current.start(); });
        expect(FakeApplePaySession.instances).toHaveLength(1);

        await act(async () => { jest.advanceTimersByTime(3000); });
        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(result.current.busy).toBe(true);
        await act(async () => { jest.advanceTimersByTime(3000); });

        expect(mockStatus).toHaveBeenCalledTimes(2);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(result.current.busy).toBe(false);
    });

    it("keeps polling past 120 s (backend NOT_FOUND grace) and still resolves to paid", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        for (let i = 0; i < 45; i++) {
            await act(async () => { jest.advanceTimersByTime(3000); });
        }
        expect(result.current.busy).toBe(true);
        mockStatus.mockResolvedValue({ orderId: 4821, status: "APPROVED", amount: "5.000", currency: "BHD" });
        await act(async () => { jest.advanceTimersByTime(3000); });

        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(result.current.busy).toBe(false);
    });

    it("stays blocked and shows the unresolved notice when the 150 s polling window runs out", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        for (let i = 0; i < 55; i++) {
            await act(async () => { jest.advanceTimersByTime(3000); });
        }
        const callsAtEnd = mockStatus.mock.calls.length;
        await act(async () => { jest.advanceTimersByTime(30000); });

        expect(result.current.busy).toBe(true);
        expect(result.current.notice).toContain("do not pay again");
        expect(result.current.notice).toContain("could not confirm");
        expect(mockStatus.mock.calls.length).toBe(callsAtEnd);
        act(() => { result.current.start(); });
        expect(FakeApplePaySession.instances).toHaveLength(1);
    });

    it("shows the unresolved notice when status polling errors until the window ends", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockRejectedValue(new TypeError("network"));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        for (let i = 0; i < 55; i++) {
            await act(async () => { jest.advanceTimersByTime(3000); });
        }

        expect(result.current.busy).toBe(true);
        expect(result.current.notice).toContain("could not confirm");
    });

    it("treats a transport error after the order was created as pending, not as a failure", async () => {
        mockPay.mockRejectedValue(new TypeError("network"));
        mockStatus.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();

        await authorize(session);

        expect(result.current.notice).toBe("We are confirming your payment. Please do not pay again.");
        expect(result.current.busy).toBe(true);
    });

    it.each([
        ["500", new ApplePayApiError("APPLE_PAY_UNKNOWN_ERROR", 500)],
        ["504", new ApplePayApiError("APPLE_PAY_UNKNOWN_ERROR", 504)],
    ])("a %s from pay with no token shows the pending notice, stays blocked and polls", async (_label, failure) => {
        mockPay.mockRejectedValue(failure);
        mockStatus.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();

        await authorize(session);

        expect(result.current.notice).toBe("We are confirming your payment. Please do not pay again.");
        expect(result.current.error).toBeNull();
        expect(result.current.busy).toBe(true);
        await act(async () => { jest.advanceTimersByTime(3000); });
        expect(mockStatus).toHaveBeenCalledWith(TOKEN_SENTINEL, 4821);
    });

    it.each([
        "APPLE_PAY_INVALID_REQUEST",
        "APPLE_PAY_NOT_AVAILABLE",
        "APPLE_PAY_ORDER_NOT_PAYABLE",
        "APPLE_PAY_INVALID_AMOUNT",
    ])("a definitive %s rejection from pay shows the generic error and unblocks", async code => {
        mockPay.mockRejectedValue(new ApplePayApiError(code, 400));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(result.current.error).toBe("Apple Pay payment could not be completed. You were not charged.");
        expect(result.current.notice).toBeNull();
        expect(result.current.busy).toBe(false);
        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("keeps the pending notice when the transient error is cleared and after 8 s", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        act(() => { result.current.clearError(); });
        await act(async () => { jest.advanceTimersByTime(9000); });

        expect(result.current.notice).toBe("We are confirming your payment. Please do not pay again.");
    });

    it("REVIEW fails the sheet and keeps the button blocked", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "REVIEW", amount: "5.000", currency: "BHD" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_FAILURE);
        expect(result.current.notice).toBe("Your payment needs a manual check. Please contact the restaurant.");
        expect(result.current.busy).toBe(true);
    });
});

describe("useApplePayCheckout — cancel while authorizing", () => {
    const PENDING: ApplePayPaymentResponse = { orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" };
    const APPROVED: ApplePayPaymentResponse = { ...PENDING, status: "APPROVED" };
    const PENDING_NOTICE = "We are confirming your payment. Please do not pay again.";

    type Deferred<T> = { resolve: (value: T) => void; reject: (reason: unknown) => void };

    // Holds pay in flight so the cancel can land between the customer's authorization and its result.
    function deferPay(): Deferred<ApplePayPaymentResponse> {
        const deferred: Deferred<ApplePayPaymentResponse> = { resolve: () => undefined, reject: () => undefined };
        mockPay.mockReturnValue(new Promise<ApplePayPaymentResponse>((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
        }));
        return deferred;
    }

    // WebKit: once the sheet was cancelled or timed out, completePayment throws InvalidAccessError.
    // authorize() runs fire-and-forget, so a throw escaping it is an unhandled rejection, and
    // jest-circus fails the running test on one; that is what these tests catch.
    function cancelSafariSheet(session: FakeApplePaySession): void {
        session.completePayment.mockImplementation(() => {
            throw new DOMException("The payment session is no longer active.", "InvalidAccessError");
        });
        act(() => { session.oncancel?.(); });
    }

    it("a cancel before the customer authorizes still unlocks the button", async () => {
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        act(() => { session.oncancel?.(); });

        expect(result.current.busy).toBe(false);
        act(() => { result.current.start(); });
        expect(FakeApplePaySession.instances).toHaveLength(2);
    });

    it("a cancel while pay is in flight keeps the button locked; PENDING then shows the notice and polls", async () => {
        const pay = deferPay();
        mockStatus.mockResolvedValue(APPROVED);
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        act(() => { session.oncancel?.(); });

        expect(result.current.busy).toBe(true);
        act(() => { result.current.start(); });
        expect(FakeApplePaySession.instances).toHaveLength(1);
        await act(async () => { pay.resolve(PENDING); });
        expect(result.current.notice).toBe(PENDING_NOTICE);
        expect(result.current.busy).toBe(true);
        await act(async () => { jest.advanceTimersByTime(3000); });
        expect(mockStatus).toHaveBeenCalledWith(TOKEN_SENTINEL, 4821);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(result.current.busy).toBe(false);
    });

    // Outside Safari, Apple's SDK fires oncancel on every QR close but a success close, so the
    // QR closing on the FAILURE completion of a PENDING payment lands after authorize() is done.
    it("the QR closing after a PENDING completion keeps the button locked while the poll runs", async () => {
        mockPay.mockResolvedValue(PENDING);
        mockStatus.mockResolvedValue(PENDING);
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        act(() => { session.oncancel?.(); });

        expect(result.current.busy).toBe(true);
        expect(result.current.notice).toBe(PENDING_NOTICE);
        await act(async () => { jest.advanceTimersByTime(3000); });
        expect(mockStatus).toHaveBeenCalledWith(TOKEN_SENTINEL, 4821);
    });

    it("a completePayment that throws after a Safari cancel still shows the notice and polls on PENDING", async () => {
        const pay = deferPay();
        mockStatus.mockResolvedValue(PENDING);
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);
        cancelSafariSheet(session);

        await act(async () => { pay.resolve(PENDING); });

        expect(result.current.notice).toBe(PENDING_NOTICE);
        expect(result.current.busy).toBe(true);
        await act(async () => { jest.advanceTimersByTime(3000); });
        expect(mockStatus).toHaveBeenCalledWith(TOKEN_SENTINEL, 4821);
        expect(console.warn).toHaveBeenCalledWith("Apple Pay sheet could not be completed:", "InvalidAccessError");
    });

    it("a completePayment that throws after a Safari cancel still completes an APPROVED payment", async () => {
        const pay = deferPay();
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        await authorize(session);
        cancelSafariSheet(session);

        await act(async () => { pay.resolve(APPROVED); });

        expect(session.completePayment).toHaveBeenCalledWith(FakeApplePaySession.STATUS_SUCCESS);
        expect(params.setCartItems).toHaveBeenCalledWith([]);
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
        expect(result.current.notice).toBeNull();
        expect(result.current.busy).toBe(false);
        expect(console.warn).toHaveBeenCalledWith("Apple Pay sheet could not be completed:", "InvalidAccessError");
    });

    it("a completePayment that throws after a Safari cancel still reports a definitive rejection and unlocks", async () => {
        const pay = deferPay();
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        await authorize(session);
        cancelSafariSheet(session);

        await act(async () => { pay.reject(new ApplePayApiError("APPLE_PAY_INVALID_REQUEST", 400)); });

        expect(result.current.error).toBe("Apple Pay payment could not be completed. You were not charged.");
        expect(result.current.busy).toBe(false);
        expect(mockStatus).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith("Apple Pay sheet could not be completed:", "InvalidAccessError");
    });
});

describe("useApplePayCheckout — gap coverage", () => {
    it("is hidden when canMakePayments() throws", async () => {
        const original = FakeApplePaySession.canMakePayments;
        FakeApplePaySession.canMakePayments = (): boolean => { throw new Error("insecure context"); };

        const { result } = await renderReady();

        FakeApplePaySession.canMakePayments = original;
        expect(result.current.available).toBe(false);
        expect(mockEligibility).not.toHaveBeenCalled();
    });

    it("is hidden when the profile request rejects", async () => {
        mockMe.mockRejectedValue(new Error("profile down"));

        const { result } = await renderReady();
        await waitFor(() => expect(mockMe).toHaveBeenCalled());

        expect(result.current.available).toBe(false);
    });

    it("unlocks after a merchant validation failure so the customer can retry", async () => {
        mockMerchantSession.mockRejectedValue(new ApplePayApiError("APPLE_PAY_MERCHANT_VALIDATION_FAILED", 502));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        await act(async () => { session.onvalidatemerchant?.({ validationURL: "https://apple-pay-gateway.apple.com/x" }); });

        act(() => { result.current.start(); });

        expect(FakeApplePaySession.instances).toHaveLength(2);
    });

    it("keeps the cart untouched and creates no order when validation fails", async () => {
        mockMerchantSession.mockRejectedValue(new ApplePayApiError("APPLE_PAY_NOT_CONFIGURED", 503));
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await act(async () => { session.onvalidatemerchant?.({ validationURL: "https://apple-pay-gateway.apple.com/x" }); });

        expect(params.setCartItems).not.toHaveBeenCalled();
        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(mockPay).not.toHaveBeenCalled();
    });

    it("uses a different idempotency key for the order and the pay attempt", async () => {
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        const orderKey = mockCreateOrder.mock.calls[0][1].idempotency_key;
        const attemptKey = mockPay.mock.calls[0][2].attemptKey;
        expect(attemptKey).toBeTruthy();
        expect(attemptKey).not.toBe(orderKey);
    });

    it("opens exactly one session when the reminder continue is pressed twice", async () => {
        mockMe.mockResolvedValue({ ...PROFILE, amountOfOrders: 0 });
        const { result } = await renderAvailable();
        act(() => { result.current.start(); });

        act(() => { result.current.continueFromReminder(); result.current.continueFromReminder(); });

        expect(FakeApplePaySession.instances).toHaveLength(1);
        expect(FakeApplePaySession.instances[0].begin).toHaveBeenCalledTimes(1);
    });

    it("a poll that resolves to DECLINED shows the declined error, unblocks and keeps the cart", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockResolvedValue({ orderId: 4821, status: "DECLINED", amount: "5.000", currency: "BHD" });
        const { result, params } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        await act(async () => { jest.advanceTimersByTime(3000); });

        expect(result.current.error).toBe("Your payment was declined. You were not charged.");
        expect(result.current.busy).toBe(false);
        expect(params.setCartItems).not.toHaveBeenCalled();
    });

    it("a poll that resolves to REVIEW shows the review error and stays blocked", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        mockStatus.mockResolvedValue({ orderId: 4821, status: "REVIEW", amount: "5.000", currency: "BHD" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        await act(async () => { jest.advanceTimersByTime(3000); });

        expect(result.current.notice).toBe("Your payment needs a manual check. Please contact the restaurant.");
        expect(result.current.busy).toBe(true);
    });

    it("stops polling after unmount", async () => {
        mockPay.mockResolvedValue({ orderId: 4821, status: "PENDING", amount: "5.000", currency: "BHD" });
        const { result, unmount } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();
        await authorize(session);

        unmount();
        await act(async () => { jest.advanceTimersByTime(10000); });

        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("never logs the token or paymentData on the success path", async () => {
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        const logged = JSON.stringify(consoleSpies.flatMap(spy => spy.mock.calls.map(call => call.map(String))));
        expect(logged).not.toContain(PAYMENT_DATA_SENTINEL);
        expect(logged).not.toContain(TOKEN_SENTINEL);
    });

    it("never logs the token or paymentData on the amount-mismatch path", async () => {
        mockCreateOrder.mockResolvedValue({ orderId: 1, amount: "9.990", currency: "BHD", status: "Pending Payment" });
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        const logged = JSON.stringify(consoleSpies.flatMap(spy => spy.mock.calls.map(call => call.map(String))));
        expect(consoleSpies.some(spy => spy.mock.calls.length > 0)).toBe(true);
        expect(logged).not.toContain(PAYMENT_DATA_SENTINEL);
        expect(logged).not.toContain(TOKEN_SENTINEL);
    });

    it("never logs the token or paymentData on the transport-error-after-create path", async () => {
        mockPay.mockRejectedValue(new TypeError("network"));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);
        jest.useFakeTimers();

        await authorize(session);

        const logged = JSON.stringify(consoleSpies.flatMap(spy => spy.mock.calls.map(call => call.map(String))));
        expect(consoleSpies.some(spy => spy.mock.calls.length > 0)).toBe(true);
        expect(logged).not.toContain(PAYMENT_DATA_SENTINEL);
        expect(logged).not.toContain(TOKEN_SENTINEL);
    });

    it("never logs the token on the validation-failure path", async () => {
        mockMerchantSession.mockRejectedValue(new ApplePayApiError("APPLE_PAY_MERCHANT_VALIDATION_FAILED", 502));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await act(async () => { session.onvalidatemerchant?.({ validationURL: "https://apple-pay-gateway.apple.com/x" }); });

        const logged = JSON.stringify(consoleSpies.flatMap(spy => spy.mock.calls.map(call => call.map(String))));
        expect(consoleSpies.some(spy => spy.mock.calls.length > 0)).toBe(true);
        expect(logged).not.toContain(TOKEN_SENTINEL);
    });
});

describe("useApplePayCheckout — logging", () => {
    it("never logs the token, event.payment or paymentData", async () => {
        mockCreateOrder.mockRejectedValue(new ApplePayApiError("APPLE_PAY_INVALID_REQUEST", 400));
        const { result } = await renderAvailable();
        const session = tapAndGetSession(result.current.start);

        await authorize(session);

        const logged = JSON.stringify(consoleSpies.flatMap(spy => spy.mock.calls.map(call => call.map(String))));
        expect(logged).not.toContain(PAYMENT_DATA_SENTINEL);
        expect(logged).not.toContain(TOKEN_SENTINEL);
    });
});
