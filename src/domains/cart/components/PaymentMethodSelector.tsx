import { useId, useState } from "react";
import type { KeyboardEvent, SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { APPLE_PAY_CHOICE, CARD_CHOICE } from "../hooks/usePaymentChoice";
import type { PaymentChoice } from "../hooks/usePaymentChoice";
import { CustomerSheet } from "../../../shared/components/CustomerSheet";
import type { CustomerSheetDesktop } from "../../../shared/components/CustomerSheet";
import { SHEET_DESKTOP, SHEET_PAPER_SX, SheetCloseButton, SheetHandle } from "../../delivery/components/sheetStyles";
import { BRAND_RED } from "../../../shared/utils/theme";

// Canonical payment values sent to the backend; the visible labels are translated in the selector.
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
const PAYMENT_OPTIONS: Readonly<Record<PaymentChoice, { labelKey: string; logo?: string }>> = {
    [DEFAULT_PAYMENT_METHOD]: { labelKey: "payment.atCounter" },
    [PAY_ONLINE_METHOD]: { labelKey: "payment.benefit", logo: "/benefit-logo.png" },
    [WALLET_METHOD]: { labelKey: "payment.benefitPay", logo: "/benefitpay-logo.png" },
    [APPLE_PAY_CHOICE]: { labelKey: "checkout:delivery.payApplePay" },
    [CARD_CHOICE]: { labelKey: "checkout:delivery.payCard" },
};

/**
 * Height of the payment marks. Both are cropped square-ish lockups, so one height reads as one
 * size for both — matching them by WIDTH would make the wider one look smaller.
 *
 * The images live in public/ beside jahez-logo.png and keeta-logo.png, the convention already in
 * use for partner marks. They are trademarks: use the files BENEFIT supply, never a redraw.
 */
const PAYMENT_LOGO_HEIGHT = 20;

// The cart's brandGray track, so the row reads as a sibling of the "Pick up from" card above it.
const TRACK_GRAY = "#f3f3f3";

const SINGLE_LINE_SX = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies SxProps<Theme>;

/**
 * The one-line selector (owner's option A, 18 Oct 2026). It replaced a row of chips because that
 * row scrolled sideways on phones and hid every method past the third; a single row naming the
 * chosen method stays one line however many methods a customer gets, and one tap lists them all.
 * Drawn like the "Pick up from" card above it — same track, radius and onward chevron — so the
 * two read as one family.
 */
const SELECTOR_ROW_SX = {
    width: "100%",
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 1,
    px: 2,
    py: 1,
    borderRadius: 3,
    backgroundColor: TRACK_GRAY,
    color: "#000",
    textAlign: "start",
    textTransform: "none",
    // Without this MUI tints the hover with the primary red, which the card above never does.
    "&:hover": { backgroundColor: TRACK_GRAY },
} satisfies SxProps<Theme>;

// No ripple on the options: a pick closes the sheet at once, so a tap ripple would never be seen,
// and a focus ripple pulsing on every arrow press is louder than the plain ring the mockup drew.
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

// A locked method's label and mark, greyed like any disabled control. Set on the content rather
// than the option, so every option keeps OPTION_SX's one class and its "& + &" separator.
const LOCKED_CONTENT_SX = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    color: "text.disabled",
} satisfies SxProps<Theme>;

const LOCKED_NOTE_SX = {
    display: "block",
    mt: 0.25,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.3,
    color: "#666",
} satisfies SxProps<Theme>;

// The cart is a MUI Modal at theme.zIndex.modal (1300) and a Drawer defaults to zIndex.drawer
// (1200); MUI never raises a later modal, so without this the sheet would open behind the cart.
// modal + 1, the same layer as the branch picker that the cart also opens.
const ABOVE_CART_SX: SxProps<Theme> = { zIndex: (theme: Theme) => theme.zIndex.modal + 1 };

// PC: the delivery sheets' warm centred dialog, narrowed to 440px — five short rows in a 520px
// dialog read as a mostly empty box.
const PAYMENT_SHEET_DESKTOP = { ...SHEET_DESKTOP, width: 440 } satisfies CustomerSheetDesktop;

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

/** A method's mark: BENEFIT's own lockup, the card glyph, or nothing for the rest. */
function PaymentMark({ choice }: { choice: PaymentChoice }): JSX.Element | null {
    const logo = PAYMENT_OPTIONS[choice].logo;
    if (logo !== undefined) {
        return (
            <Box
                component="img"
                src={logo}
                alt=""
                aria-hidden
                sx={{ height: PAYMENT_LOGO_HEIGHT, width: "auto", flexShrink: 0, objectFit: "contain", display: "block" }}
                // The mark is decoration beside a label that already names the method, so a
                // missing file must cost nothing: hide it and let the text stand alone rather
                // than show a broken image.
                onError={(e: SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = "none";
                }}
            />
        );
    }
    if (choice === CARD_CHOICE) {
        return <CreditCardRoundedIcon aria-hidden sx={{ fontSize: PAYMENT_LOGO_HEIGHT, flexShrink: 0 }} />;
    }
    return null;
}

interface PaymentOptionListProps {
    choices: readonly PaymentChoice[];
    locked: readonly PaymentChoice[];
    selected: PaymentChoice | null;
    labelledBy: string;
    onPick: (choice: PaymentChoice) => void;
}

function PaymentOptionList({ choices, locked, selected, labelledBy, onPick }: PaymentOptionListProps): JSX.Element {
    const { t } = useTranslation("cart");
    const isRtl = useTheme().direction === "rtl";
    // The locked method last tapped: it answers with why it cannot be picked, and the sheet stays.
    const [explained, setExplained] = useState<PaymentChoice | null>(null);
    const noteId = useId();
    const pickable = choices.filter((choice) => !locked.includes(choice));
    const tabStop = selected !== null && pickable.includes(selected) ? selected : (pickable[0] ?? choices[0]);

    // Arrow keys move focus and leave the choice alone; Space or Enter picks. The ARIA radio
    // pattern also checks on arrow, but a pick here closes the sheet, so every arrow press would
    // throw a keyboard user out of the list before they reached the method they wanted.
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
                const label = t(PAYMENT_OPTIONS[choice].labelKey);
                if (locked.includes(choice)) {
                    const explaining = explained === choice;
                    return (
                        // Still a focusable radio, so it is found and its note can be asked for by
                        // keyboard too; aria-disabled says it cannot be chosen. Named by its label
                        // alone, with the note as its description once shown.
                        <Button
                            key={choice}
                            role="radio"
                            aria-checked={false}
                            aria-disabled
                            aria-label={label}
                            aria-describedby={explaining ? noteId : undefined}
                            tabIndex={choice === tabStop ? 0 : -1}
                            disableRipple
                            onClick={() => setExplained(choice)}
                            sx={OPTION_SX}
                        >
                            <LockRoundedIcon aria-hidden sx={{ fontSize: 22, flexShrink: 0, color: "#bbb" }} />
                            <Box component="span" sx={LOCKED_CONTENT_SX}>
                                <PaymentMark choice={choice} />
                                <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                                    <Box component="span" sx={{ display: "block", ...SINGLE_LINE_SX }}>{label}</Box>
                                    {explaining && (
                                        <Box component="span" id={noteId} role="status" sx={LOCKED_NOTE_SX}>
                                            {t("paymentChoice:signInRequired")}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Button>
                    );
                }
                const RadioMark = checked ? RadioButtonCheckedRoundedIcon : RadioButtonUncheckedRoundedIcon;
                return (
                    <Button
                        key={choice}
                        role="radio"
                        aria-checked={checked}
                        // One tab stop for the whole group, on the chosen method (the first one
                        // that can be picked while nothing is chosen), which is also where focus
                        // lands on opening.
                        tabIndex={choice === tabStop ? 0 : -1}
                        autoFocus={choice === tabStop}
                        disableRipple
                        onClick={() => onPick(choice)}
                        sx={OPTION_SX}
                    >
                        <RadioMark aria-hidden sx={{ fontSize: 22, flexShrink: 0, color: checked ? BRAND_RED : "#bbb" }} />
                        <PaymentMark choice={choice} />
                        <Box component="span" sx={{ flex: 1, minWidth: 0, ...SINGLE_LINE_SX }}>
                            {label}
                        </Box>
                    </Button>
                );
            })}
        </Box>
    );
}

export interface PaymentMethodSelectorProps {
    /** Every method to list, in display order, locked ones included (usePaymentChoice's `choices`). */
    choices: readonly PaymentChoice[];
    /** Listed with a lock, and answering a tap with "sign in first" instead of being picked. */
    locked: readonly PaymentChoice[];
    /** Null until the customer picks one: the row then invites them to look at the methods. */
    selected: PaymentChoice | null;
    onSelect: (choice: PaymentChoice) => void;
    /**
     * Whether the list is open. Owned by the cart, because its pay button also opens the list
     * when nothing is chosen yet.
     */
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * The chosen method as one row; tapping it opens every method as a radio list in a bottom sheet on
 * the phone and in a centred dialog on PC (CustomerSheet). Picking a method closes it, and the
 * sheet hands focus back to the row.
 *
 * The row names only the method. Its "Payment method" label is the cart's section title above it,
 * like "Pick up from" over the branch card: an in-row "Pay with" read "الدفع عبر الدفع عند الاستلام"
 * ("pay via pay on collection") in Arabic with the counter tender chosen.
 *
 * Nothing is preselected (owner, 18 Oct 2026), so until the customer picks a method the row asks
 * them to choose; the cart's bubble above carries the news of the new methods. Its copy is in the
 * web-only paymentChoice namespace, because mobile byte-compares the cart's.
 */
export function PaymentMethodSelector({
    choices, locked, selected, onSelect, open, onOpenChange,
}: PaymentMethodSelectorProps): JSX.Element {
    const { t } = useTranslation("cart");
    // The RTL emotion cache mirrors the row's layout but not an icon's glyph, so the chevron has
    // to be chosen by direction to keep pointing "onward".
    const isRtl = useTheme().direction === "rtl";
    const titleId = useId();

    const rowLabel = selected === null ? t("paymentChoice:choosePlaceholder") : t(PAYMENT_OPTIONS[selected].labelKey);
    const rowContent = (
        <Box component="span" sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 0.75 }}>
            {selected !== null && <PaymentMark choice={selected} />}
            <Typography
                component="span"
                sx={{ fontSize: "14px", fontWeight: 700, color: selected === null ? "#666" : "#000", ...SINGLE_LINE_SX }}
            >
                {rowLabel}
            </Typography>
        </Box>
    );

    // A chevron and a sheet with nothing else in it would promise a choice that does not exist.
    // While nothing is chosen, though, the sheet is where even a sole method gets chosen.
    if (choices.length < 2 && selected !== null) {
        return <Box data-testid="cart-payment-static-row" sx={SELECTOR_ROW_SX}>{rowContent}</Box>;
    }

    const close = (): void => onOpenChange(false);

    function pick(choice: PaymentChoice): void {
        // Re-picking the current method changes nothing, exactly as tapping the selected chip did.
        if (choice !== selected) onSelect(choice);
        close();
    }

    return (
        <>
            <Button
                onClick={() => onOpenChange(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                // Section title then value, as the "Pick up from" card is named; it also keeps the
                // row from ever sharing a name with Apple's "Pay with Apple Pay" button below.
                aria-label={`${t("paymentTitle")} ${rowLabel}`}
                sx={SELECTOR_ROW_SX}
            >
                {rowContent}
                {isRtl ? (
                    <ChevronLeftRoundedIcon data-testid="cart-payment-chevron-left" sx={{ color: "#666", flexShrink: 0 }} />
                ) : (
                    <ChevronRightRoundedIcon data-testid="cart-payment-chevron-right" sx={{ color: "#666", flexShrink: 0 }} />
                )}
            </Button>

            <CustomerSheet
                open={open}
                onClose={close}
                sx={ABOVE_CART_SX}
                labelledBy={titleId}
                desktop={PAYMENT_SHEET_DESKTOP}
                PaperProps={{ role: "dialog", "aria-labelledby": titleId, sx: SHEET_PAPER_SX }}
            >
                <Box sx={{ p: 3, pb: 4 }}>
                    <SheetHandle />
                    <SheetCloseButton onClose={close} />
                    <Typography id={titleId} variant="h6" sx={{ fontWeight: 700, textAlign: "center", mb: 1 }}>
                        {t("paymentTitle")}
                    </Typography>
                    <PaymentOptionList choices={choices} locked={locked} selected={selected} labelledBy={titleId} onPick={pick} />
                </Box>
            </CustomerSheet>
        </>
    );
}
