import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react";

import { useBpgPaymentResult } from "./useBpgPaymentResult";
import { fetchBpgPaymentResult } from "../../../shared/api/public";
import type { BpgPaymentResult, PaymentStatus } from "../types";

jest.mock("../../../shared/api/public");

const mockFetch = jest.mocked(fetchBpgPaymentResult);

/**
 * Real timers, not fake ones. `waitFor` cannot advance jest's fake clock, so a poll scheduled with
 * setTimeout never fires and the assertion sees `undefined` — the failure mode this window exists
 * to avoid. The hook polls every 2s, so a 6s window covers two attempts and still runs fast.
 */
const POLL_WINDOW = { timeout: 6000 } as const;

function resultWith(status: PaymentStatus): BpgPaymentResult {
    return {
        reference: "1700000000042123456",
        status,
        orderNo: 4231,
        amount: "5.500",
        cardNo: "460041******1234",
        rrn: "935110000001",
        authCode: "099673",
        failureReason: null,
    };
}

describe("useBpgPaymentResult", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });


    describe("when the payment has already settled", () => {
        it("stops polling as soon as a terminal status is seen", async () => {
            mockFetch.mockResolvedValue(resultWith("APPROVED"));

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(result.current.settling).toBe(false));
            expect(result.current.result?.status).toBe("APPROVED");
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe("when settlement has not been applied yet", () => {
        /**
         * The normal first answer, not an edge case: BPG's notification is acknowledged before it
         * is applied, so the browser routinely arrives back here first.
         */
        it("keeps waiting on a PENDING status rather than reporting a failure", async () => {
            mockFetch.mockResolvedValue(resultWith("PENDING"));

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(result.current.result?.status).toBe("PENDING"));
            expect(result.current.settling).toBe(true);
            expect(result.current.timedOut).toBe(false);
        });

        it("settles once a later poll returns a terminal status", async () => {
            mockFetch
                .mockResolvedValueOnce(resultWith("PENDING"))
                .mockResolvedValueOnce(resultWith("APPROVED"));

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(result.current.result?.status).toBe("APPROVED"), POLL_WINDOW);
            expect(result.current.settling).toBe(false);
        });
    });

    describe("when a poll fails", () => {
        /**
         * A dropped request mid-settlement is common and recoverable. Abandoning here would show a
         * failure for a payment that succeeded a second later — the worst outcome available.
         */
        it("keeps polling instead of giving up", async () => {
            mockFetch
                .mockRejectedValueOnce(new Error("network"))
                .mockResolvedValueOnce(resultWith("APPROVED"));

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(result.current.result?.status).toBe("APPROVED"), POLL_WINDOW);
            expect(result.current.settling).toBe(false);
        });

        it("clears a transient error once a later poll succeeds", async () => {
            mockFetch
                .mockRejectedValueOnce(new Error("network"))
                .mockResolvedValueOnce(resultWith("APPROVED"));

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(result.current.error).toBeNull(), POLL_WINDOW);
        });
    });

    describe("when no reference is supplied", () => {
        it("reports a missing reference without calling the API", async () => {
            const { result } = renderHook(() => useBpgPaymentResult(null));

            await waitFor(() => expect(result.current.settling).toBe(false));
            expect(result.current.error).toBe("missing-reference");
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe("on unmount", () => {
        it("stops polling so a late response cannot update a dead component", async () => {
            mockFetch.mockResolvedValue(resultWith("PENDING"));

            const { unmount } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(mockFetch).toHaveBeenCalled());
            const callsBeforeUnmount = mockFetch.mock.calls.length;
            unmount();

            // One full poll interval plus slack: long enough that another request would have
            // fired had the cleanup not run, short enough to stay inside jest's 5s test timeout.
            await new Promise((resolve) => setTimeout(resolve, 2500));

            expect(mockFetch.mock.calls.length).toBe(callsBeforeUnmount);
        });
    });
});
