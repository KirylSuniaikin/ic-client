import { useCallback, useEffect, useRef, useState } from "react";
import { PAYMENT_POLL_INTERVAL_MS, PAYMENT_TIMEOUT_MS } from "../config";
import { cancelKioskPayment, fetchKioskPaymentResult } from "../../../shared/api/kiosk";
import type { PaymentResultResponse, PaymentStatus } from "../../../shared/api/kiosk";

/**
 * Client-only pseudo-status for "we stopped waiting", which has no backend equivalent: the
 * transaction may still be live at the terminal when this fires, which is why the hook cancels at
 * EazyPay before reporting it.
 */
export type KioskPaymentStatus = PaymentStatus | "TIMEOUT";

/** Terminal states — polling stops as soon as one is seen. Mirrors the backend's isTerminal(). */
const TERMINAL_STATUSES: ReadonlySet<KioskPaymentStatus> = new Set<KioskPaymentStatus>([
    "APPROVED",
    "DECLINED",
    "CANCELLED",
    "EXPIRED",
    "AMOUNT_MISMATCH",
    "ERROR",
    "TIMEOUT",
]);

export function isTerminalKioskPaymentStatus(status: KioskPaymentStatus): boolean {
    return TERMINAL_STATUSES.has(status);
}

export interface UseKioskPaymentPollingResult {
    status: KioskPaymentStatus;
    result: PaymentResultResponse | null;
    /** Whole seconds left before the attempt is abandoned — drives the on-screen countdown. */
    secondsRemaining: number;
    /** Set on a transient network failure. Polling continues; this is a "reconnecting" hint only. */
    error: string | null;
    cancel: () => Promise<void>;
}

/**
 * Polls the backend for a payment outcome while the customer is at the terminal.
 *
 * Ported from ic-pizza-kiosk/domains/payment/hooks/usePaymentPolling.ts, keeping its guards:
 *
 * - Deliberately a self-scheduling `setTimeout`, never `setInterval`. An interval with an async
 *   callback fires on a fixed clock regardless of whether the previous request returned, so a slow
 *   response (a cold-started backend is the common case here) stacks overlapping requests that can
 *   resolve out of order. Re-arming only after each request settles keeps at most one in flight.
 * - `activeRef` guards every async continuation: without it a late response after unmount would set
 *   state on a dead component, and a cancelled attempt could be revived by an in-flight poll.
 * - Network errors set `error` but do NOT stop the loop — the payment is still live at the terminal,
 *   and giving up here would strand a customer who is about to be charged.
 *
 * Passing `null` stops the loop entirely; the caller (`useKioskCheckout`) relies on that to stop
 * polling the moment a terminal status has been consumed, with no second guard.
 */
export function useKioskPaymentPolling(invoiceNum: string | null): UseKioskPaymentPollingResult {
    const [status, setStatus] = useState<KioskPaymentStatus>("PENDING");
    const [result, setResult] = useState<PaymentResultResponse | null>(null);
    const [secondsRemaining, setSecondsRemaining] = useState(Math.floor(PAYMENT_TIMEOUT_MS / 1000));
    const [error, setError] = useState<string | null>(null);

    const activeRef = useRef(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancel = useCallback(async (): Promise<void> => {
        if (!invoiceNum) return;
        activeRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        try {
            await cancelKioskPayment(invoiceNum);
        } catch {
            // The backend re-queries EazyPay before trusting a cancel, and its reconciliation
            // sweeper expires anything left behind — so a failed cancel call is not worth blocking
            // the UI on. Either way this attempt is over from the customer's point of view.
        }
        setStatus("CANCELLED");
    }, [invoiceNum]);

    useEffect(() => {
        if (!invoiceNum) return;

        // A new invoice arrives with the previous attempt's terminal status still in state. Without
        // this reset the screen would read the old DECLINED for a whole poll interval and bounce the
        // customer straight back to the failure sheet they just left.
        setStatus("PENDING");
        setResult(null);
        setError(null);
        setSecondsRemaining(Math.floor(PAYMENT_TIMEOUT_MS / 1000));

        activeRef.current = true;
        const startedAt = Date.now();

        const poll = async (): Promise<void> => {
            if (!activeRef.current) return;

            const elapsed = Date.now() - startedAt;
            setSecondsRemaining(Math.max(0, Math.ceil((PAYMENT_TIMEOUT_MS - elapsed) / 1000)));

            if (elapsed >= PAYMENT_TIMEOUT_MS) {
                activeRef.current = false;
                try {
                    // Release the terminal so the next customer isn't blocked by an abandoned prompt.
                    await cancelKioskPayment(invoiceNum);
                } catch {
                    // The backend sweeper expires it. Reporting TIMEOUT is what matters here.
                }
                setStatus("TIMEOUT");
                return;
            }

            try {
                const next = await fetchKioskPaymentResult(invoiceNum);
                if (!activeRef.current) return;

                setResult(next);
                setStatus(next.status);
                setError(null);

                if (isTerminalKioskPaymentStatus(next.status)) {
                    activeRef.current = false;
                    return;
                }
            } catch (e) {
                // Keep polling through transient network failures — see the header note.
                if (!activeRef.current) return;
                setError(e instanceof Error ? e.message : "Network error");
            }

            timeoutRef.current = setTimeout(() => { void poll(); }, PAYMENT_POLL_INTERVAL_MS);
        };

        void poll();

        return () => {
            activeRef.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [invoiceNum]);

    return { status, result, secondsRemaining, error, cancel };
}
