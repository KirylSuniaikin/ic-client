import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
    HOSTED_SESSION_API_VERSION,
    HostedSessionLoadError,
    isTrustedScriptUrl,
    loadHostedSessionScript,
} from "./hostedSessionLoader";

const GOOD = "https://eazypay.gateway.mastercard.com/form/version/100/merchant/TESTMERCHANT/session.js";

function scripts(): HTMLScriptElement[] {
    return Array.from(document.head.querySelectorAll("script"));
}

// jsdom never loads external scripts, so tests fire the lifecycle events themselves.
function fireLoad(script: HTMLScriptElement): void {
    script.dispatchEvent(new Event("load"));
}
function fireError(script: HTMLScriptElement): void {
    script.dispatchEvent(new Event("error"));
}

const fakeSdk: PaymentSessionStatic = { configure: jest.fn(), updateSessionFromForm: jest.fn() };

beforeEach(() => {
    jest.useFakeTimers();
    document.head.innerHTML = "";
    delete window.PaymentSession;
});

afterEach(() => {
    jest.useRealTimers();
});

describe("isTrustedScriptUrl", () => {
    it("pins the version constant", () => {
        expect(HOSTED_SESSION_API_VERSION).toBe("100");
    });

    it("accepts the documented URL", () => {
        expect(isTrustedScriptUrl(GOOD, "100")).toBe(true);
    });

    it.each([
        ["http scheme", GOOD.replace("https:", "http:")],
        ["foreign host", "https://evil.com/form/version/100/merchant/M/session.js"],
        ["wrong version in path", "https://eazypay.gateway.mastercard.com/form/version/99/merchant/M/session.js"],
        ["query injection", `${GOOD}?x=`],
        ["fragment", `${GOOD}#x`],
        ["extra path segment", "https://eazypay.gateway.mastercard.com/x/form/version/100/merchant/M/session.js"],
        ["trailing segment", `${GOOD}/more`],
        ["path traversal", "https://eazypay.gateway.mastercard.com/form/version/100/merchant/../session.js"],
        ["lookalike host (dot prefix)", "https://evil.com/.gateway.mastercard.com/form/version/100/merchant/M/session.js"],
        ["lookalike host (suffix)", "https://gateway.mastercard.com.evil.com/form/version/100/merchant/M/session.js"],
        ["bare suffix without subdomain", "https://gateway.mastercard.com/form/version/100/merchant/M/session.js"],
        ["userinfo trick", "https://evil.com@eazypay.gateway.mastercard.com.evil.com/form/version/100/merchant/M/session.js"],
        ["explicit port", "https://eazypay.gateway.mastercard.com:8443/form/version/100/merchant/M/session.js"],
        ["not a URL", "not a url"],
        ["empty", ""],
    ])("rejects %s", (_label, url) => {
        expect(isTrustedScriptUrl(url, "100")).toBe(false);
    });

    it("rejects when apiVersion differs from the path version and the constant", () => {
        const v99 = "https://eazypay.gateway.mastercard.com/form/version/99/merchant/M/session.js";
        expect(isTrustedScriptUrl(v99, "99")).toBe(false);
        expect(isTrustedScriptUrl(GOOD, "99")).toBe(false);
        expect(isTrustedScriptUrl(GOOD, "")).toBe(false);
    });
});

describe("loadHostedSessionScript", () => {
    it("never injects a URL that failed validation", async () => {
        await expect(loadHostedSessionScript("https://evil.com/session.js", "100")).rejects.toBeInstanceOf(
            HostedSessionLoadError,
        );
        await expect(loadHostedSessionScript(GOOD, "99")).rejects.toBeInstanceOf(HostedSessionLoadError);
        expect(scripts()).toHaveLength(0);
    });

    it("injects one async script and resolves with window.PaymentSession on load", async () => {
        const url = GOOD.replace("TESTMERCHANT", "RESOLVES");
        const pending = loadHostedSessionScript(url, "100");

        expect(scripts()).toHaveLength(1);
        expect(scripts()[0].src).toBe(url);
        expect(scripts()[0].async).toBe(true);

        window.PaymentSession = fakeSdk;
        fireLoad(scripts()[0]);

        await expect(pending).resolves.toBe(fakeSdk);
    });

    it("injects exactly one script for repeated loads of the same URL", async () => {
        const url = GOOD.replace("TESTMERCHANT", "REPEATED");
        const first = loadHostedSessionScript(url, "100");
        const second = loadHostedSessionScript(url, "100");

        expect(scripts()).toHaveLength(1);
        expect(second).toBe(first);

        window.PaymentSession = fakeSdk;
        fireLoad(scripts()[0]);
        await first;

        await expect(loadHostedSessionScript(url, "100")).resolves.toBe(fakeSdk);
        expect(scripts()).toHaveLength(1);
    });

    it("rejects when the script loads but window.PaymentSession is missing, removes the tag and allows a retry", async () => {
        const url = GOOD.replace("TESTMERCHANT", "MISSING");
        const pending = loadHostedSessionScript(url, "100");
        const rejection = expect(pending).rejects.toBeInstanceOf(HostedSessionLoadError);
        fireLoad(scripts()[0]);
        await rejection;
        expect(scripts()).toHaveLength(0);

        const retry = loadHostedSessionScript(url, "100");
        expect(scripts()).toHaveLength(1);
        window.PaymentSession = fakeSdk;
        fireLoad(scripts()[0]);
        await expect(retry).resolves.toBe(fakeSdk);
    });

    it("rejects on onerror, removes the tag and re-injects on retry", async () => {
        const url = GOOD.replace("TESTMERCHANT", "ONERROR");
        const pending = loadHostedSessionScript(url, "100");
        const rejection = expect(pending).rejects.toBeInstanceOf(HostedSessionLoadError);
        fireError(scripts()[0]);
        await rejection;
        expect(scripts()).toHaveLength(0);

        const retry = loadHostedSessionScript(url, "100");
        expect(retry).not.toBe(pending);
        expect(scripts()).toHaveLength(1);
        window.PaymentSession = fakeSdk;
        fireLoad(scripts()[0]);
        await expect(retry).resolves.toBe(fakeSdk);
    });

    it("rejects after the 15 s timeout, removes the tag and re-injects on retry", async () => {
        const url = GOOD.replace("TESTMERCHANT", "TIMEOUT");
        const pending = loadHostedSessionScript(url, "100");
        const rejection = expect(pending).rejects.toBeInstanceOf(HostedSessionLoadError);

        jest.advanceTimersByTime(14_999);
        expect(scripts()).toHaveLength(1);
        jest.advanceTimersByTime(1);
        await rejection;
        expect(scripts()).toHaveLength(0);

        void loadHostedSessionScript(url, "100").catch(() => undefined);
        expect(scripts()).toHaveLength(1);
    });
});
