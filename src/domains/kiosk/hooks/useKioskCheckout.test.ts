import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
// Importing the app's i18n singleton initializes it, so useTranslation("kiosk") inside the hook
// resolves against real resources instead of an undefined language (same as useCheckout.test.ts:9).
import "../../../shared/i18n";
import { useKioskCheckout } from "./useKioskCheckout";
import type { UseKioskCheckoutParams } from "./useKioskCheckout";
import {
    abandonKioskOrder,
    createKioskOrder,
    fetchKioskPaymentResult,
    initiateKioskPayment,
} from "../../../shared/api/kiosk";
import { KioskUnauthorizedError } from "../../../shared/api/kioskClient";
import { ItemsUnavailableError, BranchClosedError } from "../../order/types";
import type { Order } from "../../order/types";
import type { PaymentResultResponse, PaymentStatus } from "../../../shared/api/kiosk";
import type { CartItem } from "../../menu/types";
import { KIOSK_BRANCH_KEY } from "../utils/kioskBranch";

jest.mock("../../../shared/api/kiosk");

const mockCreateOrder = jest.mocked(createKioskOrder);
const mockInitiate = jest.mocked(initiateKioskPayment);
const mockFetchResult = jest.mocked(fetchKioskPaymentResult);
const mockAbandon = jest.mocked(abandonKioskOrder);

const ITEMS = [
    { id: 1, name: "Pepperoni", quantity: 2, amount: 3.5, size: "M", category: "Pizzas", discountAmount: 0 },
    { id: 2, name: "Water", quantity: 1, amount: 0.5, size: "", category: "Beverages", discountAmount: 0 },
] as unknown as CartItem[];

const ORDER: Order = { id: "4321" } as Order;

function resultWith(status: PaymentStatus): PaymentResultResponse {
    return {
        invoiceNum: "K4321-abc123",
        status,
        orderId: 4321,
        amount: "7.500",
        cardNo: null,
        trnRrn: null,
        trnAuthCode: null,
        trnCcy: null,
        posEntryMode: null,
        dccMarkup: null,
        dccRate: null,
        dccAmount: null,
        dccCurrency: null,
        dccCurrencyEx: null,
        dccMsg: null,
        failureReason: null,
    };
}

function makeParams(overrides: Partial<UseKioskCheckoutParams> = {}): UseKioskCheckoutParams {
    return {
        isKiosk: true,
        setCartItems: jest.fn(),
        setCartOpen: jest.fn(),
        refreshMenu: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
        onItemsUnavailable: jest.fn(),
        onUnauthorized: jest.fn(),
        onSessionEnd: jest.fn(),
        ...overrides,
    };
}

async function flush(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("useKioskCheckout", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        localStorage.clear();
        localStorage.setItem(KIOSK_BRANCH_KEY, JSON.stringify({ id: "branch-uuid-1", branchName: "Juffair" }));
        mockCreateOrder.mockReset();
        mockInitiate.mockReset();
        mockFetchResult.mockReset();
        mockAbandon.mockReset();
        mockCreateOrder.mockResolvedValue(ORDER);
        mockInitiate.mockResolvedValue({ invoiceNum: "K4321-abc123", status: "PENDING" });
        mockFetchResult.mockResolvedValue(resultWith("PENDING"));
        mockAbandon.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("starts idle and opens the phone step, closing the cart", () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        expect(result.current.phase).toBe("idle");
        expect(result.current.isSheetOpen).toBe(false);

        act(() => { result.current.startPhoneStep(ITEMS); });

        expect(result.current.phase).toBe("phone");
        expect(result.current.isSheetOpen).toBe(true);
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
    });

    it("creates the order then arms the terminal, landing on awaiting-card", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
        expect(mockInitiate).toHaveBeenCalledWith("4321");
        expect(result.current.phase).toBe("awaiting-card");
        expect(result.current.pendingOrderId).toBe("4321");
    });

    it("sends the name and phone the sheet collected, a 3-decimal amount and the kiosk branch", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });

        const payload = mockCreateOrder.mock.calls[0][0];
        expect(payload.tel).toBe("97312345678");
        // Was hardcoded null while the kiosk asked for a phone number only.
        expect(payload.customer_name).toBe("Layla");
        expect(payload.type).toBe("Pick Up");
        expect(payload.payment_type).toBe("Card");
        expect(payload.branchId).toBe("branch-uuid-1");
        // BHD is a 3-decimal (fils) currency: 2*3.5 + 0.5 = 7.5
        expect(payload.amount_paid).toBe(7.5);
        expect(payload.items).toHaveLength(2);
    });

    it("fires exactly one createKioskOrder when the button is double-tapped in one tick", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));
        act(() => { result.current.startPhoneStep(ITEMS); });

        // Both calls start before React can flush setSubmitting(true) — only the synchronous
        // submittingRef guard stops the second one, and a second order here is a real duplicate.
        await act(async () => {
            const first = result.current.submitPhone("97312345678", "Layla");
            const second = result.current.submitPhone("97312345678", "Layla");
            await Promise.all([first, second]);
        });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    it("retries only initiatePayment after it fails — never re-creates the order", async () => {
        mockInitiate.mockRejectedValueOnce(new Error("terminal unreachable"));
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));
        act(() => { result.current.startPhoneStep(ITEMS); });

        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });
        expect(result.current.phase).toBe("phone");
        expect(result.current.checkoutError).not.toBeNull();

        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
        expect(mockInitiate).toHaveBeenCalledTimes(2);
        expect(result.current.phase).toBe("awaiting-card");
    });

    it("splits the cart, reopens it and refreshes the menu when items went unavailable", async () => {
        mockCreateOrder.mockRejectedValue(new ItemsUnavailableError("Some items are unavailable", [1]));
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));
        act(() => { result.current.startPhoneStep(ITEMS); });

        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });

        expect(params.setCartItems).toHaveBeenCalledWith([ITEMS[1]]);
        expect(params.setCartOpen).toHaveBeenCalledWith(true);
        expect(params.onItemsUnavailable).toHaveBeenCalledWith(["Pepperoni"], "Some items are unavailable");
        expect(params.refreshMenu).toHaveBeenCalled();
        expect(result.current.phase).toBe("idle");
    });

    it("shows the branch-closed message inline instead of a generic error", async () => {
        mockCreateOrder.mockRejectedValue(new BranchClosedError("closed"));
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));
        act(() => { result.current.startPhoneStep(ITEMS); });

        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });

        expect(result.current.phase).toBe("phone");
        // Distinct from the generic failure copy — a closed branch is actionable information.
        expect(result.current.checkoutError).toBe("This branch is currently closed.");
    });

    it("routes an unpaired device to the terminal picker", async () => {
        mockCreateOrder.mockRejectedValue(new KioskUnauthorizedError());
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));
        act(() => { result.current.startPhoneStep(ITEMS); });

        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });

        expect(params.onUnauthorized).toHaveBeenCalledTimes(1);
        expect(result.current.phase).toBe("idle");
    });

    it("abandons the created order when the customer backs out of the phone step", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));
        act(() => { result.current.startPhoneStep(ITEMS); });
        mockInitiate.mockRejectedValueOnce(new Error("nope"));
        await act(async () => { await result.current.submitPhone("97312345678", "Layla"); });

        act(() => { result.current.closePhoneStep(); });

        expect(mockAbandon).toHaveBeenCalledWith("4321");
        expect(result.current.phase).toBe("idle");
        // The cart itself survives so the customer can edit it and come back.
        expect(params.setCartOpen).toHaveBeenLastCalledWith(true);
    });

    describe("terminal outcomes", () => {
        async function reachAwaitingCard(params: UseKioskCheckoutParams) {
            const hook = renderHook(() => useKioskCheckout(params));
            act(() => { hook.result.current.startPhoneStep(ITEMS); });
            await act(async () => { await hook.result.current.submitPhone("97312345678", "Layla"); });
            return hook;
        }

        it("APPROVED clears the cart and shows the confirmation — no client-side publish", async () => {
            mockFetchResult.mockResolvedValue(resultWith("APPROVED"));
            const params = makeParams();
            const { result } = await reachAwaitingCard(params);
            await flush();

            expect(result.current.phase).toBe("approved");
            expect(params.setCartItems).toHaveBeenCalledWith([]);
            // The backend settles and pushes the kitchen ticket itself.
            expect(mockAbandon).not.toHaveBeenCalled();
        });

        it.each(["DECLINED", "CANCELLED", "EXPIRED", "ERROR"] as const)(
            "%s goes straight to the front-desk offer (no card retry)",
            async (status) => {
                mockFetchResult.mockResolvedValue(resultWith(status));
                const { result } = await reachAwaitingCard(makeParams());
                await flush();

                expect(result.current.phase).toBe("failed");
            },
        );

        it("AMOUNT_MISMATCH dead-ends without abandoning or deferring", async () => {
            mockFetchResult.mockResolvedValue(resultWith("AMOUNT_MISMATCH"));
            const { result } = await reachAwaitingCard(makeParams());
            await flush();

            // Money already left the card — abandoning would hard-delete an order with a live
            // partial capture against it.
            expect(result.current.phase).toBe("mismatch");
            expect(mockAbandon).not.toHaveBeenCalled();
        });

        it("handleDeferred moves to the counter sheet without abandoning", async () => {
            mockFetchResult.mockResolvedValue(resultWith("DECLINED"));
            const { result } = await reachAwaitingCard(makeParams());
            await flush();

            act(() => { result.current.handleDeferred(); });

            expect(result.current.phase).toBe("deferred");
            expect(mockAbandon).not.toHaveBeenCalled();
        });

        it("handleAbandoned ends the session for the next customer", async () => {
            mockFetchResult.mockResolvedValue(resultWith("DECLINED"));
            const params = makeParams();
            const { result } = await reachAwaitingCard(params);
            await flush();

            act(() => { result.current.handleAbandoned(); });

            expect(params.onSessionEnd).toHaveBeenCalledTimes(1);
            expect(result.current.phase).toBe("idle");
        });

        it("finishSession resets after the confirmation sheet is dismissed", async () => {
            mockFetchResult.mockResolvedValue(resultWith("APPROVED"));
            const params = makeParams();
            const { result } = await reachAwaitingCard(params);
            await flush();

            act(() => { result.current.finishSession(); });

            expect(params.onSessionEnd).toHaveBeenCalledTimes(1);
            expect(result.current.phase).toBe("idle");
        });
    });
});
