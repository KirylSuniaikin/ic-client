import type { KeyboardEvent, SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button } from "@mui/material";
import type { SvgIcon, SxProps, Theme } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AppleIcon from "@mui/icons-material/Apple";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { CARD_CHOICE, APPLE_PAY_CHOICE } from "../hooks/usePaymentChoice";
import type { PaymentChoice } from "../hooks/usePaymentChoice";
import { BRAND_RED } from "../../../shared/utils/theme";

// Canonical payment values sent to the backend; the visible labels are translated in the list.
//
// Three choices, two of which take money now:
//   At counter  — pay on collection. Cash and card were separate options; the customer decides at
//                 the till either way, and staff record the real tender at the POS. The VALUE is
//                 unchanged from the old default, deliberately: PaymentService gates the cash
//                 drawer on the exact string "Cash", the admin edit dropdown offers these three
//                 literals, and historic stats group by them. Only the label collapsed.
//   Benefit     — BPG's hosted card page. Card number and PIN on BENEFIT's own domain.
//   BenefitPay  — the wallet. A QR the customer scans with their phone, on our page.
// Online-only by product decision: every customer order is paid before it reaches the kitchen,
// so there is no pay-at-counter option here. DEFAULT_PAYMENT_METHOD still exists and is still the
// kiosk's tender (useKioskCheckout) — it is the customer-facing CHOICE that was removed, not the
// tender string, so historic orders and the admin dropdown are unaffected.
//
// Apple Pay and card join the same list when the customer can use them, so every method is one
// option of one list and a single button below pays with the selected one (owner's choice, Oct
// 2026). Their labels reuse the delivery drawer's, which already names the same methods.
//
// Paying at the counter is back for now (owner, 17 Oct 2026) while BenefitPay confirmation is made
// independent of the customer's browser. It sends DEFAULT_PAYMENT_METHOD, which useCheckout routes
// to the plain createOrder flow exactly as before the online rollout.
//
// Every method carries a mark (owner, 19 Oct 2026): BENEFIT's own lockups, and a glyph for the rest.
type PaymentOption = { labelKey: string } & ({ logo: string } | { Icon: typeof SvgIcon });

const PAYMENT_OPTIONS: Readonly<Record<PaymentChoice, PaymentOption>> = {
    [DEFAULT_PAYMENT_METHOD]: { labelKey: "payment.atCounter", Icon: StorefrontRoundedIcon },
    [PAY_ONLINE_METHOD]: { labelKey: "payment.benefit", logo: "/benefit-logo.png" },
    [WALLET_METHOD]: { labelKey: "payment.benefitPay", logo: "/benefitpay-logo.png" },
    [APPLE_PAY_CHOICE]: { labelKey: "checkout:delivery.payApplePay", Icon: AppleIcon },
    [CARD_CHOICE]: { labelKey: "checkout:delivery.payCard", Icon: CreditCardRoundedIcon },
};

/**
 * Height of the payment marks. Both are cropped square-ish lockups, so one height reads as one
 * size for both — matching them by WIDTH would make the wider one look smaller.
 *
 * The images live in public/ beside jahez-logo.png and keeta-logo.png, the convention already in
 * use for partner marks. They are trademarks: use the files BENEFIT supply, never a redraw.
 */
const PAYMENT_LOGO_HEIGHT = 20;

// Each mark sits in a slot of one width, so every label starts at the same edge however narrow
// or wide the mark inside it is.
const MARK_SLOT_SX = {
    width: 24,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
} satisfies SxProps<Theme>;

const SINGLE_LINE_SX = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies SxProps<Theme>;

// No ripple on the options: the radio mark already answers a tap, and a focus ripple pulsing on
// every arrow press is louder than the plain focus ring.
const OPTION_SX = {
    width: "100%",
    minHeight: 52,
    justifyContent: "flex-start",
    gap: 1.25,
    px: 1,
    py: 1.25,
    borderRadius: 0,
    color: "#000",
    fontSize: "15px",
    fontWeight: 500,
    textAlign: "start",
    textTransform: "none",
    "&:hover": { backgroundColor: "action.hover" },
    "&.Mui-focusVisible": { outline: `2px solid ${BRAND_RED}`, outlineOffset: "2px" },
    "& + &": { borderTop: "1px solid #eee" },
} satisfies SxProps<Theme>;

type FocusMove = 1 | -1 | "first" | "last";

// The list runs top to bottom, so Up/Down are the real keys; Left/Right follow the reading
// direction like any other radio group.
function focusMoveFor(key: string, isRtl: boolean): FocusMove | null {
    switch (key) {
        case "ArrowDown": return 1;
        case "ArrowUp": return -1;
        case "ArrowRight": return isRtl ? -1 : 1;
        case "ArrowLeft": return isRtl ? 1 : -1;
        case "Home": return "first";
        case "End": return "last";
        default: return null;
    }
}

/** A method's mark: BENEFIT's own lockup, or the method's glyph. */
function PaymentMark({ choice }: { choice: PaymentChoice }): JSX.Element {
    const option = PAYMENT_OPTIONS[choice];
    return (
        <Box component="span" data-testid="payment-mark" aria-hidden sx={MARK_SLOT_SX}>
            {"logo" in option ? (
                <Box
                    component="img"
                    src={option.logo}
                    alt=""
                    aria-hidden
                    sx={{ height: PAYMENT_LOGO_HEIGHT, width: "auto", objectFit: "contain", display: "block" }}
                    // The mark is decoration beside a label that already names the method, so a
                    // missing file must cost nothing: hide it and let the text stand alone rather
                    // than show a broken image.
                    onError={(e: SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.style.display = "none";
                    }}
                />
            ) : (
                <option.Icon aria-hidden sx={{ fontSize: PAYMENT_LOGO_HEIGHT }} />
            )}
        </Box>
    );
}

export interface PaymentMethodListProps {
    /** Every method this customer can pay with, in display order (usePaymentChoice's `choices`). */
    choices: readonly PaymentChoice[];
    /** Null until the customer picks one. */
    selected: PaymentChoice | null;
    onSelect: (choice: PaymentChoice) => void;
    /** The id of the heading that names the list. */
    labelledBy: string;
}

/**
 * Every method as one radio list on the payment page (owner, 19 Oct 2026). The cart used to hold
 * the methods in a one-line selector; it now asks only pickup or delivery, and the methods are
 * laid out here in full.
 */
export function PaymentMethodList({ choices, selected, onSelect, labelledBy }: PaymentMethodListProps): JSX.Element {
    const { t } = useTranslation("cart");
    const isRtl = useTheme().direction === "rtl";
    const tabStop = selected !== null && choices.includes(selected) ? selected : choices[0];

    // Arrow keys move focus and leave the choice alone; Space or Enter picks, so a keyboard user
    // passing over Apple Pay on the way down does not swap the pay button under them.
    function moveFocus(event: KeyboardEvent<HTMLElement>): void {
        const move = focusMoveFor(event.key, isRtl);
        if (move === null) return;
        event.preventDefault();
        const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
        const current = radios.findIndex((radio) => radio === document.activeElement);
        const target = move === "first" ? 0
            : move === "last" ? radios.length - 1
                : (current + move + radios.length) % radios.length;
        radios[target]?.focus();
    }

    return (
        <Box role="radiogroup" aria-labelledby={labelledBy} onKeyDown={moveFocus}>
            {choices.map((choice) => {
                const checked = choice === selected;
                const RadioMark = checked ? RadioButtonCheckedRoundedIcon : RadioButtonUncheckedRoundedIcon;
                return (
                    <Button
                        key={choice}
                        role="radio"
                        aria-checked={checked}
                        // One tab stop for the whole group, on the chosen method (the first one
                        // while nothing is chosen).
                        tabIndex={choice === tabStop ? 0 : -1}
                        disableRipple
                        onClick={() => onSelect(choice)}
                        sx={OPTION_SX}
                    >
                        <RadioMark aria-hidden sx={{ fontSize: 22, flexShrink: 0, color: checked ? BRAND_RED : "#bbb" }} />
                        <PaymentMark choice={choice} />
                        <Box component="span" sx={{ flex: 1, minWidth: 0, ...SINGLE_LINE_SX }}>
                            {t(PAYMENT_OPTIONS[choice].labelKey)}
                        </Box>
                    </Button>
                );
            })}
        </Box>
    );
}
