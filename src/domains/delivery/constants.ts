/**
 * Where the Keeta fallback sends a customer we cannot deliver to (DELIVERY_SPEC.md §1.2).
 *
 * ⚠️ This URL was recovered from a **commented-out** `<Fab>` in `pages/HeroSection.tsx`, so it is
 * the right value as far as the codebase knows but has never been exercised in production. §10
 * still lists the Keeta deep link as an open external input — confirm it resolves before the
 * fallback card ships, and override with REACT_APP_KEETA_URL rather than editing this file.
 */
export const KEETA_DEEP_LINK: string =
    process.env.REACT_APP_KEETA_URL ?? 'https://url-eu.mykeeta.com/4creMhXz';

/**
 * Delivery is built, but the shop is not taking delivery orders yet (owner, 18 Oct 2026). While
 * this is true the cart shows Delivery greyed out under a blinking "Coming soon", instead of letting
 * a customer pick it only to be sent to Keeta. Set it to false to open delivery.
 */
export const DELIVERY_COMING_SOON = true;
