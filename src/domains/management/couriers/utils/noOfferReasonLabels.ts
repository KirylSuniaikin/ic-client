import type {NoOfferReason} from "../types";

/**
 * Manager-readable text for the engine's verdicts. SCREAMING_SNAKE on a screen someone reads under
 * pressure is not an answer; these are the words the TODO itself uses.
 *
 * Extracted out of `DeliveryBoardPanel` so the Statistics aggregate can render the SAME words: the
 * board explains one rider at a time and the aggregate prices the same reasons over a week, and a
 * second, drifting vocabulary would make the two screens look like two different systems.
 */
export const NO_OFFER_REASON_LABELS: Record<NoOfferReason, string> = {
    DECLINED: 'Declined this order',
    NO_ANSWER: 'Never answered the offer',
    OFFLINE: 'Off shift',
    BLACKLISTED: 'Blacklisted',
    PINGING_OTHER_ORDER: 'Being offered another order',
    NO_RESOLVABLE_FREE_AT: 'No way to tell when they are free',
    POSITION_STALE: 'Last position too old to trust',
    TOO_FAR: 'Too far from the kitchen',
    BUSY_UNTIL: 'Busy',
};

/** Turns an unmapped wire value into words rather than shouting the raw constant at a manager. */
export function humaniseNoOfferReason(value: string): string {
    const words = value.toLowerCase().replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The label, falling back to humanised text because the backend enum can grow ahead of this client. */
export function noOfferReasonLabel(reason: NoOfferReason): string {
    return NO_OFFER_REASON_LABELS[reason] ?? humaniseNoOfferReason(reason);
}
