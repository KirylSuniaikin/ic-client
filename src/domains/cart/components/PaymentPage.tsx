import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import type { CartItem, MenuItem } from "../../menu/types";
import { ItemPopupShell } from "../../menu/components/popups/ItemPopupShell";
import { useDesktopLayout } from "../../../shared/hooks/useDesktopLayout";
import { useLocalizedItem } from "../../../shared/hooks/useLocalizedItem";
import { ApplePayButton } from "../../order/components/ApplePayButton";
import { DEFAULT_PAYMENT_METHOD } from "../../order/types";
import { APPLE_PAY_CHOICE } from "../hooks/usePaymentChoice";
import type { PaymentChoice } from "../hooks/usePaymentChoice";
import { PaymentMethodList } from "./PaymentMethodList";
import { PaymentInviteBubble } from "./PaymentInvite";
import { ActionButton, SCREEN_ROOT_SX, ScreenHeader } from "./CartChrome";

/** Where the order is going: "Pick up from" a branch, or "Deliver to" an address. */
export interface Fulfilment {
    title: string;
    name: string;
    detail: string;
}

export interface PaymentPageProps {
    open: boolean;
    /** Back to the step before: the cart, or the delivery address. */
    onBack: () => void;
    items: CartItem[];
    /** Names the items in the customer's language; CartItem carries only the English name. */
    menuData: MenuItem[];
    total: string;
    fulfilment: Fulfilment;
    choices: readonly PaymentChoice[];
    selected: PaymentChoice | null;
    onSelect: (choice: PaymentChoice) => void;
    /** Pays with the chosen method. Called inside the tap, which Apple Pay's sheet requires. */
    onPay: (choice: PaymentChoice) => void;
    busy: boolean;
    /**
     * Pickup only: opens the branch picker over this page, which turns the "Pick up from" card into
     * a button (owner, 19 Oct 2026: the branch picker moved here from the cart). Delivery leaves it
     * out; its address is changed by going Back.
     */
    onChangeBranch?: () => void;
}

// The gray track of the cart's delivery-type toggle, so the fulfilment reads as part of the same
// checkout the customer just left.
const FULFILMENT_CARD_SX = {
    minHeight: 48,
    px: 2,
    py: 1,
    borderRadius: 3,
    backgroundColor: "#f3f3f3",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
} satisfies SxProps<Theme>;

// White on the page's #FAFAFA, like the cart's item cards.
const METHODS_CARD_SX = {
    px: 1,
    borderRadius: 3,
    backgroundColor: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
} satisfies SxProps<Theme>;

const SINGLE_LINE_SX = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } satisfies SxProps<Theme>;

const FULFILMENT_BUTTON_SX = {
    ...FULFILMENT_CARD_SX,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    textAlign: "start",
    textTransform: "none",
    // Without this MUI tints the hover with the primary red, which the cart's toggles never do.
    "&:hover": { backgroundColor: FULFILMENT_CARD_SX.backgroundColor },
} satisfies SxProps<Theme>;

interface FulfilmentCardProps {
    fulfilment: Fulfilment;
    onChange?: () => void;
    disabled: boolean;
}

/** Where the order is going: a button with a chevron when it can be changed here, plain otherwise. */
function FulfilmentCard({ fulfilment, onChange, disabled }: FulfilmentCardProps): JSX.Element {
    // The RTL emotion cache mirrors the card's layout but not an icon's glyph, so the chevron has
    // to be chosen by direction to keep pointing "onward".
    const isRtl = useTheme().direction === "rtl";
    const lines = (
        <>
            <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#000", ...SINGLE_LINE_SX }}>
                {fulfilment.name}
            </Typography>
            {fulfilment.detail !== "" && (
                <Typography sx={{ fontSize: "12px", color: "#666", ...SINGLE_LINE_SX }}>
                    {fulfilment.detail}
                </Typography>
            )}
        </>
    );
    if (onChange === undefined) {
        return <Box data-testid="payment-fulfilment" sx={{ ...FULFILMENT_CARD_SX, mb: 2.5 }}>{lines}</Box>;
    }
    const Chevron = isRtl ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;
    return (
        <Button
            data-testid="payment-fulfilment"
            fullWidth
            onClick={onChange}
            disabled={disabled}
            aria-label={`${fulfilment.title} ${fulfilment.name}`}
            sx={{ ...FULFILMENT_BUTTON_SX, mb: 2.5 }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>{lines}</Box>
            <Chevron sx={{ color: "#666", flexShrink: 0 }} />
        </Button>
    );
}

function lineTotal(item: CartItem): string {
    return (item.amount * (1 - (item.discountAmount || 0) / 100) * item.quantity).toFixed(2);
}

/** The order, read-only: PC's left column, where the cart shows its items. */
function OrderSummary({ items, menuData }: { items: CartItem[]; menuData: MenuItem[] }): JSX.Element {
    const { t } = useTranslation("checkout");
    const { name: localizeName } = useLocalizedItem();
    const nameOf = (rawName: string): string => {
        const source = menuData.find((m) => m.name === rawName);
        return source ? localizeName(source) : rawName;
    };
    return (
        <>
            <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
                {t("delivery.yourOrder")}
            </Typography>
            {items.map((item, index) => (
                <Box key={index} sx={{ display: "flex", justifyContent: "space-between", gap: 2, mb: 1 }}>
                    <Typography variant="body2" sx={{ color: "#3b352c" }}>
                        {item.quantity} × {nameOf(item.name)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#3b352c", whiteSpace: "nowrap" }}>
                        {lineTotal(item)}
                    </Typography>
                </Box>
            ))}
        </>
    );
}

/**
 * The payment page (owner, 19 Oct 2026). The cart asks only pickup or delivery; a guest then signs
 * in with their phone; and here every method this customer can use is laid out, with one button
 * that pays with the chosen one. Drawn in the cart's own frame — the same header and red button on
 * the phone, the same two-column dialog on PC — so it reads as the cart moving on.
 *
 * The total is on the button itself, in every state, rather than on a line above it (owner,
 * 19 Oct 2026). Apple's own button cannot carry it, and none of Apple's rules asks for it next to
 * that button: Apple's payment sheet, which the tap opens, shows the total the customer authorises.
 *
 * A pickup's "Pick up from" card is where the branch is changed: it moved here from the cart, which
 * needed the room for its items (owner, 19 Oct 2026).
 */
export function PaymentPage({
    open, onBack, items, menuData, total, fulfilment, choices, selected, onSelect, onPay, busy, onChangeBranch,
}: PaymentPageProps): JSX.Element {
    const { t } = useTranslation("paymentChoice");
    const isDesktop = useDesktopLayout();
    const methodsTitleId = useId();

    function payButton(): JSX.Element {
        if (selected === null) {
            return <ActionButton label={t("choosePlaceholder", { amount: total })} onClick={() => {}} disabled />;
        }
        // Apple's own button, whose sheet has to open inside this very tap.
        if (selected === APPLE_PAY_CHOICE) {
            return <ApplePayButton onClick={() => onPay(selected)} disabled={busy} />;
        }
        const label = selected === DEFAULT_PAYMENT_METHOD
            ? t("placeOrderAmount", { amount: total })
            : t("payAmount", { amount: total });
        return <ActionButton label={label} onClick={() => onPay(selected)} disabled={busy} />;
    }

    const content = (
        <>
            {/* A pickup branch missing from the branch list has no name, and a blank card says
                nothing: the cart's card hid itself the same way. */}
            {fulfilment.name !== "" && (
                <>
                    <Typography variant="subtitle2" sx={{ color: "#000", mb: 0.75 }}>
                        {fulfilment.title}
                    </Typography>
                    <FulfilmentCard fulfilment={fulfilment} onChange={onChangeBranch} disabled={busy} />
                </>
            )}

            <PaymentInviteBubble />
            <Typography id={methodsTitleId} variant="subtitle2" sx={{ color: "#000", mb: 0.75 }}>
                {t("cart:paymentTitle")}
            </Typography>
            <Box sx={METHODS_CARD_SX}>
                <PaymentMethodList choices={choices} selected={selected} onSelect={onSelect} labelledBy={methodsTitleId} />
            </Box>
        </>
    );

    return (
        <ItemPopupShell
            open={open}
            onClose={onBack}
            legacy={{ paperSx: SCREEN_ROOT_SX }}
            showClose={isDesktop}
            desktop={{ aside: <OrderSummary items={items} menuData={menuData} /> }}
            footer={isDesktop ? payButton() : undefined}
        >
            {isDesktop ? (
                <Box sx={{ px: 3, pb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
                        {t("title")}
                    </Typography>
                    {content}
                </Box>
            ) : (
                <>
                    <ScreenHeader title={t("title")} onBack={onBack} backLabel={t("back")} />
                    <Box sx={{ flex: 1, overflowY: "auto", px: 3, pt: 2.5, pb: 2 }}>
                        {content}
                    </Box>
                    {payButton()}
                </>
            )}
        </ItemPopupShell>
    );
}
