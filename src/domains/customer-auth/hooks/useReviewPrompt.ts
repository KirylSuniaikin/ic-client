import { useCallback, useEffect, useState } from 'react';
import { useCustomerAuth } from '../context/CustomerAuthProvider';
import { ackReviewPrompt, fetchReviewPrompt } from '../../../shared/api/customerAuth';
import type { ReviewPrompt, ReviewPromptOutcome } from '../types';

// Owns the post-order Google review ask on web.
//
// Unlike mobile there is no push here, and a web customer has almost always
// closed the tab by the time their order is marked "Picked Up" (it happens
// 10-20 minutes after checkout, in-store). So the ask is delivered on the
// customer's NEXT visit instead of at the moment of completion.
//
// All the policy — how many orders, cooldown, lifetime cap — lives on the
// backend, keyed on the customer's phone. That is what stops web and the mobile
// app from both asking the same person: whichever channel reaches them first
// records the ask.

export type UseReviewPromptResult = {
    prompt: ReviewPrompt | null;
    // Report that the drawer is on screen. Safe to call more than once.
    markShown: () => void;
    // Record the customer's answer and close the drawer.
    answer: (outcome: Exclude<ReviewPromptOutcome, 'SHOWN'>) => void;
};

// `enabled` gates the request entirely — pass false while another popup owns the
// screen, so the drawer can never stack on top of login/profile/order-detail.
export function useReviewPrompt(enabled: boolean): UseReviewPromptResult {
    const { token } = useCustomerAuth();
    const [prompt, setPrompt] = useState<ReviewPrompt | null>(null);
    const [shownReported, setShownReported] = useState(false);

    useEffect(() => {
        if (!enabled || token === null) {
            return;
        }

        let cancelled = false;
        void (async () => {
            try {
                const result = await fetchReviewPrompt(token);
                if (!cancelled) {
                    setPrompt(result ?? null);
                }
            } catch {
                // Silent by design: an optional prompt that fails to load must
                // never produce an error the customer has to dismiss.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, token]);

    const markShown = useCallback((): void => {
        if (!prompt || shownReported || token === null) return;
        setShownReported(true);
        // Recorded on render rather than on an answer, so a closed tab still
        // counts as having been asked.
        void ackReviewPrompt(token, prompt.orderId, 'SHOWN');
    }, [prompt, shownReported, token]);

    const answer = useCallback(
        (outcome: Exclude<ReviewPromptOutcome, 'SHOWN'>): void => {
            if (!prompt || token === null) return;
            void ackReviewPrompt(token, prompt.orderId, outcome);
            // Close optimistically — the ack is telemetry, not a gate. Keeping the
            // drawer open until it lands would read as ignoring the customer.
            setPrompt(null);
        },
        [prompt, token],
    );

    return { prompt, markShown, answer };
}
