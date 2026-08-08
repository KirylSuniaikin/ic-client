import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { useKioskPaymentPolling } from "./useKioskPaymentPolling";
import { PAYMENT_POLL_INTERVAL_MS, PAYMENT_TIMEOUT_MS } from "../config";
import { cancelKioskPayment, fetchKioskPaymentResult } from "../../../shared/api/kiosk";
import type { PaymentResultResponse, PaymentStatus } from "../../../shared/api/kiosk";

jest.mock("../../../shared/api/kiosk");

// jest.mocked() rather than an explicit `jest.Mock<…>` annotation: there is no @types/jest in this
// project, so the `jest` namespace does not exist as a type (see .claude/CLAUDE.md). Same pattern
// as useCheckout.test.ts:24-29.
const mockFetchResult = jest.mocked(fetchKioskPaymentResult);
const mockCancel = jest.mocked(cancelKioskPayment);

const INVOICE = "K1234-a3f19b";

function resultWith(status: PaymentStatus): PaymentResultResponse {
    return {
        invoiceNum: INVOICE,
        status,
        orderId: 1234,
        amount: "9.990",
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

/**
 * Jest 27 has no `advanceTimersByTimeAsync`, so timers and the microtask queue must be pumped
 * separately: advancing fires the `setTimeout` callback, and awaiting inside `act` lets the async
 * poll body's promises settle before assertions run.
 */
async function advance(ms: number): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(ms);
        await Promise.resolve();
        await Promise.resolve();
    });
}

/** Flushes the initial poll, which the effect kicks off immediately rather than on a timer. */
async function flush(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

/**
 * Walks the clock forward one poll interval at a time. Jumping the whole span in a single
 * `advanceTimersByTime` would fire every queued timer back-to-back with no microtask turn in
 * between, so each poll's async body would never settle and never arm the next timeout — the loop
 * would silently stall instead of advancing.
 */
async function advanceInSteps(totalMs: number): Promise<void> {
    const steps = Math.ceil(totalMs / PAYMENT_POLL_INTERVAL_MS);
    for (let i = 0; i < steps; i += 1) {
        await advance(PAYMENT_POLL_INTERVAL_MS);
    }
}

describe("useKioskPaymentPolling", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        mockFetchResult.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("does not poll at all when the invoice is null", async () => {
        renderHook(() => useKioskPaymentPolling(null));
        await advance(PAYMENT_POLL_INTERVAL_MS * 5);

        expect(mockFetchResult).not.toHaveBeenCalled();
    });

    it("keeps at most one request in flight while a poll is pending", async () => {
        // Never settles — simulates the cold-started backend the self-scheduling setTimeout exists
        // to survive. An interval would stack requests here; this must not.
        mockFetchResult.mockReturnValue(new Promise<PaymentResultResponse>(() => {}));

        renderHook(() => useKioskPaymentPolling(INVOICE));
        await flush();
        expect(mockFetchResult).toHaveBeenCalledTimes(1);

        await advance(PAYMENT_POLL_INTERVAL_MS * 5);

        expect(mockFetchResult).toHaveBeenCalledTimes(1);
    });

    it("stops polling as soon as a terminal status is seen", async () => {
        mockFetchResult.mockResolvedValue(resultWith("APPROVED"));

        const { result } = renderHook(() => useKioskPaymentPolling(INVOICE));
        await flush();

        expect(result.current.status).toBe("APPROVED");
        expect(mockFetchResult).toHaveBeenCalledTimes(1);

        await advance(PAYMENT_POLL_INTERVAL_MS * 5);

        expect(mockFetchResult).toHaveBeenCalledTimes(1);
    });

    it("keeps polling through a transient network failure and surfaces it as `error`", async () => {
        mockFetchResult.mockRejectedValueOnce(new Error("Network error"));
        mockFetchResult.mockResolvedValue(resultWith("PENDING"));

        const { result } = renderHook(() => useKioskPaymentPolling(INVOICE));
        await flush();

        // The payment is still live at the terminal — a failed poll must not end the attempt.
        expect(result.current.error).toBe("Network error");
        expect(result.current.status).toBe("PENDING");

        await advance(PAYMENT_POLL_INTERVAL_MS);

        expect(mockFetchResult).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull();
    });

    it("counts down and, at the timeout, cancels at the terminal and reports TIMEOUT", async () => {
        mockFetchResult.mockResolvedValue(resultWith("PENDING"));

        const { result } = renderHook(() => useKioskPaymentPolling(INVOICE));
        await flush();

        expect(result.current.secondsRemaining).toBe(Math.floor(PAYMENT_TIMEOUT_MS / 1000));

        await advanceInSteps(PAYMENT_TIMEOUT_MS);

        expect(result.current.status).toBe("TIMEOUT");
        expect(mockCancel).toHaveBeenCalledWith(INVOICE);

        const callsAtTimeout = mockFetchResult.mock.calls.length;
        await advance(PAYMENT_POLL_INTERVAL_MS * 3);
        expect(mockFetchResult).toHaveBeenCalledTimes(callsAtTimeout);
    });

    it("makes no further calls after unmount", async () => {
        mockFetchResult.mockResolvedValue(resultWith("PENDING"));

        const { unmount } = renderHook(() => useKioskPaymentPolling(INVOICE));
        await flush();
        const callsBeforeUnmount = mockFetchResult.mock.calls.length;

        unmount();
        await advance(PAYMENT_POLL_INTERVAL_MS * 5);

        expect(mockFetchResult).toHaveBeenCalledTimes(callsBeforeUnmount);
    });

    it("resets status to PENDING when the invoice changes", async () => {
        mockFetchResult.mockResolvedValue(resultWith("DECLINED"));

        const { result, rerender } = renderHook(
            ({ invoice }: { invoice: string }) => useKioskPaymentPolling(invoice),
            { initialProps: { invoice: INVOICE } },
        );
        await flush();
        expect(result.current.status).toBe("DECLINED");

        // A second attempt under a new invoice must not read the previous DECLINED for a whole poll
        // interval — that would bounce the customer back to the failure sheet they just left.
        mockFetchResult.mockReturnValue(new Promise<PaymentResultResponse>(() => {}));
        rerender({ invoice: "K1234-ffffff" });

        expect(result.current.status).toBe("PENDING");
        expect(result.current.result).toBeNull();
    });

    it("cancel() releases the terminal and reports CANCELLED, then stops polling", async () => {
        mockFetchResult.mockResolvedValue(resultWith("PENDING"));

        const { result } = renderHook(() => useKioskPaymentPolling(INVOICE));
        await flush();
        const callsBeforeCancel = mockFetchResult.mock.calls.length;

        await act(async () => {
            await result.current.cancel();
        });

        expect(mockCancel).toHaveBeenCalledWith(INVOICE);
        expect(result.current.status).toBe("CANCELLED");

        await advance(PAYMENT_POLL_INTERVAL_MS * 3);
        expect(mockFetchResult).toHaveBeenCalledTimes(callsBeforeCancel);
    });

    it("still reports CANCELLED when the cancel call itself fails", async () => {
        mockFetchResult.mockResolvedValue(resultWith("PENDING"));
        mockCancel.mockRejectedValue(new Error("offline"));

        const { result } = renderHook(() => useKioskPaymentPolling(INVOICE));
        await flush();

        await act(async () => {
            await result.current.cancel();
        });

        // The backend re-queries EazyPay and its sweeper expires strays, so a failed cancel must not
        // leave the UI stuck on "tap your card".
        expect(result.current.status).toBe("CANCELLED");
    });
});
