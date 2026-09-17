import { reportClientError } from '../api/telemetry';

// Module-level guard so calling installGlobalErrorHandlers() more than once
// (e.g. hot reload, duplicate bootstrap call) never registers duplicate listeners.
let installed = false;

function extractMessage(event: string | Event): string {
    return typeof event === 'string' ? event : event.type;
}

// window.onerror's `source` (the script URL where the error was thrown) tells us whether it was
// OUR code or a third party's — an in-app browser's own injected bridge script (e.g. Instagram's
// `iabjs://navigation_performance_logger_android`), or a cross-origin script the browser masks
// entirely as message "Script error." with an empty source. Neither is actionable here: there is
// no app-code fix for a third party's own script failing. `source` is empty/undefined for the
// masked cross-origin case, and a non-empty but foreign origin for injected-bridge scripts — both
// fail this check and get filtered before ever reaching the telemetry endpoint.
function isFirstPartyScript(source: string | undefined): boolean {
    if (!source) return false;
    try {
        return new URL(source, window.location.href).origin === window.location.origin;
    } catch {
        // A custom scheme (e.g. "iabjs://...") either fails to parse or resolves to an opaque
        // origin — either way, never ours.
        return false;
    }
}

// Registers window.onerror + unhandledrejection listeners that forward uncaught
// JS errors to the shared telemetry client. reportClientError is prod-only
// internally, so this is called unconditionally.
export function installGlobalErrorHandlers(): void {
    if (installed) {
        return;
    }
    installed = true;

    window.onerror = (event, source, _lineno, _colno, error): void => {
        if (!isFirstPartyScript(source)) return;

        void reportClientError({
            source: 'window.onerror',
            message: error?.message ?? extractMessage(event),
            stack: error?.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
        });
    };

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent): void => {
        const reason: unknown = event.reason;
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;

        void reportClientError({
            source: 'unhandledrejection',
            message,
            stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
        });
    });
}
