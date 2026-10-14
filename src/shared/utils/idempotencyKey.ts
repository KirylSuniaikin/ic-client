// Per-action idempotency key sent as `idempotency_key` so the backend can dedupe a retried
// request. crypto.randomUUID needs a secure context; prod/kiosk run over https, but the
// fallback keeps older WebViews (Capacitor APK) working.
export function newIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "idem-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
