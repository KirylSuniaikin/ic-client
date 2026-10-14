import {useCallback, useEffect, useRef, useState} from "react";

import {fetchBpgPaymentResult} from "../../../shared/api/public";
import {isTerminalStatus, type BpgPaymentResult} from "../types";
import {logger} from "../../../shared/utils/logger";

/** How long between polls, once the previous one has settled. */
const POLL_INTERVAL_MS = 2000;

/**
 * How long to keep asking before giving up on the page.
 *
 * Not the same clock as the payment's own 15-minute TTL: by the time the customer is back on this
 * page the gateway has already answered, and settlement is a local database write. Two minutes is
 * generous for that. Giving up here abandons the *page*, never the payment — the backend sweeper
 * still resolves the attempt by Inquiry.
 */
const TIMEOUT_MS = 120_000;

export type BpgPaymentResultState = {
    result: BpgPaymentResult | null;
    /** True while we are still waiting for a terminal status. */
    settling: boolean;
    /** Set when the page gave up waiting — not a payment failure. */
    timedOut: boolean;
    /** A lookup error, e.g. an unknown reference. Not a payment failure either. */
    error: string | null;
};

/**
 * Polls our own backend until the payment reaches a terminal status.
 *
 * Ported from the kiosk's `usePaymentPolling`, including the decision that matters most: a
 * **self-scheduling `setTimeout`, never `setInterval`**. An interval with an async callback fires
 * on a fixed clock whether or not the previous request has returned, so a slow response — a
 * cold-started backend is the common case here — stacks overlapping requests that can resolve out
 * of order. Re-arming only after each request settles keeps at most one in flight.
 *
 * The first answer is routinely non-terminal: BENEFIT's notification is acknowledged before it is
 * applied, so the browser can easily arrive back here first. That is why the page opens in a
 * "confirming" state rather than treating a pending status as an error.
 */
export function useBpgPaymentResult(reference: string | null): BpgPaymentResultState {
    const [result, setResult] = useState<BpgPaymentResult | null>(null);
    const [settling, setSettling] = useState(true);
    const [timedOut, setTimedOut] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Guards every async continuation: without it a late response after unmount calls setState on
    // a dead component, and a resolved payment could be re-opened by an in-flight poll.
    const activeRef = useRef(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stop = useCallback(() => {
        activeRef.current = false;
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!reference) {
            setSettling(false);
            setError("missing-reference");
            return;
        }

        activeRef.current = true;
        setResult(null);
        setSettling(true);
        setTimedOut(false);
        setError(null);

        const giveUpAt = Date.now() + TIMEOUT_MS;

        async function poll(): Promise<void> {
            if (!activeRef.current) return;

            try {
                const next = await fetchBpgPaymentResult(reference as string);
                if (!activeRef.current) return;

                setResult(next);
                // A transient blip that later succeeds must not leave a stale error on screen.
                setError(null);

                if (isTerminalStatus(next.status)) {
                    setSettling(false);
                    return;
                }
            } catch (e) {
                if (!activeRef.current) return;
                // Deliberately does NOT stop polling. A dropped request while the customer's
                // payment is mid-settlement is common and recoverable; abandoning here would show
                // a failure for a payment that in fact succeeded a second later.
                logger.error("Payment result lookup failed:", e);
                setError(e instanceof Error ? e.message : String(e));
            }

            if (!activeRef.current) return;

            if (Date.now() >= giveUpAt) {
                setSettling(false);
                setTimedOut(true);
                return;
            }

            timeoutRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }

        void poll();

        return stop;
    }, [reference, stop]);

    return {result, settling, timedOut, error};
}
