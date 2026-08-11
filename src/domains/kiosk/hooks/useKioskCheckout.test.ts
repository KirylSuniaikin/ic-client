import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
// Importing the app's i18n singleton initializes it, so useTranslation("kiosk") inside the hook
// resolves against real resources instead of an undefined language (same as useCheckout.test.ts:9).
import "../../../shared/i18n";
import { useKioskCheckout } from "./useKioskCheckout";
import type { UseKioskCheckoutParams } from "./useKioskCheckout";
import { createOrder } from "../../../shared/api/public";
import { ItemsUnavailableError, BranchClosedError, DEFAULT_PAYMENT_METHOD } from "../../order/types";
import type { Order } from "../../order/types";
import type { CartItem } from "../../menu/types";
import { KIOSK_BRANCH_KEY } from "../utils/kioskBranch";

jest.mock("../../../shared/api/public");

const mockCreateOrder = jest.mocked(createOrder);

const ITEMS = [
    { id: 1, name: "Pepperoni", quantity: 2, amount: 3.5, size: "M", category: "Pizzas", discountAmount: 0 },
    { id: 2, name: "Water", quantity: 1, amount: 0.5, size: "", category: "Beverages", discountAmount: 0 },
] as unknown as CartItem[];

const ORDER: Order = { id: "4321" } as Order;

function makeParams(overrides: Partial<UseKioskCheckoutParams> = {}): UseKioskCheckoutParams {
    return {
        isKiosk: true,
        setCartItems: jest.fn(),
        setCartOpen: jest.fn(),
        refreshMenu: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
        onItemsUnavailable: jest.fn(),
        onSessionEnd: jest.fn(),
        ...overrides,
    };
}

describe("useKioskCheckout", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem(KIOSK_BRANCH_KEY, JSON.stringify({ id: "branch-uuid-1", branchName: "Juffair" }));
        mockCreateOrder.mockReset();
        mockCreateOrder.mockResolvedValue(ORDER);
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

    it("creates the order and lands on placed, exposing the number to quote at the counter", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678"); });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
        expect(result.current.phase).toBe("placed");
        expect(result.current.placedOrderId).toBe("4321");
        expect(params.setCartItems).toHaveBeenCalledWith([]);
    });

    // The whole point of this change: the kiosk takes no money. A payment_type that implied the
    // customer had already paid would put an unpaid order on the board looking settled.
    it("sends a phone-only Pick Up order for the paired branch and never marks it paid", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678"); });

        const sent = mockCreateOrder.mock.calls[0][0];
        expect(sent.tel).toBe("97312345678");
        expect(sent.customer_name).toBeNull();
        expect(sent.type).toBe("Pick Up");
        expect(sent.payment_type).toBe(DEFAULT_PAYMENT_METHOD);
        expect(sent.branchId).toBe("branch-uuid-1");
        expect(sent.items).toHaveLength(2);
        expect(sent.amount_paid).toBeCloseTo(7.5, 3);
    });

    // The synchronous ref guard, not setSubmitting, is what stops a second order: an impatient
    // second tap lands before React has flushed the state update.
    it("ignores a second submit while the first is still in flight", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => {
            const first = result.current.submitPhone("97312345678");
            const second = result.current.submitPhone("97312345678");
            await Promise.all([first, second]);
        });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    it("strips unavailable items, reopens the cart and returns to idle", async () => {
        mockCreateOrder.mockRejectedValue(new ItemsUnavailableError("Pepperoni just sold out", [1]));
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678"); });

        expect(params.setCartItems).toHaveBeenCalledWith([ITEMS[1]]);
        expect(params.setCartOpen).toHaveBeenLastCalledWith(true);
        expect(params.onItemsUnavailable).toHaveBeenCalledWith(["Pepperoni"], "Pepperoni just sold out");
        expect(result.current.phase).toBe("idle");
    });

    // The customer is still standing there with their digits typed — the sheet must stay up and
    // show why, not reset out from under them.
    it("keeps the phone sheet open with an inline message when the branch is closed", async () => {
        mockCreateOrder.mockRejectedValue(new BranchClosedError("closed"));
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678"); });

        expect(result.current.phase).toBe("phone");
        expect(result.current.checkoutError).toBe("This branch is currently closed.");
        expect(result.current.submitting).toBe(false);
    });

    it("allows a retry after a failure, and does not create a second order for the first attempt", async () => {
        mockCreateOrder.mockRejectedValueOnce(new Error("network"));
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678"); });
        expect(result.current.phase).toBe("phone");

        await act(async () => { await result.current.submitPhone("97312345678"); });

        expect(mockCreateOrder).toHaveBeenCalledTimes(2);
        expect(result.current.phase).toBe("placed");
    });

    // Nothing was created yet, so backing out is purely local — and the cart must survive so the
    // customer can edit it rather than rebuild it.
    it("returns to the cart when the customer backs out of the phone step", () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        act(() => { result.current.closePhoneStep(); });

        expect(result.current.phase).toBe("idle");
        expect(params.setCartOpen).toHaveBeenLastCalledWith(true);
        expect(params.setCartItems).not.toHaveBeenCalled();
    });

    it("ends the session and clears its state when the confirmation is dismissed", async () => {
        const params = makeParams();
        const { result } = renderHook(() => useKioskCheckout(params));

        act(() => { result.current.startPhoneStep(ITEMS); });
        await act(async () => { await result.current.submitPhone("97312345678"); });
        act(() => { result.current.finishSession(); });

        expect(params.onSessionEnd).toHaveBeenCalledTimes(1);
        expect(result.current.phase).toBe("idle");
        expect(result.current.placedOrderId).toBeNull();
    });

    it("resets when the tab leaves kiosk mode", async () => {
        const params = makeParams();
        const { result, rerender } = renderHook(
            (p: UseKioskCheckoutParams) => useKioskCheckout(p),
            { initialProps: params }
        );

        act(() => { result.current.startPhoneStep(ITEMS); });
        expect(result.current.phase).toBe("phone");

        rerender(makeParams({ isKiosk: false }));

        expect(result.current.phase).toBe("idle");
    });
});
