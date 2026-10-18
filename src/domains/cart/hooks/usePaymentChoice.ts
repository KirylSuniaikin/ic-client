import { useState } from "react";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";

/**
 * Apple Pay and card are not payment_type values: each runs its own checkout (useApplePayCheckout,
 * useCardCheckout) and never goes through the order's payment string. So only the counter and the
 * two BENEFIT choices travel as a tender; these two live in this hook alone.
 */
export const APPLE_PAY_CHOICE = "applePay";
export const CARD_CHOICE = "card";

type TenderChoice = typeof DEFAULT_PAYMENT_METHOD | typeof PAY_ONLINE_METHOD | typeof WALLET_METHOD;
type CheckoutChoice = typeof APPLE_PAY_CHOICE | typeof CARD_CHOICE;
export type PaymentChoice = TenderChoice | CheckoutChoice;

// Most used first, by how our Talabat customers paid (export of 11–17 Oct 2026, 257 delivered
// orders): Credit Card 50.6%, Cash 25.3%, not stated 12.1%, Debit Card 10.1%, Talabat Credit
// 1.9%. Card leads; Apple Pay and BenefitPay never appear there, so Apple Pay — card-funded —
// sits beside card, and Benefit stands in for "Debit Card" because Bahraini debit cards run on
// BENEFIT. At counter is last on the owner's instruction (18 Oct 2026), although cash ranks second.
const DISPLAY_ORDER: readonly PaymentChoice[] = [
    CARD_CHOICE, APPLE_PAY_CHOICE, PAY_ONLINE_METHOD, WALLET_METHOD, DEFAULT_PAYMENT_METHOD,
];

// What a delivery order can be paid with: the three methods EazyPay's hosted page takes. That page
// runs card and Apple Pay itself, so they are offered whatever our own card and Apple Pay checkouts
// would allow.
const DELIVERY_CHOICES: ReadonlySet<PaymentChoice> = new Set([CARD_CHOICE, APPLE_PAY_CHOICE, PAY_ONLINE_METHOD]);

export function isTenderChoice(value: PaymentChoice): value is TenderChoice {
    return value === DEFAULT_PAYMENT_METHOD || value === PAY_ONLINE_METHOD || value === WALLET_METHOD;
}

interface UsePaymentChoiceParams {
    applePayAvailable: boolean;
    cardAvailable: boolean;
    forDelivery: boolean;
}

export interface UsePaymentChoiceResult {
    choices: PaymentChoice[];
    /** Null until the customer picks a method on this opening of the payment page. */
    selected: PaymentChoice | null;
    select: (choice: PaymentChoice) => void;
}

/**
 * Nothing is chosen for the customer (owner, 18 Oct 2026): the payment page opens with no method
 * selected, neither a default nor the method used last time, so customers meet the new methods
 * instead of paying the way they always have. The page is mounted only while it is open, so the
 * pick lives exactly as long as that opening.
 */
export function usePaymentChoice({
    applePayAvailable, cardAvailable, forDelivery,
}: UsePaymentChoiceParams): UsePaymentChoiceResult {
    const [picked, setPicked] = useState<PaymentChoice | null>(null);

    const isOffered = (choice: PaymentChoice): boolean =>
        forDelivery ? DELIVERY_CHOICES.has(choice)
            : choice === APPLE_PAY_CHOICE ? applePayAvailable
                : choice === CARD_CHOICE ? cardAvailable
                    : true;

    const choices = DISPLAY_ORDER.filter(isOffered);

    // A picked method that stops being available (sign-out, eligibility refused) is no longer
    // selected, so the pay button cannot start a flow this customer can no longer use.
    const selected = picked !== null && isOffered(picked) ? picked : null;

    return { choices, selected, select: setPicked };
}
