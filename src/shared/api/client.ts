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

export async function authFetch(url: string, headersWithoutAuth: RequestInit): Promise<Response> {
    const token = localStorage.getItem("jwt_token");

    const headers = new Headers(headersWithoutAuth?.headers);

    if (token) {
        headers.set("Authorization", "Bearer " + token);
    }

    applyClientPlatform(headers);

    const method = headersWithoutAuth?.method ?? "GET";

    let response: Response;
    try {
        response = await fetch(url, {
            ...headersWithoutAuth,
            headers
        });
    } catch (error) {
        // Fire-and-forget: telemetry must never add latency to the caller's error path
        // (this wraps the order path). reportClientError swallows its own failures.
        void reportNetworkError(error, url, method);
        throw error;
    }

    void reportIfServerError(response, url, method);

    if (response.status === 401) {
        logger.warn("Unauthorized");
        localStorage.removeItem("jwt_token");
        window.location.href = "/auth";
        return Promise.reject(new Error("Unauthorized"));
    }

    return response;
}
