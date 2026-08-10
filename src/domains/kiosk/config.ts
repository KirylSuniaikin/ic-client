// Web-kiosk timing/format constants.

/**
 * How long the customer gets to read the order-placed confirmation sheet before the kiosk resets
 * itself for the next customer.
 */
export const ORDER_PLACED_AUTO_RETURN_MS = 15_000;

/**
 * Bahrain-only phone entry — the kiosk is a physically-installed single-market device. Combined
 * these produce the "973########" string the order payload's `tel` field expects.
 */
export const PHONE_COUNTRY_CODE = "973";
export const PHONE_DIGIT_COUNT = 8;
