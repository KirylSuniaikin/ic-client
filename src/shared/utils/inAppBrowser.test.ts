import { describe, it, expect } from "@jest/globals";
import { externalBrowserUrl, instagramInAppPlatform } from "./inAppBrowser";

// Real user agents, as each browser sends them.
const INSTAGRAM_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone14,5; iOS 17_5; en_US; en; scale=3.00; 1170x2532; 615196410)";
const INSTAGRAM_IPAD =
    "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.0.18.104 (iPad13,4; iPadOS 17_1; en_US; en; scale=2.00; 1668x2388; 537288532)";
const INSTAGRAM_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_US; 601420827)";
const SAFARI_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";
const FACEBOOK_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.39.104;FBBV/618745312;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/620063018]";
const FACEBOOK_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/462.0.0.44.83;]";
const INSTAGRAM_UNKNOWN_PLATFORM = "Instagram 330.0.0.40.92 (Windows NT 10.0)";

describe("instagramInAppPlatform", () => {
    it("recognises Instagram's in-app browser on an iPhone", () => {
        expect(instagramInAppPlatform(INSTAGRAM_IOS)).toBe("ios");
    });

    it("recognises Instagram's in-app browser on an iPad", () => {
        expect(instagramInAppPlatform(INSTAGRAM_IPAD)).toBe("ios");
    });

    it("recognises Instagram's in-app browser on Android", () => {
        expect(instagramInAppPlatform(INSTAGRAM_ANDROID)).toBe("android");
    });

    it("leaves plain Safari alone", () => {
        expect(instagramInAppPlatform(SAFARI_IOS)).toBeNull();
    });

    it("leaves plain Chrome alone", () => {
        expect(instagramInAppPlatform(CHROME_ANDROID)).toBeNull();
    });

    // Facebook was not part of the request, even though its webview has the same cookie problem.
    it("leaves Facebook's in-app browser alone on both platforms", () => {
        expect(instagramInAppPlatform(FACEBOOK_IOS)).toBeNull();
        expect(instagramInAppPlatform(FACEBOOK_ANDROID)).toBeNull();
    });

    it("has nothing to offer an Instagram user agent that is neither iOS nor Android", () => {
        expect(instagramInAppPlatform(INSTAGRAM_UNKNOWN_PLATFORM)).toBeNull();
    });
});

describe("externalBrowserUrl", () => {
    const location = {
        host: "ic-pizza.com",
        pathname: "/menu",
        search: "?recommended_items=4&fbclid=IwAR1",
        href: "https://ic-pizza.com/menu?recommended_items=4&fbclid=IwAR1#faq",
    };

    it("hands the page to the default browser through Instagram on iOS, keeping its path and query", () => {
        expect(externalBrowserUrl("ios", location)).toBe("instagram://extbrowser/?url=https%3A%2F%2Fic-pizza.com%2Fmenu%3Frecommended_items%3D4%26fbclid%3DIwAR1");
    });

    it("hands the page to Chrome on Android, falling back to the page itself", () => {
        expect(externalBrowserUrl("android", location)).toBe(
            "intent://ic-pizza.com/menu?recommended_items=4&fbclid=IwAR1#Intent;scheme=https;package=com.android.chrome;"
            + "S.browser_fallback_url=https%3A%2F%2Fic-pizza.com%2Fmenu%3Frecommended_items%3D4%26fbclid%3DIwAR1%23faq;end",
        );
    });
});
