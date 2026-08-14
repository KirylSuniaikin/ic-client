import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { resetKioskSession } from "./resetKioskSession";
import type { KioskResetDeps } from "./resetKioskSession";
import { KIOSK_BRANCH_KEY } from "./kioskBranch";
import { DEFAULT_PAYMENT_METHOD } from "../../order/types";

function makeDeps(language = "en"): {
    deps: KioskResetDeps;
    changeLanguage: ReturnType<typeof jest.fn>;
} {
    const changeLanguage = jest.fn<unknown, [string]>();
    const deps: KioskResetDeps = {
        cart: {
            setCartItems: jest.fn(),
            setCartOpen: jest.fn(),
            setPopupGroup: jest.fn(),
            setEditMode: jest.fn(),
            setPizzaPopupOpen: jest.fn(),
            setComboPopupOpen: jest.fn(),
            setPizzaComboPopupOpen: jest.fn(),
            setDetroitComboPopupOpen: jest.fn(),
            setGenericPopupOpen: jest.fn(),
            setBaguettePizzaPopupOpen: jest.fn(),
            setUpsellPopupOpen: jest.fn(),
            setClosedPopupOpen: jest.fn(),
        },
        checkout: {
            setPhonePopupOpen: jest.fn(),
            setIsCrossSellOpen: jest.fn(),
            resetCrossSellShown: jest.fn(),
            setPickUpReminder: jest.fn(),
            setShowOrderConfirmed: jest.fn(),
            setUnavailablePopupOpen: jest.fn(),
            setUnavailableItems: jest.fn(),
            setUnavailableMessage: jest.fn(),
            setErrorSnackBarOpen: jest.fn(),
            setBlacklistSnackBarOpen: jest.fn(),
            setPaymentMethod: jest.fn(),
            setOrderType: jest.fn(),
        },
        i18n: { language, changeLanguage },
        defaultPaymentMethod: DEFAULT_PAYMENT_METHOD,
        defaultOrderType: "Pick Up",
    };
    return { deps, changeLanguage };
}

describe("resetKioskSession", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        // jsdom has no scrollTo implementation and logs a "Not implemented" error for every call.
        // Replaced via defineProperty rather than jest.spyOn/assignment because scrollTo is an
        // overloaded DOM signature that @jest/globals' mock types cannot model (and there is no
        // @types/jest in this project to fall back on).
        Object.defineProperty(window, "scrollTo", { value: () => {}, writable: true });
    });

    it("empties the cart and closes every cart-owned popup", () => {
        const { deps } = makeDeps();

        resetKioskSession(deps);

        expect(deps.cart.setCartItems).toHaveBeenCalledWith([]);
        expect(deps.cart.setCartOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setPopupGroup).toHaveBeenCalledWith(null);
        expect(deps.cart.setEditMode).toHaveBeenCalledWith(false);
        expect(deps.cart.setPizzaPopupOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setComboPopupOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setPizzaComboPopupOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setDetroitComboPopupOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setGenericPopupOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setBaguettePizzaPopupOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setUpsellPopupOpen).toHaveBeenCalledWith(false);
        expect(deps.cart.setClosedPopupOpen).toHaveBeenCalledWith(false);
    });

    it("clears every checkout flag and restores the cart defaults", () => {
        const { deps } = makeDeps();

        resetKioskSession(deps);

        expect(deps.checkout.setPhonePopupOpen).toHaveBeenCalledWith(false);
        expect(deps.checkout.setIsCrossSellOpen).toHaveBeenCalledWith(false);
        expect(deps.checkout.setPickUpReminder).toHaveBeenCalledWith(false);
        expect(deps.checkout.setShowOrderConfirmed).toHaveBeenCalledWith(false);
        expect(deps.checkout.setUnavailablePopupOpen).toHaveBeenCalledWith(false);
        expect(deps.checkout.setUnavailableItems).toHaveBeenCalledWith([]);
        expect(deps.checkout.setUnavailableMessage).toHaveBeenCalledWith(null);
        expect(deps.checkout.setErrorSnackBarOpen).toHaveBeenCalledWith(false);
        expect(deps.checkout.setBlacklistSnackBarOpen).toHaveBeenCalledWith(false);
        expect(deps.checkout.setPaymentMethod).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
        expect(deps.checkout.setOrderType).toHaveBeenCalledWith("Pick Up");
    });

    it("re-arms the cross-sell so the next customer is offered it too", () => {
        const { deps } = makeDeps();

        resetKioskSession(deps);

        // wasCrossSellShown never reset before this: on a long-lived kiosk tab only the day's first
        // customer would ever see the cross-sell.
        expect(deps.checkout.resetCrossSellShown).toHaveBeenCalledTimes(1);
    });

    it("resets an Arabic session back to English and persists the choice", () => {
        const { deps, changeLanguage } = makeDeps("ar");

        resetKioskSession(deps);

        expect(changeLanguage).toHaveBeenCalledWith("en");
        expect(localStorage.getItem("ic_lang")).toBe("en");
    });

    it("does not call changeLanguage when the session is already English", () => {
        const { deps, changeLanguage } = makeDeps("en");

        resetKioskSession(deps);

        expect(changeLanguage).not.toHaveBeenCalled();
        expect(localStorage.getItem("ic_lang")).toBe("en");
    });

    it("clears sessionStorage so the next customer gets first-visit scroll hints", () => {
        sessionStorage.setItem("scrollHintDismissed", "true");
        const { deps } = makeDeps();

        resetKioskSession(deps);

        expect(sessionStorage.getItem("scrollHintDismissed")).toBeNull();
    });

    it("never clears the device's branch — that outlives customers", () => {
        localStorage.setItem(KIOSK_BRANCH_KEY, JSON.stringify({ id: "branch-1", branchName: "Juffair" }));
        const { deps } = makeDeps();

        resetKioskSession(deps);

        expect(localStorage.getItem(KIOSK_BRANCH_KEY)).not.toBeNull();
    });
});
