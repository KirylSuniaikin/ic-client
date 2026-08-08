import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { logger } from "../../../shared/utils/logger";
import { abandonKioskOrder, deferOrderToCounter } from "../../../shared/api/kiosk";
import { KioskHttpError, KioskUnauthorizedError } from "../../../shared/api/kioskClient";
import { KioskSheet, KIOSK_BRAND_RED } from "./KioskSheet";
import { PAYMENT_FAILURE_PROMPT_TIMEOUT_MS } from "../config";

type PromptPhase = "asking" | "submitting" | "error-retryable" | "error-terminal" | "no-order";

interface KioskPaymentFailureSheetProps {
    open: boolean;
    /** `null` is defensive only — with no order there is nothing to defer or abandon. */
    orderId: string | null;
    /**
     * True only for AMOUNT_MISMATCH — an undercharge where money has already left the customer's
     * card. It must never reach the Yes/No question: "No" would hard-delete an order with a live
     * partial capture against it, and the countdown would do the same unattended. Routes straight
     * to the staff dead end, with no Yes/No, no countdown, and no automatic abandon or defer.
     */
    amountMismatch?: boolean;
    /** The order was successfully saved for the counter. */
    onDeferred: () => void;
    /** The order was abandoned (by the customer, or by the countdown). */
    onAbandoned: () => void;
    /** Device pairing is gone — reopen the terminal picker instead of blaming the customer. */
    onUnauthorized: () => void;
}

function statusOf(error: unknown): number | undefined {
    return error instanceof KioskHttpError ? error.status : undefined;
}

/**
 * "Payment failed — save your order and pay at the front desk?"
 *
 * Every non-approved terminal outcome lands here (there is no card retry, by product decision).
 * Not dismissible: dismissing would strand a real, unpaid order with neither answer given.
 */
export function KioskPaymentFailureSheet({
    open,
    orderId,
    amountMismatch = false,
    onDeferred,
    onAbandoned,
    onUnauthorized,
}: KioskPaymentFailureSheetProps): JSX.Element {
    const { t } = useTranslation("kiosk");
    const [phase, setPhase] = useState<PromptPhase>("asking");
    const [secondsRemaining, setSecondsRemaining] = useState(
        Math.floor(PAYMENT_FAILURE_PROMPT_TIMEOUT_MS / 1000),
    );

    /** Which action produced 'error-retryable', so "Try again" re-runs that same call rather than
     *  re-asking a question the customer already answered. */
    const lastActionRef = useRef<"defer" | "abandon" | null>(null);
    /** Caps the expiry side effects at one firing per "asking" window. */
    const expiredRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (orderId === null) {
            setPhase("no-order");
            return;
        }
        if (amountMismatch) {
            setPhase("error-terminal");
            return;
        }
        if (!open) return;
        setPhase("asking");
        setSecondsRemaining(Math.floor(PAYMENT_FAILURE_PROMPT_TIMEOUT_MS / 1000));
        expiredRef.current = false;
    }, [open, orderId, amountMismatch]);

    // Ticking only. This effect never navigates or calls the network — doing that from inside a
    // setState updater is the defect class the separate expiry effect below exists to avoid.
    useEffect(() => {
        if (phase !== "asking" || !open) return;

        intervalRef.current = setInterval(() => {
            setSecondsRemaining((seconds) => Math.max(seconds - 1, 0));
        }, 1000);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [phase, open]);

    // Expiry side effects react to the counter hitting zero. Clearing the interval here (rather
    // than waiting for a phase change) stops the tick immediately instead of once per second.
    useEffect(() => {
        if (phase !== "asking" || secondsRemaining > 0 || expiredRef.current) return;
        expiredRef.current = true;

        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Silence resolves to NO — best-effort and fire-and-forget. Nobody is present to see a
        // retry affordance or an error, so the empty catch is deliberate. An order "saved" for a
        // counter nobody is standing at is food the kitchen makes and nobody collects.
        if (orderId !== null) {
            abandonKioskOrder(orderId).catch(() => {});
        }
        onAbandoned();
    }, [phase, secondsRemaining, orderId, onAbandoned]);

    async function handleDefer(): Promise<void> {
        if (orderId === null) return;
        lastActionRef.current = "defer";
        setPhase("submitting");
        try {
            await deferOrderToCounter(orderId);
            onDeferred();
        } catch (error) {
            if (error instanceof KioskUnauthorizedError) {
                onUnauthorized();
                return;
            }
            logger.error("Error deferring kiosk order to counter:", error);
            // 409 means the order moved on independently — most plausibly the reconciliation
            // sweeper approved the card after the decline. Retrying cannot help.
            setPhase(statusOf(error) === 409 ? "error-terminal" : "error-retryable");
        }
    }

    async function handleAbandon(): Promise<void> {
        if (orderId === null) return;
        lastActionRef.current = "abandon";
        setPhase("submitting");
        try {
            await abandonKioskOrder(orderId);
            onAbandoned();
        } catch (error) {
            if (error instanceof KioskUnauthorizedError) {
                onUnauthorized();
                return;
            }
            const status = statusOf(error);
            if (status === 404) {
                // Abandon is not idempotent: a prior attempt already succeeded server-side and the
                // response was lost. Treat exactly this case as success — do not retry harder.
                onAbandoned();
                return;
            }
            logger.error("Error abandoning kiosk order:", error);
            setPhase(status === 409 ? "error-terminal" : "error-retryable");
        }
    }

    function handleRetry(): void {
        if (lastActionRef.current === "defer") void handleDefer();
        else if (lastActionRef.current === "abandon") void handleAbandon();
    }

    const primaryButtonSx = {
        borderRadius: 3,
        py: 1.5,
        px: 4,
        bgcolor: KIOSK_BRAND_RED,
        color: "white",
        fontSize: "1rem",
        fontWeight: "bold",
        textTransform: "none" as const,
        boxShadow: "none",
        "&:hover": { bgcolor: "#c73c3d", boxShadow: "none" },
    };

    return (
        <KioskSheet open={open}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                {phase === "no-order" && (
                    <>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                            {t("failure.terminalTitle")}
                        </Typography>
                        <Button variant="contained" onClick={onAbandoned} sx={primaryButtonSx}>
                            {t("failure.returnButton")}
                        </Button>
                    </>
                )}

                {phase === "asking" && (
                    <>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                            {t("failure.askTitle")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
                            {t("failure.secondsRemaining", { count: secondsRemaining })}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 2, width: "100%" }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={() => void handleAbandon()}
                                sx={{
                                    borderRadius: 3,
                                    py: 1.5,
                                    color: "text.secondary",
                                    borderColor: "grey.400",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    "&:hover": { borderColor: "grey.600", bgcolor: "transparent" },
                                }}
                            >
                                {t("failure.no")}
                            </Button>
                            <Button fullWidth variant="contained" onClick={() => void handleDefer()} sx={primaryButtonSx}>
                                {t("failure.yes")}
                            </Button>
                        </Box>
                    </>
                )}

                {phase === "submitting" && <CircularProgress sx={{ color: KIOSK_BRAND_RED, my: 2 }} />}

                {phase === "error-retryable" && (
                    <>
                        <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
                            {t("failure.retryableMessage")}
                        </Typography>
                        <Button variant="contained" onClick={handleRetry} sx={primaryButtonSx}>
                            {t("failure.retryButton")}
                        </Button>
                    </>
                )}

                {phase === "error-terminal" && (
                    <>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: KIOSK_BRAND_RED, mb: 1 }}>
                            {amountMismatch ? t("failure.mismatchTitle") : t("failure.terminalTitle")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
                            {amountMismatch ? t("failure.mismatchSubtitle") : t("failure.terminalSubtitle")}
                        </Typography>
                        <Button variant="contained" onClick={onAbandoned} sx={primaryButtonSx}>
                            {t("failure.returnButton")}
                        </Button>
                    </>
                )}
            </Box>
        </KioskSheet>
    );
}

export default KioskPaymentFailureSheet;
