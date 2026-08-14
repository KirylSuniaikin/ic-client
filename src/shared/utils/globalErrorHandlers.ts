import { reportClientError } from '../api/telemetry';

// Module-level guard so calling installGlobalErrorHandlers() more than once
// (e.g. hot reload, duplicate bootstrap call) never registers duplicate listeners.
let installed = false;

function extractMessage(event: string | Event): string {
    return typeof event === 'string' ? event : event.type;
}

// Registers window.onerror + unhandledrejection listeners that forward uncaught
// JS errors to the shared telemetry client. reportClientError is prod-only
// internally, so this is called unconditionally.
export function installGlobalErrorHandlers(): void {
    if (installed) {
        return;
    }
    installed = true;

    window.onerror = (event, _source, _lineno, _colno, error): void => {
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
