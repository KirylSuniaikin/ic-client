import { DEFAULT_LANGUAGE } from "../../../shared/i18n";
import type { UseCartResult } from "../../cart/hooks/useCart";
import type { UseCheckoutResult } from "../../order/hooks/useCheckout";

/**
 * The slices of the cart and checkout hooks the reset needs to touch. Declared as `Pick<>` of the
 * real result types rather than a hand-written setter list so a rename upstream breaks the build
 * here instead of silently leaving state uncleared between customers.
 */
export interface KioskResetDeps {
    cart: Pick<
        UseCartResult,
        | "setCartItems"
        | "setCartOpen"
        | "setPopupGroup"
        | "setEditMode"
        | "setPizzaPopupOpen"
        | "setComboPopupOpen"
        | "setPizzaComboPopupOpen"
        | "setDetroitComboPopupOpen"
        | "setGenericPopupOpen"
        | "setBaguettePizzaPopupOpen"
        | "setUpsellPopupOpen"
        | "setClosedPopupOpen"
    >;
    checkout: Pick<
        UseCheckoutResult,
        | "setPhonePopupOpen"
        | "setIsCrossSellOpen"
        | "resetCrossSellShown"
        | "setPickUpReminder"
        | "setShowOrderConfirmed"
        | "setUnavailablePopupOpen"
        | "setUnavailableItems"
        | "setUnavailableMessage"
        | "setErrorSnackBarOpen"
        | "setBlacklistSnackBarOpen"
        | "setPaymentMethod"
        | "setOrderType"
    >;
    /** The live i18n instance. Narrowed to what the reset uses so tests can pass a stub. */
    i18n: {
        language: string;
        changeLanguage: (lng: string) => unknown;
    };
    /** Cart/checkout defaults to restore, so this module doesn't re-declare them. */
    defaultPaymentMethod: string;
    defaultOrderType: string;
}

/**
 * Wipes every trace of one walk-up customer so the next person finds a clean kiosk.
 *
 * Deliberately a plain function over explicit setters rather than a hook: it is called from a
 * callback the kiosk checkout hook owns, and making it a hook would create a cycle between the two
 * (the hook would have to be constructed before the thing it resets).
 *
 * The device's own identity — `kiosk_branch_data` and `kiosk_device_name` — is NEVER cleared here.
 * Pairing outlives customers; only the staff re-pair gesture replaces it.
 */
export function resetKioskSession(deps: KioskResetDeps): void {
    const { cart, checkout, i18n, defaultPaymentMethod, defaultOrderType } = deps;

    cart.setCartItems([]);
    cart.setCartOpen(false);
    cart.setPopupGroup(null);
    cart.setEditMode(false);
    cart.setPizzaPopupOpen(false);
    cart.setComboPopupOpen(false);
    cart.setPizzaComboPopupOpen(false);
    cart.setDetroitComboPopupOpen(false);
    cart.setGenericPopupOpen(false);
    cart.setBaguettePizzaPopupOpen(false);
    cart.setUpsellPopupOpen(false);
    cart.setClosedPopupOpen(false);

    checkout.setPhonePopupOpen(false);
    checkout.setIsCrossSellOpen(false);
    // Without this, `wasCrossSellShown` stays true for the life of the tab and only the day's first
    // customer is ever offered the cross-sell.
    checkout.resetCrossSellShown();
    checkout.setPickUpReminder(false);
    checkout.setShowOrderConfirmed(false);
    checkout.setUnavailablePopupOpen(false);
    checkout.setUnavailableItems([]);
    checkout.setUnavailableMessage(null);
    checkout.setErrorSnackBarOpen(false);
    checkout.setBlacklistSnackBarOpen(false);
    checkout.setPaymentMethod(defaultPaymentMethod);
    checkout.setOrderType(defaultOrderType);

    // The kiosk is one long-lived tab shared by walk-up customers: a customer who switched to Arabic
    // would otherwise leave the NEXT customer in Arabic. The detector no longer auto-caches, so the
    // reset is persisted explicitly — "ic_lang" outranks navigator in the detection order.
    //
    // Deliberately at SESSION END, not straight after the order is created (which is where the old
    // kiosk branch in useCheckout did it): on web the customer is still standing at this same tab
    // reading the payment and confirmation sheets, and flipping them to English mid-flow is
    // user-hostile.
    if (!i18n.language.startsWith(DEFAULT_LANGUAGE)) {
        i18n.changeLanguage(DEFAULT_LANGUAGE);
    }
    try {
        localStorage.setItem("ic_lang", DEFAULT_LANGUAGE);
        // Per-session scroll hints live in sessionStorage; clearing gives the next customer the
        // same first-visit affordances (mirrors HomePage's own once-per-kiosk-tab clear).
        sessionStorage.clear();
    } catch {
        // Storage unavailable (private mode) — the in-memory reset above is what actually matters.
    }

    // Guarded: jsdom (and some kiosk browser shells) don't implement scrollTo, and failing to
    // scroll must never take the reset down with it.
    try {
        window.scrollTo({ top: 0 });
    } catch {
        // Non-fatal — the next customer just starts where the last one left off.
    }
}
