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

    /**
     * manual §05: "Payment confirmation polling — 2 min. Beyond this the honest answer is 'we could
     * not confirm', which is never the same statement as 'it failed'." Neither the window nor the
     * shape of what happens at the end of it was pinned anywhere: the hook could have given up
     * after two seconds, or never, and every existing test would still pass.
     *
     * The clock is driven through `Date.now` rather than by waiting: the hook computes its
     * deadline from it, and the poll timer stays on real time so nothing about the scheduling is
     * changed. Each fetch advances the clock by the amount under test, which puts the boundary
     * check exactly where it needs to be without a two-minute test.
     */
    describe("the two-minute confirmation window", () => {
        let now = 0;
        let nowSpy: ReturnType<typeof jest.spyOn> | null = null;

        function freezeClockAdvancingBy(msPerPoll: number): void {
            now = 1_700_000_000_000;
            nowSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
            mockFetch.mockImplementation(async () => {
                now += msPerPoll;
                return resultWith("PENDING");
            });
        }

        afterEach(() => {
            nowSpy?.mockRestore();
            nowSpy = null;
        });

        it("keeps asking for two minutes before it gives up", async () => {
            // One millisecond short of the window on the first poll: it must ask again.
            freezeClockAdvancingBy(119_999);

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2), POLL_WINDOW);
            // Still inside the window at the point of the first check — nothing was abandoned.
            expect(result.current.result?.status).toBe("PENDING");
        });

        /**
         * The whole point of the timeout. Giving up abandons the PAGE, never the payment: the
         * backend sweeper still resolves the attempt by Inquiry, so the hook must report
         * "we stopped waiting" and must NOT invent a failure — `result` stays at whatever the
         * gateway last said and `error` stays null, which is what lets the screen say
         * "we couldn't confirm" instead of "your payment failed".
         */
        it("gives up as 'we could not confirm', never as a failure", async () => {
            freezeClockAdvancingBy(120_000);

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(result.current.timedOut).toBe(true), POLL_WINDOW);
            expect(result.current.settling).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            // Nothing here says the payment failed — that statement is not ours to make.
            expect(result.current.error).toBeNull();
            expect(result.current.result?.status).toBe("PENDING");
        });

        it("does not give up while the window still has time left in it", async () => {
            freezeClockAdvancingBy(1_000);

            const { result } = renderHook(() => useBpgPaymentResult("ref-1"));

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2), POLL_WINDOW);
            expect(result.current.timedOut).toBe(false);
            expect(result.current.settling).toBe(true);
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
