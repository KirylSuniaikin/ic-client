import { useEffect, useRef, useState } from "react";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { logger } from "../../../shared/utils/logger";

/**
 * Apple Pay and card are not payment_type values: each runs its own checkout (useApplePayCheckout,
 * useCardCheckout) and never goes through the order's payment string. So only the counter and the
 * two BENEFIT choices travel through `paymentMethod`; these two live in this hook alone.
 */
export const APPLE_PAY_CHOICE = "applePay";
export const CARD_CHOICE = "card";

type TenderChoice = typeof DEFAULT_PAYMENT_METHOD | typeof PAY_ONLINE_METHOD | typeof WALLET_METHOD;
type CheckoutChoice = typeof APPLE_PAY_CHOICE | typeof CARD_CHOICE;
export type PaymentChoice = TenderChoice | CheckoutChoice;

const STORAGE_KEY = "ic.preferredPaymentMethod";

function isTenderChoice(value: string | null): value is TenderChoice {
    return value === DEFAULT_PAYMENT_METHOD || value === PAY_ONLINE_METHOD || value === WALLET_METHOD;
}

function isCheckoutChoice(value: string | null): value is CheckoutChoice {
    return value === APPLE_PAY_CHOICE || value === CARD_CHOICE;
}

// A remembered method is a convenience: private mode, blocked storage or a stale value must all
// simply mean "no preference".
function readPreference(): PaymentChoice | null {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return isTenderChoice(stored) || isCheckoutChoice(stored) ? stored : null;
    } catch (failure: unknown) {
        logger.debug("Payment preference unreadable:", failure);
        return null;
    }
}

function writePreference(choice: PaymentChoice): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, choice);
    } catch (failure: unknown) {
        logger.debug("Payment preference not saved:", failure);
    }
}

interface UsePaymentChoiceParams {
    /** Whether the cart shows the choice at all (customer pickup). Nothing is restored otherwise. */
    enabled: boolean;
    paymentMethod: string;
    onPaymentChange: (value: string) => void;
    applePayAvailable: boolean;
    cardAvailable: boolean;
}

export interface UsePaymentChoiceResult {
    choices: PaymentChoice[];
    selected: PaymentChoice;
    select: (choice: PaymentChoice) => void;
    /** Called when the customer actually pays, so the next cart opens on the method they used. */
    remember: () => void;
}

export function usePaymentChoice({
    enabled, paymentMethod, onPaymentChange, applePayAvailable, cardAvailable,
}: UsePaymentChoiceParams): UsePaymentChoiceResult {
    const [preference] = useState<PaymentChoice | null>(readPreference);
    const [checkoutChoice, setCheckoutChoice] = useState<CheckoutChoice | null>(null);
    // Once the customer has picked something in this cart, a late-arriving method (Apple Pay
    // turns available only after its eligibility prefetch) must not steal the selection.
    const touchedRef = useRef(false);

    const isAvailable = (choice: CheckoutChoice): boolean =>
        choice === APPLE_PAY_CHOICE ? applePayAvailable : cardAvailable;

    useEffect(() => {
        if (!enabled || touchedRef.current || !isTenderChoice(preference)) return;
        if (preference !== paymentMethod) onPaymentChange(preference);
        // Restores once per cart opening; later paymentMethod changes are the customer's own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    useEffect(() => {
        if (!enabled || touchedRef.current || !isCheckoutChoice(preference)) return;
        if (checkoutChoice === null && isAvailable(preference)) setCheckoutChoice(preference);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, applePayAvailable, cardAvailable]);

    const choices: PaymentChoice[] = [DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD];
    if (applePayAvailable) choices.push(APPLE_PAY_CHOICE);
    if (cardAvailable) choices.push(CARD_CHOICE);

    // A method that stops being available (sign-out, eligibility refused) falls back to the
    // tender. A tender the list does not offer falls back to BENEFIT, so what is highlighted is
    // always what is sent.
    const selected: PaymentChoice =
        checkoutChoice !== null && isAvailable(checkoutChoice) ? checkoutChoice
            : isTenderChoice(paymentMethod) ? paymentMethod
                : PAY_ONLINE_METHOD;

    function select(choice: PaymentChoice): void {
        touchedRef.current = true;
        if (isCheckoutChoice(choice)) {
            setCheckoutChoice(choice);
            return;
        }
        setCheckoutChoice(null);
        onPaymentChange(choice);
    }

    return { choices, selected, select, remember: () => writePreference(selected) };
}
