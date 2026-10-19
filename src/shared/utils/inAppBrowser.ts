/**
 * Instagram's in-app browser, and the way out of it.
 *
 * Over half of customer sign-ins happen inside Instagram's in-app browser, and its cookie store
 * does not survive the app being closed — so the refresh cookie that keeps a customer signed in is
 * gone on nearly every visit and they are asked for a WhatsApp code again. Safari and Chrome keep
 * it. Only Instagram is detected: Facebook's and TikTok's webviews were not part of the request.
 */

export type InAppBrowserPlatform = "ios" | "android";

/** The parts of `window.location` a hand-off URL is built from. */
export type PageLocation = Pick<Location, "host" | "pathname" | "search" | "href">;

const INSTAGRAM = /Instagram/;
const IOS_DEVICE = /iPhone|iPad|iPod/;
const ANDROID = /Android/;

/**
 * The phone platform of an Instagram in-app browser, or null for any other browser — including
 * an Instagram user agent on a platform we cannot hand off from.
 */
export function instagramInAppPlatform(userAgent: string): InAppBrowserPlatform | null {
    if (!INSTAGRAM.test(userAgent)) return null;
    if (IOS_DEVICE.test(userAgent)) return "ios";
    if (ANDROID.test(userAgent)) return "android";
    return null;
}

/**
 * A URL that reopens the current page — host, path and query, so the customer lands where they
 * were — in the platform's own browser.
 *
 * iOS: Instagram's own `instagram://extbrowser` link, which opens the phone's default browser
 * (Safari for nearly everyone). Safari's `x-safari-https://` scheme is not used: Instagram has
 * blocked it since mid-2025. Meta could block this one too, which is why the notice also tells
 * the customer how to do it from Instagram's menu.
 * Android: a Chrome intent; Android falls back to the page's own URL when Chrome is missing.
 */
export function externalBrowserUrl(platform: InAppBrowserPlatform, location: PageLocation): string {
    const page = `${location.host}${location.pathname}${location.search}`;
    if (platform === "ios") return `instagram://extbrowser/?url=${encodeURIComponent(`https://${page}`)}`;
    return `intent://${page}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
}
