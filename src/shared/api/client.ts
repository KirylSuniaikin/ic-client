import { logger } from "../utils/logger";
import { applyClientPlatform } from "./clientPlatform";
import { reportClientError } from "./telemetry";
// Served from a host under the storefront's own domain (a CNAME to Render) rather than
// *.onrender.com: that is what makes the customer refresh cookie first-party, so it is
// shared by the apex and www and no longer dropped by Safari's third-party cookie block.
const PROD_BASE_URL = 'https://api.ic-pizza.com/api';
const PROD_WS_URL = 'https://api.ic-pizza.com/ws';

/** The port the backend listens on in development. */
const DEV_API_PORT = 8000;

/**
 * The dev backend, addressed by whatever host the page itself was loaded from.
 *
 * A hardcoded `localhost` is correct only while the browser and the backend are the same machine.
 * They stopped being the same machine when the BenefitPay bridge page started opening on a phone:
 * `localhost` there is the PHONE, so every call resolved to nothing and the page simply sat still.
 * Deriving the host means a page served from `100.110.8.58:3000` calls `100.110.8.58:8000`, while a
 * developer on their own machine still gets `localhost` and sees no change at all.
 */
function devOrigin(): string {
    // An explicit override always wins — set REACT_APP_API_BASE_URL when the backend is not where
    // the rules below would guess (a tunnel on an odd port, a colleague's machine).
    const override = process.env.REACT_APP_API_BASE_URL;
    if (override !== undefined && override.length > 0) {
        return override.endsWith('/') ? override.slice(0, -1) : override;
    }

    if (typeof window === 'undefined' || window.location.hostname.length === 0) {
        return `http://localhost:${DEV_API_PORT}`;
    }

    const {protocol, hostname} = window.location;

    // An https page may not call http — the browser blocks it as mixed content, silently as far as
    // the page is concerned. When the app is reached over TLS in development it is behind a tunnel
    // (Tailscale serve/funnel), and a tunnel terminates TLS on 443 and proxies the backend there,
    // so the API is same-scheme and portless rather than on DEV_API_PORT.
    if (protocol === 'https:') {
        return `https://${hostname}`;
    }

    return `http://${hostname}:${DEV_API_PORT}`;
}

export const BASE_URL: string = process.env.NODE_ENV === 'production'
    ? PROD_BASE_URL
    : `${devOrigin()}/api`;
export const WS_URL: string = process.env.NODE_ENV === 'production'
    ? PROD_WS_URL
    : `${devOrigin()}/ws`;

export const DEFAULT_BRANCH_ID = '2e8c35f7-d75e-4442-b496-cbb929842c10';

// Thrown ONLY when the raw `fetch()` call inside authFetch itself rejects (offline, DNS
// failure, CORS network error, timeout) — i.e. no HTTP response was ever received. Anything
// that happens after a response arrives (non-ok status, the 401 handler, a caller's own
// `res.json()` parse failure) continues to throw a plain Error, exactly as before. This lets
// callers distinguish "safe to retry" (nothing happened server-side) from "a response was
// received and something after that failed" (retrying could duplicate a server-side effect).
export class PreResponseNetworkError extends Error {
    constructor(cause: unknown) {
        super(cause instanceof Error ? cause.message : "Network request failed");
        this.name = "PreResponseNetworkError";
    }
}

// Drops the query string so telemetry payloads never carry request params (order IDs,
// tokens embedded in query args, etc.) — see task-spec.md ST6.
function stripQueryString(url: string): string {
    const queryIndex = url.indexOf('?');
    return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

// Shared by client.ts's `authFetch` and public.ts's raw `fetch` call sites. Purely
// additive reporting — never changes control flow. Business codes (401/409/423) and
// any other status below 500 are intentionally excluded (handled UX flows, not faults).
export async function reportIfServerError(response: Response, url: string, method: string): Promise<void> {
    if (response.status < 500) {
        return;
    }

    const path = stripQueryString(url);
    await reportClientError({
        source: 'api-5xx',
        message: `${method} ${path} failed with status ${response.status}`,
        url: path,
        userAgent: navigator.userAgent,
    });
}

// Shared by client.ts's `authFetch` and public.ts's raw `fetch` call sites. Reports a
// network/fetch rejection (e.g. offline) — the caller is responsible for re-throwing
// the original error afterwards so existing error handling is unchanged.
export async function reportNetworkError(error: unknown, url: string, method: string): Promise<void> {
    const path = stripQueryString(url);
    const message = error instanceof Error ? error.message : String(error);
    await reportClientError({
        source: 'api-network',
        message: `${method} ${path} failed: ${message}`,
        url: path,
        userAgent: navigator.userAgent,
    });
}

// task-spec.md Extra defect 1: opt-out of the global sign-out redirect below, for callers
// (namely the staff identity call, GET /staff/me) where a 401 must NOT be treated as "this
// browser's session is over" -- a genuinely revoked account still signs out on its next real
// API call (TokenFilter), so nothing about the disabled-staff behaviour is lost by skipping it
// here.
export type AuthFetchOptions = {
    skipAuthRedirectOn401?: boolean;
    /**
     * Opt-in retry delays (ms) for a transient network failure — mirrors public.ts's
     * `fetchWithRetry` (built for `fetchBaseAppInfo`'s cold-start/mobile-blip case). Empty/absent
     * by default: `authFetch` backs dozens of call sites, many of them non-idempotent POSTs (order
     * mutations, payments), so blind retries must stay opt-in per call site rather than a global
     * default. Only retries a `PreResponseNetworkError` — i.e. the raw `fetch()` call itself
     * rejecting (offline, DNS, CORS) — never a received HTTP response, exactly like the
     * `fetchWithRetry` this mirrors.
     */
    retryDelaysMs?: number[];
};

// Retries ONLY a raw `fetch()` rejection (offline, DNS, CORS) — never a received HTTP response,
// so a non-idempotent POST is only ever retried when nothing could possibly have reached the
// server. `delaysMs` empty means exactly today's single-attempt behaviour.
async function fetchWithRetries(url: string, init: RequestInit, delaysMs: number[]): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fetch(url, init);
        } catch (error) {
            if (attempt >= delaysMs.length) throw error;
            await new Promise(resolve => setTimeout(resolve, delaysMs[attempt]));
        }
    }
}

export async function authFetch(
    url: string,
    headersWithoutAuth: RequestInit,
    options?: AuthFetchOptions
): Promise<Response> {
    const token = localStorage.getItem("jwt_token");

    const headers = new Headers(headersWithoutAuth?.headers);

    if (token) {
        headers.set("Authorization", "Bearer " + token);
    }

    applyClientPlatform(headers);

    const method = headersWithoutAuth?.method ?? "GET";
    const retryDelaysMs = options?.retryDelaysMs ?? [];

    let response: Response;
    try {
        response = await fetchWithRetries(url, { ...headersWithoutAuth, headers }, retryDelaysMs);
    } catch (error) {
        // Fire-and-forget: telemetry must never add latency to the caller's error path
        // (this wraps the order path). reportClientError swallows its own failures. Only
        // reported once, after every retry (if any) has already failed.
        void reportNetworkError(error, url, method);
        throw new PreResponseNetworkError(error);
    }

    void reportIfServerError(response, url, method);

    if (response.status === 401) {
        logger.warn("Unauthorized");
        if (!options?.skipAuthRedirectOn401) {
            localStorage.removeItem("jwt_token");
            window.location.href = "/auth";
        }
        return Promise.reject(new Error("Unauthorized"));
    }

    return response;
}
