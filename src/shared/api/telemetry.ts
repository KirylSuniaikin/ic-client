import { BASE_URL } from './client';
import { applyClientPlatform } from './clientPlatform';

// Allowed `source` values, locked by the backend's ClientErrorReportRequest DTO
// (core/notification/ClientErrorController.java, ST3).
export type ClientErrorSource =
    | 'error-boundary'
    | 'window.onerror'
    | 'unhandledrejection'
    | 'api-5xx'
    | 'api-network';

// Field names and caps MUST match the backend DTO exactly — this is the locked wire contract.
export interface ClientErrorPayload {
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    source: ClientErrorSource;
}

const MESSAGE_MAX_LENGTH = 500;
const STACK_MAX_LENGTH = 8000;
const URL_MAX_LENGTH = 500;
const USER_AGENT_MAX_LENGTH = 300;

// Mirrors the backend's per-signature dedup window (see task-spec.md) so a render
// loop never even attempts a POST between backend cooldown refreshes.
const DEDUP_COOLDOWN_MS = 2 * 60 * 1000;

// Assumed: the spec calls for "a per-session counter cap" without a concrete number.
// 20 is chosen as a generous ceiling that still stops a tight render-loop from spamming
// the endpoint for the lifetime of the tab.
const SESSION_REPORT_CAP = 20;

// Module-level (per browser session/tab) dedup state.
const lastSentAt = new Map<string, number>();
let sessionReportCount = 0;

function truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}

// A stable signature for dedup purposes: same source + same message + same url
// is treated as "the same error" within the cooldown window.
function buildSignature(payload: ClientErrorPayload): string {
    return `${payload.source}::${payload.message}::${payload.url ?? ''}`;
}

// Reports a client-side error to the backend telemetry endpoint. No-ops entirely
// outside production so dev/test builds never call the network. Never throws and
// never logs via `logger.error` — a failure here must not create a reporting loop.
export async function reportClientError(payload: ClientErrorPayload): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    const signature = buildSignature(payload);
    const now = Date.now();
    const lastSent = lastSentAt.get(signature);
    if (lastSent !== undefined && now - lastSent < DEDUP_COOLDOWN_MS) {
        return;
    }

    if (sessionReportCount >= SESSION_REPORT_CAP) {
        return;
    }

    lastSentAt.set(signature, now);
    sessionReportCount += 1;

    const body: ClientErrorPayload = {
        message: truncate(payload.message, MESSAGE_MAX_LENGTH),
        source: payload.source,
        ...(payload.stack !== undefined ? { stack: truncate(payload.stack, STACK_MAX_LENGTH) } : {}),
        ...(payload.url !== undefined ? { url: truncate(payload.url, URL_MAX_LENGTH) } : {}),
        ...(payload.userAgent !== undefined
            ? { userAgent: truncate(payload.userAgent, USER_AGENT_MAX_LENGTH) }
            : {}),
    };

    try {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        applyClientPlatform(headers);

        await fetch(`${BASE_URL}/client-errors`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
    } catch {
        // Swallow all failures — telemetry must never throw or call logger.error
        // (which would risk re-entering error reporting).
    }
}
