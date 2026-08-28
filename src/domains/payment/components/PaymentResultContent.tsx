import React from "react";
import {Box, Button, CircularProgress, Divider, Stack, Typography} from "@mui/material";
import {useTranslation} from "react-i18next";
import {useReducedMotion} from "framer-motion";

import {ErrorMark, SuccessMark} from "./ResultMark";
import {isRetryable, type BpgPaymentResult} from "../types";

/** Brand red, as used for the order number on the order-status page. */
const BRAND_RED = "#E44B4C";
/** The same green the OrderConfirmed toast uses. */
const SUCCESS_GREEN = "#4CAF50";

export type PaymentResultContentProps = {
    result: BpgPaymentResult | null;
    settling: boolean;
    timedOut: boolean;
    error: string | null;
    /** True while a fresh attempt is being opened — the button must not be pressable twice. */
    retrying?: boolean;
    /** The retry call itself failed, as distinct from the payment failing. */
    retryFailed?: boolean;
    onRetry?: () => void;
    onBackToMenu: () => void;
};

/**
 * What the customer sees after paying on BENEFIT's hosted page.
 *
 * Mirrors the kiosk's `confirm.tsx` receipt, minus the two blocks that only exist for a physical
 * terminal: POS entry mode and the DCC disclosure. Neither is produced by an online payment, and
 * neither is present on `BpgPaymentResultTO`.
 *
 * The order number shown is `orderNo`, never `orders.id`. The kiosk learned this the hard way —
 * its own DTO records that showing the database id meant "the customer walked to the counter
 * quoting a number nobody else could find".
 */
export function PaymentResultContent(props: PaymentResultContentProps): JSX.Element {
    const {result, settling, timedOut, error, retrying, retryFailed, onRetry, onBackToMenu} = props;
    const {t} = useTranslation("payment");
    const reduced = useReducedMotion() ?? false;

    if (settling) {
        return (
            <Shell>
                <CircularProgress sx={{color: BRAND_RED}}/>
                <Typography variant="h6" sx={{mt: 3, fontWeight: 600}}>
                    {t("confirming.title")}
                </Typography>
                <Typography variant="body2" sx={{mt: 1, color: "text.secondary", textAlign: "center"}}>
                    {t("confirming.subtitle")}
                </Typography>
            </Shell>
        );
    }

    // A lookup that never resolved, or a reference we could not read. Deliberately worded as "we
    // could not confirm", not "your payment failed" — we genuinely do not know, and the backend
    // sweeper is still working on it. Telling a customer who paid that they did not is worse than
    // telling them to check back.
    if (timedOut || (!result && error)) {
        return (
            <Shell>
                <ErrorMark reduced={reduced}/>
                <Typography variant="h6" sx={{mt: 3, fontWeight: 600}}>
                    {t("unknown.title")}
                </Typography>
                <Typography variant="body2" sx={{mt: 1, color: "text.secondary", textAlign: "center"}}>
                    {t("unknown.subtitle")}
                </Typography>
                <BackButton onClick={onBackToMenu} label={t("action.backToMenu")}/>
            </Shell>
        );
    }

    if (!result) {
        return (
            <Shell>
                <CircularProgress sx={{color: BRAND_RED}}/>
            </Shell>
        );
    }

    if (result.status === "APPROVED") {
        return (
            <Shell>
                <SuccessMark reduced={reduced}/>
                <Typography variant="h5" sx={{mt: 3, fontWeight: 700, color: SUCCESS_GREEN}}>
                    {t("approved.title")}
                </Typography>
                <Typography variant="body2" sx={{mt: 1, color: "text.secondary"}}>
                    {t("approved.subtitle")}
                </Typography>

                {result.orderNo !== null && (
                    <Box
                        sx={{
                            mt: 4, px: 5, py: 2, borderRadius: 4, bgcolor: "#fff",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.08)", textAlign: "center",
                        }}
                    >
                        <Typography variant="body2" sx={{color: "text.secondary"}}>
                            {t("approved.orderNumber")}
                        </Typography>
                        {/* Forced LTR: an Arabic page must still render the ticket number in the
                            order staff and the kitchen ticket read it. */}
                        <Typography
                            sx={{fontSize: 48, fontWeight: 800, color: BRAND_RED, direction: "ltr"}}
                        >
                            {result.orderNo}
                        </Typography>
                    </Box>
                )}

                <ReceiptRows result={result} t={t}/>
                <BackButton onClick={onBackToMenu} label={t("action.backToMenu")}/>
            </Shell>
        );
    }

    // Undercharged. Money has already left the card, so a retry would take a second payment for an
    // order still not covered — the kiosk routes these to a member of staff and so do we.
    if (result.status === "AMOUNT_MISMATCH") {
        return (
            <Shell>
                <ErrorMark reduced={reduced}/>
                <Typography variant="h6" sx={{mt: 3, fontWeight: 600}}>
                    {t("mismatch.title")}
                </Typography>
                <Typography variant="body2" sx={{mt: 1, color: "text.secondary", textAlign: "center"}}>
                    {t("mismatch.subtitle")}
                </Typography>
                {result.orderNo !== null && (
                    <Typography sx={{mt: 2, fontWeight: 700, direction: "ltr"}}>
                        {t("approved.orderNumber")} {result.orderNo}
                    </Typography>
                )}
            </Shell>
        );
    }

    return (
        <Shell>
            <ErrorMark reduced={reduced}/>
            <Typography variant="h6" sx={{mt: 3, fontWeight: 600}}>
                {t("declined.title")}
            </Typography>
            <Typography variant="body2" sx={{mt: 1, color: "text.secondary", textAlign: "center"}}>
                {t("declined.subtitle")}
            </Typography>
            {retryFailed && (
                <Typography variant="body2" sx={{mt: 2, color: BRAND_RED, textAlign: "center"}}>
                    {t("declined.retryFailed")}
                </Typography>
            )}
            <Stack direction="row" spacing={2} sx={{mt: 4}}>
                {isRetryable(result.status) && onRetry && (
                    <Button
                        variant="contained"
                        disabled={retrying}
                        startIcon={retrying ? <CircularProgress size={16} color="inherit"/> : undefined}
                        sx={{bgcolor: BRAND_RED, "&:hover": {bgcolor: BRAND_RED}}}
                        onClick={onRetry}
                    >
                        {t("action.tryAgain")}
                    </Button>
                )}
                <Button variant="outlined" onClick={onBackToMenu}>
                    {t("action.backToMenu")}
                </Button>
            </Stack>
        </Shell>
    );
}

/** The receipt detail rows. Every value falls back to an em dash, as the kiosk's do. */
function ReceiptRows({result, t}: {result: BpgPaymentResult; t: (k: string) => string}): JSX.Element {
    const rows: Array<{label: string; value: string | null}> = [
        {label: t("receipt.amount"), value: result.amount},
        {label: t("receipt.card"), value: result.cardNo},
        {label: t("receipt.authCode"), value: result.authCode},
        {label: t("receipt.reference"), value: result.rrn},
    ];

    return (
        <Box sx={{mt: 4, width: "100%", maxWidth: 360}}>
            <Divider/>
            {rows.map((row) => (
                <Box
                    key={row.label}
                    sx={{display: "flex", justifyContent: "space-between", py: 1.5, gap: 2}}
                >
                    <Typography variant="body2" sx={{color: "text.secondary"}}>{row.label}</Typography>
                    <Typography variant="body2" sx={{fontWeight: 600, direction: "ltr"}}>
                        {row.value ?? "—"}
                    </Typography>
                </Box>
            ))}
            <Divider/>
        </Box>
    );
}

function BackButton({onClick, label}: {onClick: () => void; label: string}): JSX.Element {
    return (
        <Button variant="outlined" sx={{mt: 4}} onClick={onClick}>
            {label}
        </Button>
    );
}

/** Centred full-height column, matching OrderStatusContent's layout. */
function Shell({children}: {children: React.ReactNode}): JSX.Element {
    return (
        <Box
            sx={{
                minHeight: "100vh", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", bgcolor: "#fff", px: 3, py: 6,
            }}
        >
            {children}
        </Box>
    );
}
