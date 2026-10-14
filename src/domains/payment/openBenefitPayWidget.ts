import {logger} from "../../shared/utils/logger";
import type {BenefitPaySession} from "./types";
import { buildAppLink, isAppHandoff } from "./benefitPayAppLink";

/**
 * Opens BenefitPay's wallet widget — the QR the customer scans with their phone.
 *
 * <h2>Why the SDK is loaded at runtime rather than imported</h2>
 * `InApp.min.js` is a vendor file, not a module: it defines a global `InApp` and expects jQuery on
 * `window`. Importing it would run it during bundling, before jQuery exists. Loading it on demand
 * also means a customer who never pays by wallet never downloads it.
 *
 * <h2>The success callback is not the answer</h2>
 * The SDK guide is unusually direct: *"Successful operation does not indicate successful payment."*
 * So `open` here resolves with the reference and nothing more — whether money moved is decided by
 * the server asking check-status, never by this callback.
 *
 * <h2>What the widget does to the page</h2>
 * It appends a fixed-position iframe to `<html>` and closes itself. It is not a React component and
 * does not respect React's tree, which is why nothing here tries to render it.
 */

/** Served from `public/`, so it is same-origin and needs no CSP allowance. */
const SDK_SRC = "/vendor/InApp.min.js";

type InAppGlobal = {
    /** The checkout host the SDK talks to; also the host that serves its dynamic links. */
    endpoint?: string;
    open: (
        params: Record<string, string | number>,
        onSuccess: (result: unknown) => void,
        onError: (error: unknown) => void,
        onClose?: () => void,
    ) => void;
    close?: () => void;
};

declare global {
    interface Window {
        InApp?: InAppGlobal;
        jQuery?: unknown;
        $?: unknown;
    }
}

export type WidgetOutcome =
    /** The customer completed the widget flow. Says nothing about whether the payment succeeded. */
    | {completed: true}
    /** They closed it, or it errored, or the QR timed out. */
    | {completed: false; reason: string};

let sdkLoad: Promise<void> | null = null;

/**
 * Loads the vendor SDK once per page, and makes jQuery global first.
 *
 * The SDK calls `$("head")`, `$("html").append(…)` and `$(document).ready(…)` without bundling
 * jQuery, so `window.jQuery` has to exist before the script runs or it dies with `$ is not
 * defined`.
 */
async function loadSdk(): Promise<void> {
    if (window.InApp) return;
    if (sdkLoad) return sdkLoad;

    sdkLoad = (async () => {
        const jquery = (await import("jquery")).default;
        window.jQuery = jquery;
        window.$ = jquery;

        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = SDK_SRC;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Could not load ${SDK_SRC}`));
            document.body.appendChild(script);
        });

        if (!window.InApp) {
            throw new Error("InApp.min.js loaded but defined no InApp global");
        }
    })();

    try {
        await sdkLoad;
    } catch (error) {
        // Let a later attempt retry rather than caching the failure forever.
        sdkLoad = null;
        throw error;
    }
}

/**
 * @param session the signed parameters from our own backend. The secret that produced
 *                `secureHash` stays on the server — the SDK computes nothing.
 */
/**
 * Takes over BenefitPay's "open the app" hand-off for as long as the widget is up.
 *
 * Their page posts a `beninapp` message to us; the SDK answers it by clicking an anchor with
 * `target="_blank"` from inside a message handler, which carries no user activation, so the browser
 * blocks it and the customer gets `about:blank#blocked`. A top-level navigation has no such
 * restriction, so we take the message first. Both handlers run; whoever navigates first wins.
 *
 * This lives here rather than in a page because it belongs to the widget being open, not to any one
 * surface. It was on the bridge page alone, which meant a customer browsing the site on a phone —
 * the commonest way to meet this — got the blocked popup and nothing else.
 *
 * @returns a teardown that must be called when the widget closes.
 */
/**
 * The same test the SDK uses internally, kept here because paymentType is ours to choose.
 *
 * Deliberately a user-agent test rather than a viewport one: what matters is whether the wallet
 * app can be opened on THIS device, not how wide the window is.
 */
function isMobileBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    return /mobile/i.test(navigator.userAgent ?? "");
}

function interceptAppHandoff(onLink?: (link: string) => void): () => void {
    const onMessage = (event: MessageEvent): void => {
        if (!isAppHandoff(event.data)) return;
        const link = buildAppLink(event.data, window.location.href, window.InApp?.endpoint);
        onLink?.(link);
        window.location.assign(link);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
}

/**
 * @param onAppLink called with the hand-off link just before we navigate, so a caller can also
 *                  offer it as a real button — a tap is user activation and can never be blocked.
 */
export async function openBenefitPayWidget(
    session: BenefitPaySession,
    onAppLink?: (link: string) => void,
): Promise<WidgetOutcome> {
    const stopIntercepting = interceptAppHandoff(onAppLink);
    await loadSdk();

    return new Promise<WidgetOutcome>((resolve) => {
        let settled = false;
        const finish = (outcome: WidgetOutcome): void => {
            if (settled) return;
            settled = true;
            // The listener outlives the widget otherwise, and a later message from a second attempt
            // would navigate a customer who is no longer paying.
            stopIntercepting();
            resolve(outcome);
        };

        window.InApp?.open(
            {
                merchantId: session.merchantId,
                appId: session.appId,
                transactionAmount: session.amount,
                transactionCurrency: session.currency,
                referenceNumber: session.reference,
                secure_hash: session.secureHash,
                // hashedString is NOT sent.
                //
                // BENEFIT confirmed (2026-09-10) that it is not required for payment and that the
                // Web Checkout SDK doc listing it as mandatory is out of date. Our server still
                // computes it — the algorithm cost real effort to recover from the Android SDK and
                // is pinned by tests — but nothing consumes it here.
                //
                // Do NOT "tidy" this by sending an empty string. Their page treats an empty value
                // as supplied-but-invalid and stops rendering the QR entirely, where an absent one
                // it simply ignores. That cost a day.
                // 0 keeps the outcome off the customer's wallet app: our own result page is the
                // one that tells them, after the server has confirmed it.
                showResult: 0,
                // Nobody can scan a QR with the phone that is displaying it. On a phone the page
                // must offer the app hand-off instead, and this is the flag that asks for it.
                // Ignored on desktop, where the SDK keeps showing the QR — which is the point there.
                hideMobileQR: 1,
                qr_timeout: session.qrTimeoutMs,
                // Undocumented in the parameter table but read by the SDK, which defaults it to
                // "web". Passed explicitly so the value is visible here rather than implied.
                // "inapp" on a phone, "web" on a desktop.
                //
                // BENEFIT's worked example of a SUCCESSFUL phone transaction carries
                // paymentType "inapp"; a desktop scanning a QR is the "web" case. The SDK keeps
                // its own isMobile() for layout, but does not derive this from it — the value is
                // ours to send, and sending "web" from a phone is what their example rules out.
                paymentType: isMobileBrowser() ? "inapp" : "web",
            },
            () => finish({completed: true}),
            (error: unknown) => {
                logger.error("BenefitPay widget reported an error:", error);
                finish({completed: false, reason: "error"});
            },
            () => finish({completed: false, reason: "closed"}),
        );
    });
}
