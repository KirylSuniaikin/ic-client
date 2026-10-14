import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { fetchBenefitPaySession } from "../shared/api/public";
import { openBenefitPayWidget } from "../domains/payment/openBenefitPayWidget";
import { BASE_URL } from "../shared/api/client";
import { logger } from "../shared/utils/logger";

const BRAND_RED = "#E44B4C";

/**
 * Hosts the BenefitPay widget on a page of our own, for a customer arriving from the mobile app.
 *
 * <h2>Why this page has to exist</h2>
 * BenefitPay's checkout page cannot stand on its own. Opened as a top-level document it renders,
 * but its "PAY USING BENEFITPAY APP" button resolves to `about:blank#blocked`: the hand-off link is
 * built by `InApp.min.js` in the PARENT window, from a message the checkout page posts to it. A
 * top-level document has no parent to post to, so nothing is ever built. This page is that parent.
 *
 * <h2>It decides nothing</h2>
 * The widget's callback is advisory — the guide is explicit that a successful operation does not
 * indicate a successful payment. So finishing here means only "the customer is done", and the page
 * hands straight back to the server, which asks check-status and answers for real.
 */
export default function BenefitPayBridgePage(): JSX.Element {
    const [searchParams] = useSearchParams();
    const reference = searchParams.get("ref");
    const [error, setError] = useState<string | null>(null);
    const [appLink, setAppLink] = useState<string | null>(null);
    const startedFor = useRef<string | null>(null);

    useEffect(() => {
        if (reference === null || reference.length === 0) {
            setError("missing");
            return;
        }
        // One widget per reference: React may re-run this effect, and opening twice would leave two
        // iframes racing for the same attempt.
        if (startedFor.current === reference) return;
        startedFor.current = reference;

        let cancelled = false;



        void (async () => {
            try {
                const session = await fetchBenefitPaySession(reference);
                // The hand-off interception now lives in openBenefitPayWidget, so every surface
                // that opens the widget gets it. This page keeps the visible button as a
                // fallback: a tap is user activation and can never be blocked.
                await openBenefitPayWidget(session, setAppLink);
            } catch (e: unknown) {
                logger.error("BenefitPay bridge failed:", e);
                // Fall through to the hand-back regardless: the attempt exists server-side, and the
                // result screen asking check-status is a better answer than a dead end here.
            }
            if (cancelled) return;
            // The server owns where the customer goes next — it holds the deep link the app stated
            // at checkout, already screened against an allowlist. Never a target from the URL.
            window.location.assign(
                `${BASE_URL}/payments/bpg/return?ref=${encodeURIComponent(reference)}`,
            );
        })();

        return () => {
            cancelled = true;
        };
    }, [reference]);

    return (
        <Box sx={{
            minHeight: "100vh", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 2, px: 3, textAlign: "center",
        }}>
            {error !== null && (
                <Typography sx={{ color: "text.secondary" }}>
                    This payment link is incomplete.
                </Typography>
            )}
            {error === null && appLink === null && <CircularProgress sx={{ color: BRAND_RED }} />}
            {appLink !== null && (
                <Button variant="contained" href={appLink}
                        sx={{ backgroundColor: BRAND_RED, borderRadius: 3, px: 4, py: 1.5 }}>
                    Open BenefitPay
                </Button>
            )}
        </Box>
    );
}
