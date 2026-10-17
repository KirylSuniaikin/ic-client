import { logger } from "../../../shared/utils/logger";
import { isApplePayCapable } from "./applePayRequest";

/**
 * Apple Pay outside Safari (Chrome, Edge, Firefox on a desktop): the customer scans a code with an
 * iPhone on iOS 18+ and approves there.
 *
 * Apple's JS SDK makes that work by defining a polyfill `ApplePaySession` when the browser has
 * none, so the checkout hook drives the same session API in every browser. It MUST be
 * `1.latest`: the `v1` bundle ships only the button component and never defines the session.
 */
export const APPLE_PAY_SDK_URL = "https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js";

/**
 * Public, not a secret: it is the merchant id Apple shows the customer's iPhone, and it must
 * match the backend's APPLE_PAY_MERCHANT_IDENTIFIER. Outside Safari the SDK learns it ONLY from
 * `applePayCapabilities(id)` and sends it with the scannable code, which is why that call is the
 * capability check there and not a plain `canMakePayments()`. Unset keeps Apple Pay Safari-only.
 */
export const APPLE_PAY_MERCHANT_ID: string | undefined = process.env.REACT_APP_APPLE_PAY_MERCHANT_ID;

let sdkLoad: Promise<void> | null = null;

function loadSdk(): Promise<void> {
    if (sdkLoad) return sdkLoad;
    sdkLoad = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = APPLE_PAY_SDK_URL;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = (): void => resolve();
        script.onerror = (): void => reject(new Error("Apple Pay SDK failed to load"));
        document.head.appendChild(script);
    });
    return sdkLoad;
}

/**
 * Whether to offer Apple Pay on this device.
 *
 * Safari keeps the synchronous native check it always had. Elsewhere the SDK is fetched on first
 * need (only customers who open the cart pay for it), then asked. `paymentCredentialStatusUnknown`
 * is the normal answer outside Safari — the browser cannot see the iPhone's cards — and still
 * means "show the button"; only `applePayUnsupported` hides it. The SDK itself answers
 * unsupported on phones (an Android phone has no iPhone to scan with).
 */
export async function detectApplePayCapability(merchantId: string | undefined = APPLE_PAY_MERCHANT_ID): Promise<boolean> {
    if (window.ApplePaySession && !sdkLoad) return isApplePayCapable();
    if (!merchantId) return false;
    try {
        await loadSdk();
        const session = window.ApplePaySession;
        if (!session?.applePayCapabilities) return false;
        const { paymentCredentialStatus } = await session.applePayCapabilities(merchantId);
        return paymentCredentialStatus !== "applePayUnsupported";
    } catch (failure: unknown) {
        // Apple Pay is one method among several: failing to detect it hides it and nothing else.
        logger.warn("Apple Pay capability check failed:", failure);
        return false;
    }
}

/** Test seam: forget a previous SDK load so each test starts from a browser that never fetched it. */
export function resetApplePaySdkForTests(): void {
    sdkLoad = null;
}
