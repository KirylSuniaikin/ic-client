import { getKioskDeviceName } from "../../domains/kiosk/services/kioskIdentity";

/**
 * A kiosk device lost its pairing (no/unknown `X-Kiosk-Name`, or the backend revoked it). Thrown
 * instead of following `authFetch`'s redirect-to-`/auth` behaviour (`client.ts:29-34`) — a
 * walk-up terminal has no staff login screen to bounce a customer to. Callers route this to the
 * terminal picker instead (`useKioskCheckout`'s `onUnauthorized`, Phase 4).
 */
export class KioskUnauthorizedError extends Error {
    constructor(message = "This kiosk is no longer paired with the backend.") {
        super(message);
        this.name = "KioskUnauthorizedError";
    }
}

/** Any other non-2xx response from a `/api/kiosk/**` call. */
export class KioskHttpError extends Error {
    readonly status: number;

    /**
     * Best-effort parsed JSON response body, when the server sent one — `unknown` because each
     * caller must narrow it to the shape it expects (see `kiosk.ts`'s `createKioskOrder`, which
     * re-derives `ItemsUnavailableError`/`BranchClosedError` from a 409/423 body here). `undefined`
     * when the body wasn't present or wasn't valid JSON.
     */
    readonly body: unknown;

    constructor(status: number, message: string, body?: unknown) {
        super(message);
        this.name = "KioskHttpError";
        this.status = status;
        this.body = body;
    }
}

/**
 * Fetch wrapper for every `/api/kiosk/**` call. Deliberately separate from `authFetch`
 * (`shared/api/client.ts`): kiosk devices carry no staff JWT and authenticate purely by the
 * `X-Kiosk-Name` header, so this wrapper must never attach an `Authorization` header, never send
 * credentials, and must never touch `window.location` on a 401 — that redirect only makes sense
 * for a staff session with a login screen to return to.
 *
 * Ported per task-spec.md §15 item 2: 401 → `KioskUnauthorizedError`; every other non-ok status →
 * `KioskHttpError(status, message, body)`, with `message` derived the same defensive way
 * `public.ts`'s `createOrder` does (try the parsed JSON's `message` field, fall back to the raw
 * response text, fall back to a generic string).
 */
export async function kioskFetch(url: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);

    const deviceName = getKioskDeviceName();
    if (deviceName) {
        headers.set("X-Kiosk-Name", deviceName);
    }
    headers.set("X-Client-Platform", "kiosk-web");

    const response = await fetch(url, {
        ...init,
        headers,
    });

    if (response.status === 401) {
        throw new KioskUnauthorizedError();
    }

    if (!response.ok) {
        // Parsed from a clone so the original response's body stream is still available below for
        // the response.text() fallback if the body isn't JSON (or has no `message` field).
        let body: unknown;
        try {
            body = await response.clone().json();
        } catch {
            body = undefined;
        }

        let message = `Kiosk request failed with status ${response.status}.`;
        if (
            body &&
            typeof body === "object" &&
            "message" in body &&
            typeof (body as { message: unknown }).message === "string"
        ) {
            message = (body as { message: string }).message;
        } else {
            try {
                const textError = await response.text();
                if (textError) message = textError;
            } catch {
                // Response body unreadable — keep the generic message.
            }
        }

        throw new KioskHttpError(response.status, message, body);
    }

    return response;
}
