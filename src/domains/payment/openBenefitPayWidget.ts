import {logger} from "../../shared/utils/logger";
import type {BenefitPaySession} from "./types";

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
export async function openBenefitPayWidget(session: BenefitPaySession): Promise<WidgetOutcome> {
    await loadSdk();

    return new Promise<WidgetOutcome>((resolve) => {
        let settled = false;
        const finish = (outcome: WidgetOutcome): void => {
            if (settled) return;
            settled = true;
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
                // The wallet's integrity check, computed by our server.
                //
                // BENEFIT never documented it, but the Android SDK builds it in
                // hashingUsingSecretKey(): HMAC-SHA256 over five fixed parameters with the
                // ALPHABETIC currency. The web SDK cannot compute it — it holds no secret — so an
                // unsupplied value reached the wallet as the literal text "undefined" and the
                // payment was rejected as though the merchant credentials were wrong.
                //
                // Omitted, not blanked, when the server has not sent one: an empty string reads to
                // their page as supplied-but-invalid and stops the QR rendering at all, whereas an
                // absent parameter merely degrades.
                ...(session.hashedString !== undefined && session.hashedString.length > 0
                    ? { hashedString: session.hashedString }
                    : {}),
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
                paymentType: "web",
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
