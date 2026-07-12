const KIOSK_MODE_PARAM = 'mode';
const KIOSK_MODE_VALUE = 'kiosk';

/**
 * A kiosk tab is a shared walk-up device: order, wait, leave. It has no customer account —
 * no login entry point, and no session may ever be restored onto it (see CustomerAuthProvider).
 * Single source of truth for the flag so the magic string can't drift between the two callers.
 */
export function isKioskSearch(params: URLSearchParams): boolean {
    return params.get(KIOSK_MODE_PARAM) === KIOSK_MODE_VALUE;
}
