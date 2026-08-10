// Web-kiosk timing/format constants. Ported from ic-pizza-kiosk/services/config.ts (Expo/RN
// reference — see the same-named constants there) so both kiosks agree on cadence with EazyPay.
// Names deliberately mirror the RN source 1:1 to keep later phases (payment polling / checkout
// state machine) a straight port rather than a re-derivation.

/** How often the kiosk asks the backend whether the card has been tapped. */
export const PAYMENT_POLL_INTERVAL_MS = 2000;

/**
 * Hard stop for a payment attempt. Past this the kiosk cancels at the terminal and routes the
 * customer into the same "pay at the front desk?" failure flow as any other terminal failure.
 */
export const PAYMENT_TIMEOUT_MS = 120_000;

/**
 * How long an unanswered payment-failure sheet waits before assuming the customer walked away.
 *
 * On expiry the unpaid order is abandoned and the kiosk resets for the next customer. Silence
 * must resolve to "discard", never to "save": an order saved to the front desk that nobody is
 * standing at is food the kitchen may make and nobody collects.
 */
export const PAYMENT_FAILURE_PROMPT_TIMEOUT_MS = 60_000;

/**
 * How long the customer gets to read the approved-payment confirmation sheet before the kiosk
 * resets itself for the next customer. Copied verbatim from ic-pizza-kiosk's
 * app/(kiosk)/confirm.tsx `AUTO_RETURN_MS` (see §6 Open Question 2 — that constant lives inline
 * on the confirm screen there, not in services/config.ts, but it is the same value this task's
 * `APPROVED_AUTO_RETURN_MS` names).
 */
export const APPROVED_AUTO_RETURN_MS = 15_000;

/**
 * Bahrain-only phone entry — the kiosk is a physically-installed single-market device. Mirrors
 * ic-pizza-kiosk/domains/order/components/PhoneEntryPopup.tsx's `COUNTRY_CODE`/`PHONE_DIGITS`.
 * Combined they produce the "973########" string the order payload's `tel` field expects.
 */
export const PHONE_COUNTRY_CODE = "973";
export const PHONE_DIGIT_COUNT = 8;
