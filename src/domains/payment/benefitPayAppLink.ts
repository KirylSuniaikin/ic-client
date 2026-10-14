/**
 * Rebuilds BenefitPay's "open the app" link, because the SDK's own attempt is blocked.
 *
 * <h2>Why this exists</h2>
 * When the customer taps "PAY USING BENEFITPAY APP", BenefitPay's checkout page posts a
 * `beninapp` message to its parent window. `InApp.min.js` answers it by creating an anchor with
 * `target="_blank"` and clicking it — from inside a message handler, which carries no transient
 * activation. Browsers block that, and the customer sees `about:blank#blocked` or, in an in-app
 * browser, simply nothing.
 *
 * <p>A top-level navigation has no such restriction, so we listen for the same message and go
 * there ourselves. Nothing is patched in the vendor file: both handlers run, and whichever
 * navigates first wins.
 *
 * <h2>These constants are the vendor's, not ours</h2>
 * `apn`/`isi`/`ios_scheme` identify BenefitPay's own apps and are read out of the vendored
 * `InApp.min.js`. **The test SDK names the TEST app** (`mobi.foo.benefittest`); a production
 * `InApp.min.js` will name the production one, and these must be updated with it or the link will
 * open the wrong app — or the store.
 */

/** Android package of BenefitPay's app, as named by the vendored SDK. */
const ANDROID_PACKAGE = "mobi.foo.benefittest";
/** App Store id, as named by the vendored SDK. */
const IOS_APP_STORE_ID = "1237673359";
/** Custom scheme the iOS app registers. */
const IOS_SCHEME = "benefitinapp";

/** The message BenefitPay's checkout page posts when the customer chooses the app. */
const APP_HANDOFF_STATUS = "beninapp";

/** Fallback host, used only if the SDK has not published its own endpoint yet. */
const FALLBACK_ENDPOINT = "https://benefit-checkout.test-benefitpay.bh";

type HandoffMessage = {
    status?: unknown;
    appId?: unknown;
    merchantId?: unknown;
    qrData?: unknown;
    referenceNumber?: unknown;
    hashedString?: unknown;
    transactionAmount?: unknown;
    paymentType?: unknown;
    showResult?: unknown;
};

/**
 * Values arrive from a postMessage, so a field the SDK never received comes back as the STRING
 * "undefined" rather than as a missing key — and forwarding that text to the wallet app is how a
 * parameter silently becomes garbage instead of being absent.
 */
function asText(value: unknown): string {
    if (value === undefined || value === null) return "";
    const text = String(value);
    return text === "undefined" || text === "null" ? "" : text;
}

/** True when this message is BenefitPay asking us to open its app. */
export function isAppHandoff(data: unknown): data is HandoffMessage {
    return typeof data === "object"
        && data !== null
        && (data as HandoffMessage).status === APP_HANDOFF_STATUS;
}

/**
 * @param callBackTag where BenefitPay should return the customer afterwards. The SDK uses
 *                    `window.location.href`; we pass it explicitly so the caller stays in control.
 */
export function buildAppLink(message: HandoffMessage, callBackTag: string, endpoint?: string): string {
    const params = "app_id=" + asText(message.appId)
        + "&merchant_id=" + asText(message.merchantId)
        + "&qrdata=" + asText(message.qrData)
        + "&referenceNumber=" + asText(message.referenceNumber)
        + "&hashedString=" + asText(message.hashedString)
        + "&amount=" + asText(message.transactionAmount)
        + "&callBackTag=" + callBackTag
        + "&paymentType=" + asText(message.paymentType)
        + "&showResult=" + asText(message.showResult)
        + "&efr=1";

    const link = encodeURIComponent("https://benefit.bh/?inapp&" + params);
    const host = endpoint !== undefined && endpoint.length > 0 ? endpoint : FALLBACK_ENDPOINT;

    return `${host}/links/?link=${link}`
        + `&apn=${ANDROID_PACKAGE}`
        + `&isi=${IOS_APP_STORE_ID}`
        + `&ios_scheme=${IOS_SCHEME}`;
}
