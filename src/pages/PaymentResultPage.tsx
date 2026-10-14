import React, {useState} from "react";
import {useNavigate} from "react-router-dom";

import {PaymentResultContent} from "../domains/payment/components/PaymentResultContent";
import {useBpgPaymentResult} from "../domains/payment/hooks/useBpgPaymentResult";
import {retryBpgPayment} from "../shared/api/public";
import {logger} from "../shared/utils/logger";

export type PaymentResultPageProps = {
    /** The opaque payment reference from `?ref=`, minted by the backend per attempt. */
    reference: string | null;
};

/**
 * Where BENEFIT's hosted page sends the customer back to.
 *
 * A thin shell, like every other page here: the route reads the query param and this owns only
 * the polling and the "where to next". The outcome is never taken from the URL — BPG appends its
 * own `paymentid` and `trandata` to this redirect and both are deliberately ignored, because a
 * query parameter is attacker-controlled and the real state lives behind our own API.
 */
export function PaymentResultPage({reference}: PaymentResultPageProps): JSX.Element {
    const navigate = useNavigate();
    const {result, settling, timedOut, error} = useBpgPaymentResult(reference);
    const [retrying, setRetrying] = useState(false);
    const [retryFailed, setRetryFailed] = useState(false);

    /**
     * Opens a fresh attempt and hands the customer straight to the new payment page.
     *
     * A full-page assign rather than a route change: the destination is the gateway's own domain,
     * which is where card details belong. The new reference travels back in the REDIRECT= target
     * the server builds, so nothing needs to be stashed here.
     */
    async function onRetry(): Promise<void> {
        if (reference === null || retrying) return;
        setRetrying(true);
        setRetryFailed(false);
        try {
            const next = await retryBpgPayment(reference);
            window.location.assign(next.redirectUrl);
        } catch (e) {
            // Leaves the customer on this page with the option to try again or walk away, rather
            // than on a blank screen. The order is safe either way — it is recorded server-side
            // and swept if it is never settled.
            logger.error("Payment retry failed:", e);
            setRetrying(false);
            setRetryFailed(true);
        }
    }

    return (
        <PaymentResultContent
            result={result}
            settling={settling}
            timedOut={timedOut}
            error={error}
            retrying={retrying}
            retryFailed={retryFailed}
            onRetry={onRetry}
            onBackToMenu={() => navigate("/menu")}
        />
    );
}
