import { describe, it, expect, beforeEach } from "@jest/globals";
import { captureFbclid, getStoredFbclid, resolveFbc, resolveFbp } from "./adAttribution";

// getCookie reads document.cookie by splitting on ';', so a full-string mock is sufficient.
// jsdom's document.cookie is an accessor; redefine it as a writable value per test for isolation.
function setCookie(raw: string): void {
    Object.defineProperty(document, "cookie", { writable: true, configurable: true, value: raw });
}

describe("adAttribution", () => {
    beforeEach(() => {
        localStorage.clear();
        setCookie("");
    });

    describe("resolveFbc", () => {
        it("prefers the _fbc cookie when present", () => {
            setCookie("_fbc=fb.1.999.cookievalue; _fbp=fb.1.999.browser");

            expect(resolveFbc()).toBe("fb.1.999.cookievalue");
        });

        it("falls back to a captured fbclid, formatted as fb.1.<seconds>.<fbclid>, when no cookie", () => {
            captureFbclid("IwAR123abc");

            expect(resolveFbc()).toMatch(/^fb\.1\.\d+\.IwAR123abc$/);
        });

        it("returns undefined when there is neither a cookie nor a stored click id", () => {
            expect(resolveFbc()).toBeUndefined();
        });
    });

    describe("resolveFbp", () => {
        it("returns the _fbp cookie when present", () => {
            setCookie("_fbp=fb.1.999.browser");

            expect(resolveFbp()).toBe("fb.1.999.browser");
        });

        it("returns undefined when the _fbp cookie is absent", () => {
            expect(resolveFbp()).toBeUndefined();
        });
    });

    describe("captureFbclid / getStoredFbclid", () => {
        it("persists the click id with a numeric capture timestamp", () => {
            captureFbclid("clickXYZ");

            const stored = getStoredFbclid();
            expect(stored?.fbclid).toBe("clickXYZ");
            expect(typeof stored?.capturedAtSeconds).toBe("number");
        });

        it("overwrites a prior click id (last-click attribution)", () => {
            captureFbclid("first");
            captureFbclid("second");

            expect(getStoredFbclid()?.fbclid).toBe("second");
        });
    });
});
