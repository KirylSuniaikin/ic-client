import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { APPLE_PAY_SDK_URL, detectApplePayCapability, resetApplePaySdkForTests } from "./applePaySdk";

const MERCHANT = "merchant.com.icpizza.test";

// Stands in for what Apple's SDK defines in a browser without native Apple Pay.
function polyfill(status: ApplePayCapabilities["paymentCredentialStatus"], seen: string[] = []): ApplePaySessionStatic {
    return {
        canMakePayments: (): boolean => true,
        supportsVersion: (): boolean => true,
        applePayCapabilities: async (id: string): Promise<ApplePayCapabilities> => {
            seen.push(id);
            return { paymentCredentialStatus: status };
        },
        STATUS_SUCCESS: 0,
        STATUS_FAILURE: 1,
    } as unknown as ApplePaySessionStatic; // Fixture only: the constructor is never called here.
}

function sdkScript(): HTMLScriptElement | null {
    return document.head.querySelector(`script[src="${APPLE_PAY_SDK_URL}"]`);
}

// The SDK "loads": it defines the session, then fires load, as the real script does.
function finishLoading(session: ApplePaySessionStatic): void {
    window.ApplePaySession = session;
    sdkScript()?.dispatchEvent(new Event("load"));
}

beforeEach(() => {
    resetApplePaySdkForTests();
    delete window.ApplePaySession;
    document.head.innerHTML = "";
});

afterEach(() => {
    delete window.ApplePaySession;
});

describe("detectApplePayCapability", () => {
    it("keeps Safari's native synchronous check and never fetches the SDK there", async () => {
        window.ApplePaySession = Object.assign(polyfill("paymentCredentialsAvailable"), { canMakePayments: (): boolean => false });

        await expect(detectApplePayCapability(MERCHANT)).resolves.toBe(false);
        expect(sdkScript()).toBeNull();
    });

    it("stays Safari-only when no merchant id is configured", async () => {
        await expect(detectApplePayCapability(undefined)).resolves.toBe(false);
        expect(sdkScript()).toBeNull();
    });

    it("loads Apple's 1.latest SDK and offers Apple Pay when the answer is 'unknown' (the normal answer outside Safari)", async () => {
        const seen: string[] = [];
        const result = detectApplePayCapability(MERCHANT);
        finishLoading(polyfill("paymentCredentialStatusUnknown", seen));

        await expect(result).resolves.toBe(true);
        expect(APPLE_PAY_SDK_URL).toContain("/jsapi/1.latest/");
        // The SDK sends this id with the scannable code; the capability call is how it learns it.
        expect(seen).toEqual([MERCHANT]);
    });

    it("hides Apple Pay when the SDK answers unsupported (e.g. an Android phone)", async () => {
        const result = detectApplePayCapability(MERCHANT);
        finishLoading(polyfill("applePayUnsupported"));

        await expect(result).resolves.toBe(false);
    });

    it("hides Apple Pay, without throwing, when the SDK cannot be fetched", async () => {
        const result = detectApplePayCapability(MERCHANT);
        sdkScript()?.dispatchEvent(new Event("error"));

        await expect(result).resolves.toBe(false);
    });

    it("fetches the SDK once however many times it is asked", async () => {
        const first = detectApplePayCapability(MERCHANT);
        finishLoading(polyfill("paymentCredentialStatusUnknown"));
        await first;

        await expect(detectApplePayCapability(MERCHANT)).resolves.toBe(true);
        expect(document.head.querySelectorAll("script").length).toBe(1);
    });
});
