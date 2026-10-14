// The anonymous browsing-session token sent with delivery availability checks and Keeta fallback
// events, so the server can count one person retrying the same address as one lost customer
// rather than ten. It identifies a tab session, never a person, and the server never stores it:
// it is hashed into an in-memory dedupe key and dropped.
import { logger } from '../utils/logger';

export const DEMAND_SESSION_HEADER = 'X-Demand-Session';

// sessionStorage, not localStorage: the token must die with the tab, or the "estimated attempts"
// figure would merge a customer's Tuesday and Friday into one attempt. The kiosk clears
// sessionStorage between customers, which gives each walk-up customer a token of their own.
const STORAGE_KEY = 'icpizza.demandSession';

// The server ignores anything outside this shape and falls back to IP + user agent, so a token
// that does not match is worse than useless — it is regenerated instead of sent.
const VALID_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const MIN_LENGTH = 16;
const MAX_LENGTH = 64;

let memoryToken: string | null = null;
let storageFallbackLogged = false;

function newToken(): string {
    // crypto.randomUUID needs a secure context; older WebViews (the Capacitor APK) fall back the
    // same way useCheckout's idempotency key does.
    const raw = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
            + Math.random().toString(36).slice(2);
    // Math.random can yield a short string; padding keeps the token inside the accepted shape.
    return raw.replace(/[^A-Za-z0-9_-]/g, '').padEnd(MIN_LENGTH, '0').slice(0, MAX_LENGTH);
}

/**
 * This tab's demand-session token, created on first use. Never throws: storage can be blocked
 * (private mode, a locked-down WebView), and an analytics header must not be what breaks the
 * availability check it rides on.
 */
export function getDemandSessionId(): string {
    try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (stored !== null && VALID_TOKEN.test(stored)) return stored;
        const token = newToken();
        window.sessionStorage.setItem(STORAGE_KEY, token);
        return token;
    } catch (err) {
        if (!storageFallbackLogged) {
            storageFallbackLogged = true;
            logger.warn('Demand session storage unavailable; keeping the token in memory:', err);
        }
        if (memoryToken === null) memoryToken = newToken();
        return memoryToken;
    }
}
