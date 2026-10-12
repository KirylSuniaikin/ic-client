// Loads the gateway's session.js. The URL comes from our backend, but it is still validated
// (FR-18) so a tampered response can never make us inject a foreign script.

// The one frontend source of the Hosted Session API version; must equal the backend's API_VERSION.
export const HOSTED_SESSION_API_VERSION = "100";

const LOAD_TIMEOUT_MS = 15_000;
const TRUSTED_HOST_SUFFIX = ".gateway.mastercard.com";
const SCRIPT_PATH_PATTERN = /^\/form\/version\/([^/]+)\/merchant\/[A-Za-z0-9_-]+\/session\.js$/;

export class HostedSessionLoadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HostedSessionLoadError";
    }
}

export function isTrustedScriptUrl(url: string, apiVersion: string): boolean {
    if (apiVersion !== HOSTED_SESSION_API_VERSION) return false;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== "https:") return false;
    if (parsed.username !== "" || parsed.password !== "" || parsed.port !== "") return false;
    if (parsed.search !== "" || parsed.hash !== "") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(TRUSTED_HOST_SUFFIX) || host.length === TRUSTED_HOST_SUFFIX.length) return false;
    const match = SCRIPT_PATH_PATTERN.exec(parsed.pathname);
    return match !== null && match[1] === HOSTED_SESSION_API_VERSION;
}

const pendingLoads = new Map<string, Promise<PaymentSessionStatic>>();

function injectScript(url: string): Promise<PaymentSessionStatic> {
    return new Promise<PaymentSessionStatic>((resolve, reject) => {
        const script = document.createElement("script");
        let settled = false;

        const fail = (message: string): void => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            script.remove();
            reject(new HostedSessionLoadError(message));
        };

        const timer = window.setTimeout(() => fail("HOSTED_SESSION_LOAD_TIMEOUT"), LOAD_TIMEOUT_MS);

        script.async = true;
        script.src = url;
        script.onload = (): void => {
            if (settled) return;
            const sdk = window.PaymentSession;
            if (!sdk) {
                fail("HOSTED_SESSION_SDK_MISSING");
                return;
            }
            settled = true;
            window.clearTimeout(timer);
            resolve(sdk);
        };
        script.onerror = (): void => fail("HOSTED_SESSION_LOAD_FAILED");
        document.head.appendChild(script);
    });
}

export function loadHostedSessionScript(url: string, apiVersion: string): Promise<PaymentSessionStatic> {
    if (!isTrustedScriptUrl(url, apiVersion)) {
        return Promise.reject(new HostedSessionLoadError("HOSTED_SESSION_UNTRUSTED_URL"));
    }
    const cached = pendingLoads.get(url);
    if (cached) return cached;

    const load = injectScript(url);
    pendingLoads.set(url, load);
    // Failed loads are evicted so a retry re-injects; the rejection itself still reaches the caller.
    load.catch(() => pendingLoads.delete(url));
    return load;
}
