import { jest, describe, it, expect, afterEach } from "@jest/globals";
import {
    APPLE_PAY_VERSION,
    buildApplePayRequest,
    computeSheetTotal,
    isApplePayCapable,
    trackApplePayPurchase,
} from "./applePayRequest";
import type { CartItem } from "../../menu/types";

function item(amount: number, quantity: number): CartItem {
    return {
        id: 1, name: "Water", size: "M", category: "Beverages", isThinDough: false, isGarlicCrust: false,
        extraIngredients: [], toppings: [], note: "", quantity, description: "", amount,
        discountAmount: 0, comboItems: null, photo: "",
    };
}

class ThrowingSession implements ApplePaySessionInstance {
    static readonly STATUS_SUCCESS = 0;
    static readonly STATUS_FAILURE = 1;
    static canMakePayments(): boolean { throw new Error("insecure"); }
    static supportsVersion(): boolean { return true; }
    onvalidatemerchant: ((event: ApplePayValidateMerchantEvent) => void) | null = null;
    onpaymentauthorized: ((event: ApplePayPaymentAuthorizedEvent) => void) | null = null;
    oncancel: (() => void) | null = null;
    begin(): void { return; }
    abort(): void { return; }
    completeMerchantValidation(): void { return; }
    completePayment(): void { return; }
}

afterEach(() => {
    delete window.ApplePaySession;
    delete window.fbq;
    delete window.ttq;
});

describe("isApplePayCapable", () => {
    it("is false without ApplePaySession", () => {
        expect(isApplePayCapable()).toBe(false);
    });

    it("is false when canMakePayments() throws", () => {
        window.ApplePaySession = ThrowingSession;

        expect(isApplePayCapable()).toBe(false);
    });
});

describe("computeSheetTotal", () => {
    it("formats the sheet amount with 3 decimals and the numeric amount with 2", () => {
        const total = computeSheetTotal([item(2.5, 2)]);

        expect(total.sheetAmount).toBe("5.000");
        expect(total.amount).toBe(5);
    });

    it("rounds to 2 decimals before formatting", () => {
        const total = computeSheetTotal([item(3.3333, 1)]);

        expect(total.sheetAmount).toBe("3.330");
        expect(total.amount).toBe(3.33);
    });
});

describe("buildApplePayRequest", () => {
    it("builds a BHD request for Bahrain with the given total", () => {
        const request = buildApplePayRequest("5.000");

        expect(APPLE_PAY_VERSION).toBe(6);
        expect(request.currencyCode).toBe("BHD");
        expect(request.countryCode).toBe("BH");
        expect(request.total.amount).toBe("5.000");
    });
});

describe("trackApplePayPurchase", () => {
    it("fires Meta and TikTok purchase events with the order id as event id", () => {
        const fbq = jest.fn<void, unknown[]>();
        const track = jest.fn<void, [string, Record<string, unknown>?]>();
        window.fbq = fbq;
        window.ttq = { track };

        trackApplePayPurchase(4821, 5, "97333111222");

        expect(fbq).toHaveBeenCalledWith("track", "Purchase", { value: 5, currency: "BHD" }, { eventID: "4821" });
        expect(track).toHaveBeenCalledWith("PlaceAnOrder", expect.objectContaining({ order_id: 4821, value: 5 }));
    });

    it("does not throw when no pixels are installed", () => {
        expect(() => trackApplePayPurchase(1, 5, "97333111222")).not.toThrow();
    });
});
