import { p2, toDecimal } from "../../../shared/utils/decimalUtils";
import { computeAmountPaid } from "./orderPayload";
import type { CartItem } from "../../menu/types";

// Apple Pay JS version and request constants (task-spec.md A12). Networks still need
// confirming with the acquirer.
export const APPLE_PAY_VERSION = 6;

// True only when Safari exposes Apple Pay JS and the device can actually pay. canMakePayments()
// throws in insecure contexts and cross-origin frames; "cannot pay here" is the correct answer
// there, so the probe maps the throw to false rather than surfacing it.
export function isApplePayCapable(): boolean {
    if (typeof window === "undefined" || !window.ApplePaySession) return false;
    try {
        return window.ApplePaySession.canMakePayments();
    } catch {
        return false;
    }
}

// The total the sheet shows AND the string the create-order response is compared against.
// Rounded to 2 decimals first (A10): the server rejects more than 2 decimals.
export function computeSheetTotal(items: CartItem[]): { amount: number; sheetAmount: string } {
    const rounded = p2(toDecimal(computeAmountPaid(items)));
    return { amount: rounded.toNumber(), sheetAmount: rounded.toFixed(3) };
}

export function buildApplePayRequest(sheetAmount: string): ApplePayPaymentRequest {
    return {
        countryCode: "BH",
        currencyCode: "BHD",
        supportedNetworks: ["visa", "masterCard"],
        merchantCapabilities: ["supports3DS"],
        total: { label: "IC Pizza", amount: sheetAmount },
    };
}

// Same pixel events executeOrderCreation fires; eventID = order id so Meta dedupes against
// the server-side event (see MetaService.createEventData).
export function trackApplePayPurchase(orderId: number, amount: number, tel: string): void {
    window.ttq?.track("PlaceAnOrder", { content_id: "PlaceAnOrder", order_id: orderId, currency: "BHD", value: amount });
    window.fbq?.("track", "Purchase", { value: amount, currency: "BHD" }, { eventID: String(orderId) });
    const identify = window.ttq?.identify;
    if (typeof identify === "function") {
        identify.call(window.ttq, { phone_number: "+" + tel });
    }
}
