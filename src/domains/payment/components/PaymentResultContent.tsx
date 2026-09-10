import React from "react";
import {Box, Button, CircularProgress, Stack, Typography} from "@mui/material";
import {useTranslation} from "react-i18next";
import {useReducedMotion} from "framer-motion";

import {ErrorMark, SuccessMark} from "./ResultMark";
import {RETURN_DELAY_SECONDS, useReturnCountdown} from "../hooks/useReturnCountdown";
import {isRetryable, type BpgPaymentResult} from "../types";
import {BRAND_RED} from "../../../shared/utils/theme";

/**
 * The customer-facing surface tokens, all from `DESIGN.md`'s tables rather than picked here.
 *
 * <p>The screen is built to look like `CustomerLoginPopup`, the OTP sheet — the same gradient
 * ground, the same 72 px-family tinted roundel with a shadow tinted by its own colour, and the same
 * pill CTA. Before that it was a bare white column of MUI defaults, which is how three unstyled
 * `outlined` buttons ended up rendering in Material blue.
 */
const BRAND_RED_DARK = "#D0393A";
const BRAND_TINT = "#FCE9E9";
/** The same green the OrderConfirmed toast uses. Not in the palette as a named export. */
const SUCCESS_GREEN = "#4CAF50";
const SHEET_GROUND = "linear-gradient(170deg, #FFFBFA 0%, #FFF2F1 45%, #FBE3E3 100%)";
const TEXT_MUTED = "#8a807a";
const HAIRLINE = "#f1eae4";

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
                <Typography sx={{mt: 3, fontWeight: 800, fontSize: 24, letterSpacing: "-0.01em"}}>
                    {t("confirming.title")}
                </Typography>
                <Subtitle>{t("confirming.subtitle")}</Subtitle>
            </Shell>
        );
    }

    // A lookup that never resolved, or a reference we could not read. Deliberately worded as "we
    // could not confirm", not "your payment failed" — we genuinely do not know, and the backend
    // sweeper is still working on it. Telling a customer who paid that they did not is worse than
    // telling them to check back.
    //
    // No countdown here, and none on any other failure branch: this is the one screen that
    // explains what happened, so leaving it is the customer's decision to make.
    if (timedOut || (!result && error)) {
        return (
            <Shell>
                <Roundel tone="brand"><ErrorMark reduced={reduced}/></Roundel>
                <Title>{t("unknown.title")}</Title>
                <Subtitle>{t("unknown.subtitle")}</Subtitle>
                <Box sx={{mt: 4, width: "100%"}}>
                    <BrandButton label={t("action.backToMenu")} onClick={onBackToMenu}/>
                </Box>
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
        return <ApprovedView result={result} reduced={reduced} onBackToMenu={onBackToMenu}/>;
    }

    // Undercharged. Money has already left the card, so a retry would take a second payment for an
    // order still not covered — the kiosk routes these to a member of staff and so do we.
    if (result.status === "AMOUNT_MISMATCH") {
        return (
            <Shell>
                <Roundel tone="brand"><ErrorMark reduced={reduced}/></Roundel>
                <Title>{t("mismatch.title")}</Title>
                <Subtitle>{t("mismatch.subtitle")}</Subtitle>
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
            <Roundel tone="brand"><ErrorMark reduced={reduced}/></Roundel>
            <Title>{t("declined.title")}</Title>
            <Subtitle>{t("declined.subtitle")}</Subtitle>
            {retryFailed && (
                <Typography sx={{mt: 2, color: BRAND_RED, fontSize: 13.5, textAlign: "center"}}>
                    {t("declined.retryFailed")}
                </Typography>
            )}
            <Stack spacing={1} sx={{mt: 4, width: "100%"}}>
                {isRetryable(result.status) && onRetry && (
                    <BrandButton
                        label={t("action.tryAgain")}
                        onClick={onRetry}
                        disabled={retrying}
                        busy={retrying}
                    />
                )}
                <QuietButton label={t("action.backToMenu")} onClick={onBackToMenu}/>
            </Stack>
        </Shell>
    );
}

/**
 * The approved receipt, and the only branch that leaves on its own.
 *
 * <p>Its own component so the countdown hook is unconditional: a successful payment is the one
 * outcome where staying put has no value, because the menu's active-order pill is the live surface
 * from here on. The CTA is the way out for anyone who does not want to wait.
 */
function ApprovedView({result, reduced, onBackToMenu}: {
    result: BpgPaymentResult;
    reduced: boolean;
    onBackToMenu: () => void;
}): JSX.Element {
    const {t} = useTranslation("payment");
    const seconds = useReturnCountdown(RETURN_DELAY_SECONDS, onBackToMenu);

    return (
        <Shell>
            <Roundel tone="success"><SuccessMark reduced={reduced}/></Roundel>
            <Title sx={{color: SUCCESS_GREEN}}>{t("approved.title")}</Title>
            <Subtitle>{t("approved.subtitle")}</Subtitle>

            <Box
                sx={{
                    mt: 4, width: "100%", bgcolor: "#fff", borderRadius: 4,
                    border: `1px solid ${HAIRLINE}`, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    px: 3, py: 2.5,
                }}
            >
                {result.orderNo !== null && (
                    <Box sx={{textAlign: "center", pb: 2}}>
                        <Typography sx={{color: TEXT_MUTED, fontSize: 13.5}}>
                            {t("approved.orderNumber")}
                        </Typography>
                        {/* Forced LTR: an Arabic page must still render the ticket number in the
                            order staff and the kitchen ticket read it. */}
                        <Typography
                            sx={{fontSize: 48, fontWeight: 800, color: BRAND_RED, direction: "ltr", lineHeight: 1.1}}
                        >
                            {result.orderNo}
                        </Typography>
                    </Box>
                )}
                <ReceiptRows result={result} t={t}/>
            </Box>

            <Box sx={{mt: 4, width: "100%"}}>
                <BrandButton label={t("action.backToMenu")} onClick={onBackToMenu}/>
                <ReturnCue seconds={seconds} total={RETURN_DELAY_SECONDS} label={t("approved.returningIn", {seconds})}/>
            </Box>
        </Shell>
    );
}

/**
 * The "this screen is about to leave" cue.
 *
 * <p>Stated in words as well as drawn as a bar: a bar alone tells a customer that something is
 * happening, not what, and a screen that navigates without warning reads as a crash.
 */
function ReturnCue({seconds, total, label}: {seconds: number; total: number; label: string}): JSX.Element {
    const pct = Math.max(0, Math.min(1, seconds / total)) * 100;
    return (
        <Box sx={{mt: 2, display: "flex", flexDirection: "column", alignItems: "center"}}>
            <Typography sx={{fontSize: 13.5, color: TEXT_MUTED}}>{label}</Typography>
            <Box
                sx={{
                    mt: 1, width: "100%", maxWidth: 220, height: 4, borderRadius: 999,
                    bgcolor: "rgba(228,75,76,0.15)", overflow: "hidden",
                }}
            >
                <Box
                    data-testid="payment-return-progress"
                    sx={{height: "100%", width: `${pct}%`, bgcolor: BRAND_RED, transition: "width 1s linear"}}
                />
            </Box>
        </Box>
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
        <Box sx={{width: "100%"}}>
            {rows.map((row) => (
                <Box
                    key={row.label}
                    sx={{
                        display: "flex", justifyContent: "space-between", gap: 2, py: 1.25,
                        borderTop: `1px solid ${HAIRLINE}`,
                    }}
                >
                    <Typography sx={{color: TEXT_MUTED, fontSize: 14}}>{row.label}</Typography>
                    <Typography sx={{fontWeight: 600, fontSize: 14, direction: "ltr"}}>
                        {row.value ?? "—"}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}

/**
 * The tinted circle behind the mark — the OTP sheet's icon roundel, sized up to hold an 88 px mark.
 *
 * <p>The success tint is written as an alpha over `SUCCESS_GREEN` rather than as a new hex: there
 * is no green tint token, and inventing one is exactly how the brand red ended up copy-pasted into
 * ninety files.
 */
function Roundel({tone, children}: {tone: "brand" | "success"; children: React.ReactNode}): JSX.Element {
    const tint = tone === "success" ? "rgba(76,175,80,0.12)" : BRAND_TINT;
    const shadow = tone === "success"
        ? "0 8px 24px rgba(76,175,80,0.18)"
        : "0 8px 24px rgba(228,75,76,0.18)";
    return (
        <Box
            sx={{
                width: 120, height: 120, borderRadius: "50%", bgcolor: tint,
                display: "flex", alignItems: "center", justifyContent: "center", boxShadow: shadow,
            }}
        >
            {children}
        </Box>
    );
}

function Title({children, sx}: {children: React.ReactNode; sx?: object}): JSX.Element {
    return (
        <Typography sx={{mt: 3, fontWeight: 800, fontSize: 24, letterSpacing: "-0.01em", textAlign: "center", ...sx}}>
            {children}
        </Typography>
    );
}

function Subtitle({children}: {children: React.ReactNode}): JSX.Element {
    return (
        <Typography sx={{mt: 1, color: TEXT_MUTED, fontSize: 15, lineHeight: 1.45, textAlign: "center", maxWidth: 320}}>
            {children}
        </Typography>
    );
}

/** The OTP sheet's CTA: pill, brand gradient, and a shadow tinted with the button's own colour. */
function BrandButton({label, onClick, disabled, busy}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    busy?: boolean;
}): JSX.Element {
    return (
        <Button
            fullWidth
            variant="contained"
            disabled={disabled}
            onClick={onClick}
            // The spinner sits BESIDE the label rather than replacing it: a button whose text
            // vanishes mid-press reads as a different button, and the mobile screen shows the same
            // pairing.
            startIcon={busy ? <CircularProgress size={16} sx={{color: "#fff"}}/> : undefined}
            sx={{
                py: 1.6,
                color: "#fff",
                textTransform: "none",
                fontSize: "1.05rem",
                fontWeight: 700,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${BRAND_RED} 0%, ${BRAND_RED_DARK} 100%)`,
                boxShadow: "0 10px 24px rgba(228,75,76,0.30)",
                "&:hover": {
                    background: "linear-gradient(135deg, #d83f40 0%, #C33132 100%)",
                    boxShadow: "0 10px 24px rgba(228,75,76,0.34)",
                },
                "&.Mui-disabled": {background: "#f0c9ca", color: "#fff", boxShadow: "none"},
            }}
        >
            {label}
        </Button>
    );
}

/** The secondary control, styled after the OTP sheet's Resend link rather than left to MUI. */
function QuietButton({label, onClick}: {label: string; onClick: () => void}): JSX.Element {
    return (
        <Button
            fullWidth
            variant="text"
            onClick={onClick}
            sx={{py: 1.2, borderRadius: 999, textTransform: "none", fontWeight: 700, color: BRAND_RED}}
        >
            {label}
        </Button>
    );
}

/** The OTP sheet's warm ground, and a column narrow enough to read on a phone. */
function Shell({children}: {children: React.ReactNode}): JSX.Element {
    return (
        <Box
            sx={{
                minHeight: "100dvh",
                "@supports not (height: 100dvh)": {minHeight: "100vh"},
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: SHEET_GROUND, px: 3, py: 6,
            }}
        >
            <Box sx={{width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center"}}>
                {children}
            </Box>
        </Box>
    );
}
