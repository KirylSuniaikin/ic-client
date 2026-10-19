import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// The notice renders its copy via useTranslation; initialize the real i18n instance.
import i18n from "../../../shared/i18n";

import { InAppBrowserNotice, IN_APP_BROWSER_NOTICE_DISMISSED_KEY } from "./InAppBrowserNotice";

const INSTAGRAM_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone14,5; iOS 17_5; en_US; en; scale=3.00; 1170x2532; 615196410)";
const INSTAGRAM_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_US; 601420827)";
const SAFARI_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";
const FACEBOOK_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.39.104;FBBV/618745312;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/620063018]";

// The page the customer is on when they meet the notice: a recommendation link from an ad.
const PAGE = {
    host: "ic-pizza.com",
    pathname: "/menu",
    search: "?recommended_items=4",
    href: "https://ic-pizza.com/menu?recommended_items=4",
};

const ORIGINAL_LOCATION = Object.getOwnPropertyDescriptor(window, "location");

// jsdom's navigator.userAgent is a read-only getter, so it has to be redefined rather than assigned;
// deleting the own property afterwards uncovers jsdom's getter again.
function setUserAgent(userAgent: string): void {
    Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
}

beforeAll(() => {
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: PAGE });
});

afterAll(() => {
    if (ORIGINAL_LOCATION) Object.defineProperty(window, "location", ORIGINAL_LOCATION);
});

beforeEach(() => {
    sessionStorage.clear();
});

afterEach(() => {
    Reflect.deleteProperty(window.navigator, "userAgent");
});

describe("InAppBrowserNotice -- who sees it", () => {
    it.each([
        ["plain Safari", SAFARI_IOS],
        ["plain Chrome", CHROME_ANDROID],
        ["Facebook's in-app browser", FACEBOOK_IOS],
    ])("renders nothing in %s", (_name, userAgent) => {
        setUserAgent(userAgent);

        render(<InAppBrowserNotice />);

        expect(screen.queryByTestId("in-app-browser-notice")).toBeNull();
    });

    it("renders inside Instagram", () => {
        setUserAgent(INSTAGRAM_IOS);

        render(<InAppBrowserNotice />);

        expect(screen.getByTestId("in-app-browser-notice")).toBeTruthy();
    });
});

describe("InAppBrowserNotice -- iOS", () => {
    beforeEach(() => setUserAgent(INSTAGRAM_IOS));

    it("asks for Safari, and says how to get there from Instagram's menu", () => {
        render(<InAppBrowserNotice />);

        expect(screen.getByText("Open in Safari to stay signed in")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Open in Safari" })).toBeTruthy();
        expect(screen.getByText("Or tap ⋯ and choose “Open in external browser”")).toBeTruthy();
    });

    it("hands the same page, with its query, to Safari", () => {
        render(<InAppBrowserNotice />);

        expect(screen.getByRole("link", { name: "Open in Safari" }).getAttribute("href"))
            .toBe("instagram://extbrowser/?url=https%3A%2F%2Fic-pizza.com%2Fmenu%3Frecommended_items%3D4");
    });

    it("names the notice by its title", () => {
        render(<InAppBrowserNotice />);

        expect(screen.getByRole("complementary", { name: "Open in Safari to stay signed in" })).toBeTruthy();
    });
});

describe("InAppBrowserNotice -- Android", () => {
    beforeEach(() => setUserAgent(INSTAGRAM_ANDROID));

    it("asks for Chrome, without the iOS menu hint", () => {
        render(<InAppBrowserNotice />);

        expect(screen.getByText("Open in Chrome to stay signed in")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Open in Chrome" })).toBeTruthy();
        expect(screen.queryByText(/Open in external browser/)).toBeNull();
    });

    it("hands the same page to Chrome through an intent, falling back to the page itself", () => {
        render(<InAppBrowserNotice />);

        expect(screen.getByRole("link", { name: "Open in Chrome" }).getAttribute("href")).toBe(
            "intent://ic-pizza.com/menu?recommended_items=4#Intent;scheme=https;package=com.android.chrome;"
            + "S.browser_fallback_url=https%3A%2F%2Fic-pizza.com%2Fmenu%3Frecommended_items%3D4;end",
        );
    });
});

describe("InAppBrowserNotice -- dismissing", () => {
    beforeEach(() => setUserAgent(INSTAGRAM_IOS));

    it("hides on the X and stays hidden for the rest of the session", () => {
        const { unmount } = render(<InAppBrowserNotice />);

        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

        expect(screen.queryByTestId("in-app-browser-notice")).toBeNull();
        expect(sessionStorage.getItem(IN_APP_BROWSER_NOTICE_DISMISSED_KEY)).toBe("1");

        // A later visit to the menu in the same tab.
        unmount();
        render(<InAppBrowserNotice />);
        expect(screen.queryByTestId("in-app-browser-notice")).toBeNull();
    });

    it("still shows, and still dismisses, when session storage throws", () => {
        const blocked = (): never => {
            throw new Error("SecurityError: The operation is insecure.");
        };
        const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
        const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
            render(<InAppBrowserNotice />);
            expect(screen.getByTestId("in-app-browser-notice")).toBeTruthy();

            fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

            expect(screen.queryByTestId("in-app-browser-notice")).toBeNull();
            expect(warn).toHaveBeenCalledTimes(2);
        } finally {
            getItem.mockRestore();
            setItem.mockRestore();
            warn.mockRestore();
        }
    });
});

describe("InAppBrowserNotice -- Arabic", () => {
    it("asks in Arabic for an Arabic customer", async () => {
        setUserAgent(INSTAGRAM_IOS);
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = render(<InAppBrowserNotice />);

            expect(screen.getByText("افتح الموقع في Safari لتبقى مسجّل الدخول")).toBeTruthy();
            expect(screen.getByRole("link", { name: "افتح في Safari" })).toBeTruthy();
            expect(screen.getByText("أو اضغط على ⋯ واختر الفتح في متصفح خارجي")).toBeTruthy();
            expect(screen.getByRole("button", { name: "إغلاق" })).toBeTruthy();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("asks for Chrome in Arabic on Android", async () => {
        setUserAgent(INSTAGRAM_ANDROID);
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = render(<InAppBrowserNotice />);

            expect(screen.getByText("افتح الموقع في Chrome لتبقى مسجّل الدخول")).toBeTruthy();
            expect(screen.getByRole("link", { name: "افتح في Chrome" })).toBeTruthy();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
