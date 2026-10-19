import { Box, Button, IconButton, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { BRAND_RED } from "../../../shared/utils/theme";
import { CARD_FIELD_IDS } from "../hooks/useCardCheckout";
import type { CardCheckoutStep, CardFieldErrors } from "../hooks/useCardCheckout";
import { CustomerSheet } from "../../../shared/components/CustomerSheet";
import type { CustomerSheetDesktop } from "../../../shared/components/CustomerSheet";
import { SheetHandle } from "../../delivery/components/sheetStyles";
import { DoughSauceLoader } from "./DoughSauceLoader";

interface CardPaymentDrawerProps {
    open: boolean;
    step: CardCheckoutStep;
    total: string;
    fieldErrors: CardFieldErrors;
    error: string | null;
    fieldContainerRef: (node: HTMLElement | null) => void;
    onClose: () => void;
    onPay: () => void;
    onRetry: () => void;
}

type FieldKey = keyof typeof CARD_FIELD_IDS;
const TITLE_ID = "card-payment-drawer-title";
const EXPIRY_LABEL_ID = "card-payment-expiry-label";

// Shown inside the gateway's hosted fields when it carries the attribute over; the same in every
// language, as the digits on a card are.
const PLACEHOLDERS: Readonly<Record<FieldKey, string>> = {
    cardNumber: "1234 1234 1234 1234",
    expiryMonth: "MM",
    expiryYear: "YY",
    securityCode: "123",
};

// PC: a centred 480px dialog at the same 1350 as the phone sheet.
const CARD_DESKTOP = {
    placement: "center",
    width: 480,
    paperSx: { backgroundColor: "#fffcf8" },
} satisfies CustomerSheetDesktop;

const CTA_SX = {
    borderRadius: 999, py: 1.5, textTransform: "none", fontWeight: 700, color: "#fff",
    background: `linear-gradient(135deg, ${BRAND_RED} 0%, #D0393A 100%)`,
    "&:hover": { filter: "brightness(0.94)" },
} as const;

// The font the gateway draws the card digits in: it copies this from our input into its frame.
const HOSTED_FONT_SIZE = "1rem";

const FIELD_BOX_SX = {
    display: "flex",
    alignItems: "center",
    minHeight: 48,
    border: "1px solid #f1eae4",
    borderRadius: 3,
    px: 1.5,
    py: 1,
    bgcolor: "#ffffff",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    // The gateway's session.js puts its iframe right after our input and, every 50 ms, briefly
    // un-hides the input to copy its width onto that iframe. A shrinking flex item shared the row
    // with the iframe, so it measured "box minus iframe" and the frame flipped between two widths
    // forever (a clipped, blinking number; a 4px CVV). An input that never shrinks measures the box.
    //
    // session.js also copies every computed style of our input onto the gateway's own input inside
    // the frame, padding included, so the browser's default input padding lands in there too. iOS
    // Safari's is 0.5em a side (WebKit html.css), which took 16px of a 32px expiry part and cut the
    // second M and Y in half. Zero inline padding makes the text box the same on every browser; the
    // field box's own padding is the inset. Block padding is left alone: it is the frame's tap height.
    "& input": {
        width: "100%", flexShrink: 0, border: 0, outline: 0, background: "transparent",
        fontSize: HOSTED_FONT_SIZE, paddingLeft: 0, paddingRight: 0,
    },
    // An inline iframe sits on the text baseline with a descender gap under it, which lifted the
    // expiry MM and YY above our slash; as a block it centres like the slash does.
    "& iframe": { display: "block" },
} as const;

const FIELD_LABEL_SX = { color: "#8a807a", display: "block", mb: 0.5 } as const;

// Month and year are two hosted fields (the gateway has no single expiry field), drawn as one
// "MM / YY" box, the slash between them ours. Each part is 2em of the hosted font, so it grows with
// that font: "MM", the widest thing either part shows, is 1.71em in iOS's SF Pro, 1.75em in Roboto
// and at most 1.81em (Noto Sans) among system fonts, so 2em fits it with room to spare everywhere
// while staying snug enough that the slash still reads as part of the date.
const EXPIRY_PART_SX = { fontSize: HOSTED_FONT_SIZE, width: "2em", flexShrink: 0 } as const;

// "MM" leaves about a quarter em of its part empty, so the slash takes that much less on its leading
// side and sits evenly between MM and YY. Logical sides: the RTL emotion cache flips left and right
// even inside this dir="ltr" box.
const EXPIRY_SLASH_SX = {
    color: "#8a807a", fontSize: HOSTED_FONT_SIZE, paddingInlineStart: "0.25em", paddingInlineEnd: "0.5em",
} as const;

function fieldBoxSx(invalid: boolean | undefined): SxProps<Theme> {
    return { ...FIELD_BOX_SX, ...(invalid ? { borderColor: BRAND_RED } : {}) };
}

/**
 * One of the gateway's hosted fields: our input is only where it mounts. No `name`, because the
 * value is owned by the gateway's field, never by our form. Each keeps its own accessible name
 * ("Expiry month", "Security code"), since the visible labels cover two fields or abbreviate.
 */
function HostedInput({ field, invalid }: { field: FieldKey; invalid: boolean | undefined }): React.JSX.Element {
    const { t } = useTranslation("cardPayment");
    return (
        <input
            id={CARD_FIELD_IDS[field]}
            title={t(`fields.${field}`)}
            aria-label={t(`fields.${field}`)}
            aria-invalid={invalid ? true : undefined}
            placeholder={PLACEHOLDERS[field]}
            readOnly
        />
    );
}

// Follows the bottom-sheet pattern of CashInputDrawer (the repo's canonical Drawer) with the
// brand-red CTA from DESIGN.md; the shared sheetStyles.tsx tokens do not exist in this checkout.
export default function CardPaymentDrawer({
    open, step, total, fieldErrors, error, fieldContainerRef, onClose, onPay, onRetry,
}: CardPaymentDrawerProps): React.JSX.Element {
    const { t } = useTranslation("cardPayment");
    const preparing = step === "preparing";
    const processing = step === "updatingSession" || step === "paying";
    const needsNewSession = step === "needsNewSession";

    return (
        <CustomerSheet
            open={open}
            onClose={onClose}
            sx={{ zIndex: 1350 }}
            labelledBy={TITLE_ID}
            desktop={CARD_DESKTOP}
            PaperProps={{
                role: "dialog",
                "aria-labelledby": TITLE_ID,
                sx: {
                    borderTopLeftRadius: { xs: 20, sm: 28 },
                    borderTopRightRadius: { xs: 20, sm: 28 },
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    backgroundImage: "none",
                    bgcolor: "#fffcf8",
                    maxHeight: "92vh",
                    overflowY: "auto",
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <SheetHandle />

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography id={TITLE_ID} variant="h6" fontWeight="bold" sx={{ color: "#3b352c" }}>
                        {t("drawer.title")}
                    </Typography>
                    <IconButton aria-label={t("drawer.close")} onClick={onClose} disabled={processing} size="small">
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                    <Typography sx={{ color: "#8a807a" }}>{t("drawer.total")}</Typography>
                    <Typography fontWeight="bold" sx={{ color: "#3b352c" }}>{total}</Typography>
                </Box>

                {/* While the session loads, the loader stands in for the fields (owner, 19 Oct 2026). */}
                <Box sx={{ position: "relative" }}>
                    {preparing && (
                        <Box sx={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <DoughSauceLoader label={t("loading")} />
                        </Box>
                    )}
                    {/* Kept mounted (only hidden) while a new session is needed, so a retry can re-attach.
                        Under the loader the fields stay laid out, only invisible: the gateway sizes its
                        frames from the inputs it replaces, and a display:none box has no size. The usual
                        card layout (owner, 19 Oct 2026): the number on its own line, then the expiry
                        date and CVV side by side. */}
                    <Box
                        ref={fieldContainerRef}
                        dir="ltr"
                        sx={{ display: needsNewSession ? "none" : "block", visibility: preparing ? "hidden" : "visible" }}
                    >
                        <Box sx={{ mb: 1.5 }}>
                            <Typography component="label" htmlFor={CARD_FIELD_IDS.cardNumber} variant="body2" sx={FIELD_LABEL_SX}>
                                {t("fields.cardNumber")}
                            </Typography>
                            <Box sx={fieldBoxSx(fieldErrors.cardNumber)}>
                                <HostedInput field="cardNumber" invalid={fieldErrors.cardNumber} />
                            </Box>
                        </Box>

                        <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography id={EXPIRY_LABEL_ID} variant="body2" sx={FIELD_LABEL_SX}>
                                    {t("fields.expiry")}
                                </Typography>
                                <Box
                                    role="group"
                                    aria-labelledby={EXPIRY_LABEL_ID}
                                    sx={fieldBoxSx(fieldErrors.expiryMonth || fieldErrors.expiryYear)}
                                >
                                    <Box sx={EXPIRY_PART_SX}>
                                        <HostedInput field="expiryMonth" invalid={fieldErrors.expiryMonth} />
                                    </Box>
                                    <Typography aria-hidden component="span" sx={EXPIRY_SLASH_SX}>/</Typography>
                                    <Box sx={EXPIRY_PART_SX}>
                                        <HostedInput field="expiryYear" invalid={fieldErrors.expiryYear} />
                                    </Box>
                                </Box>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography component="label" htmlFor={CARD_FIELD_IDS.securityCode} variant="body2" sx={FIELD_LABEL_SX}>
                                    {t("fields.cvv")}
                                </Typography>
                                <Box sx={fieldBoxSx(fieldErrors.securityCode)}>
                                    <HostedInput field="securityCode" invalid={fieldErrors.securityCode} />
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {error && (
                    <Typography role="alert" sx={{ color: BRAND_RED, mb: 2 }}>
                        {error}
                    </Typography>
                )}

                {needsNewSession ? (
                    <Button
                        fullWidth
                        onClick={onRetry}
                        sx={CTA_SX}
                    >
                        {t("actions.tryAgain")}
                    </Button>
                ) : (
                    <Button
                        fullWidth
                        onClick={onPay}
                        disabled={step !== "ready"}
                        aria-busy={processing}
                        sx={{
                            ...CTA_SX,
                            boxShadow: "0 10px 24px rgba(228,75,76,0.30)",
                            "&.Mui-disabled": { background: "#e9dedb", color: "#fff", boxShadow: "none" },
                        }}
                    >
                        {processing ? t("actions.paying") : t("actions.pay")}
                    </Button>
                )}
            </Box>
        </CustomerSheet>
    );
}
