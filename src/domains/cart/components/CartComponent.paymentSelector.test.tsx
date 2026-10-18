import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// CartPopup renders its copy via useTranslation; initialize the real i18n instance.
import i18n from "../../../shared/i18n";

import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import {
    PAYMENT_ROW_NAME, cartModalRoot, choosePayment, hasSheetRoot, layerOf, listedPaymentMethods, paymentRow,
    paymentRowName, sheetRoot, waitForPaymentSheetToClose,
} from "./paymentSelector.testutil";

// The payment methods as one row that opens a sheet listing them all (option A, which
// replaced option B's chip row on 18 Oct 2026). PaymentMethodSelector.test.tsx covers the row and
// the sheet on their own; this suite covers what the cart feeds them and does with the pick.

const ITEM: CartItem = {
    id: 1, name: "Water", size: "M", category: "Beverages", isThinDough: false, isGarlicCrust: false,
    extraIngredients: [], toppings: [], note: "", quantity: 1, description: "", amount: 2.5,
    discountAmount: 0, comboItems: null, photo: "",
};
const ITEMS: CartItem[] = [ITEM];

type CartProps = React.ComponentProps<typeof CartPopup>;

function cartProps(overrides: Partial<CartProps> = {}): CartProps {
    return {
        open: true,
        onClose: jest.fn<void, []>(),
        items: ITEMS,
        onChangeQuantity: jest.fn(),
        onChangeSize: jest.fn(),
        onRemoveItem: jest.fn(),
        onCheckout: jest.fn<void, unknown[]>(),
        openPizzaEditPopUp: jest.fn(),
        openPizzaComboEditPopup: jest.fn(),
        openDetroitComboEditPopup: jest.fn(),
        isAdmin: false,
        handleDiscountChange: jest.fn(),
        menuData: [],
        paymentMethod: PAY_ONLINE_METHOD,
        onPaymentChange: jest.fn<void, [string]>(),
        orderType: "Pick Up",
        onDeliveryTypeChange: jest.fn<void, [string]>(),
        isKiosk: false,
        ...overrides,
    };
}

function renderCart(overrides: Partial<CartProps> = {}): CartProps & { rerender: (next: Partial<CartProps>) => void } {
    const props = cartProps(overrides);
    const view = render(<CartPopup {...props} />);
    return { ...props, rerender: (next) => view.rerender(<CartPopup {...props} {...next} />) };
}

/** Built per test: CRA's resetMocks would clear a module-level mock's implementation. */
function available(start = jest.fn<void, []>()) {
    return { available: true, busy: false, start };
}

// Talabat's most used first, and the counter last (owner, 18 Oct 2026); see usePaymentChoice.
const ALL_METHODS = ["Card", "Apple Pay", "Benefit", "BenefitPay", "At counter"];
const GUEST_METHODS = ["Benefit", "BenefitPay", "At counter"];

const INVITE_EN = "Hey, we added new payment methods — check them out!";
const INVITE_AR = "مرحباً! أضفنا طرق دفع جديدة، اكتشفها الآن";

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    clearMatchMedia();
});

describe("CartPopup — payment row on the phone", () => {
    it("shows one row instead of a control per method", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        expect(paymentRow()).toBeTruthy();
        ALL_METHODS.forEach((name) => expect(screen.queryByRole("button", { name })).toBeNull());
        expect(screen.queryByRole("radio")).toBeNull();
    });

    it("lists a signed-in customer's methods by Talabat popularity, the counter last", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        expect(listedPaymentMethods()).toEqual(ALL_METHODS);
    });

    // Apple Pay and card need an account, so a guest gets the BENEFIT pair and the counter.
    it("lists a guest's methods in the same order: Benefit, BenefitPay, then the counter", () => {
        renderCart();

        expect(listedPaymentMethods()).toEqual(GUEST_METHODS);
    });

    it("keeps the order when only one of Apple Pay and card is available", () => {
        renderCart({ cardPayment: available() });

        expect(listedPaymentMethods()).toEqual(["Card", ...GUEST_METHODS]);
    });

    it("hands the cart the method the customer picks", async () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, paymentMethod: PAY_ONLINE_METHOD });

        await choosePayment("At counter");

        expect(onPaymentChange).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
    });

    it("keeps exactly one pay button below the total", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        expect(screen.getAllByRole("button", { name: /^checkout$|^pay with apple pay$/i })).toHaveLength(1);
    });

    it("paints its sheet above the still-open cart", () => {
        renderCart();
        fireEvent.click(paymentRow());

        const sheetZ = layerOf(sheetRoot("drawer"));
        expect(Number.isNaN(sheetZ)).toBe(false);
        expect(sheetZ > layerOf(cartModalRoot())).toBe(true);
    });
});

describe("CartPopup — Apple Pay picked from the sheet", () => {
    it("swaps Checkout for Apple's button and opens the session inside the same tap", async () => {
        let dispatching = false;
        let startedDuringTap = false;
        const start = jest.fn<void, []>(() => {
            startedDuringTap = dispatching;
        });
        const { onCheckout } = renderCart({ applePay: available(start) });

        await choosePayment("Apple Pay");
        expect(paymentRow().getAttribute("aria-label")).toBe(paymentRowName("Apple Pay"));
        expect(screen.queryByRole("button", { name: "Checkout" })).toBeNull();

        dispatching = true;
        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));
        dispatching = false;

        expect(start).toHaveBeenCalledTimes(1);
        // Safari opens a payment sheet only from inside the user's gesture, never after an await.
        expect(startedDuringTap).toBe(true);
        expect(onCheckout).not.toHaveBeenCalled();
    });

    it("goes back to the red Checkout when another method is picked", async () => {
        renderCart({ applePay: available() });

        await choosePayment("Apple Pay");
        await choosePayment("Benefit");

        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });
});

// Owner, 18 Oct 2026: no method is chosen for the customer, neither the old default nor the one
// they used last time, and the row invites them to look at the new methods instead.
describe("CartPopup — nothing preselected", () => {
    it.each([
        ["a guest", {}],
        ["a signed-in customer", { applePay: available(), cardPayment: available() }],
    ])("opens with no method chosen for %s, inviting them to look", (_label, overrides) => {
        renderCart({ ...overrides, paymentMethod: WALLET_METHOD });

        expect(paymentRow().getAttribute("aria-label")).toBe(paymentRowName(INVITE_EN));
        expect(paymentRow().textContent).toBe(INVITE_EN);
        fireEvent.click(paymentRow());
        screen.getAllByRole("radio").forEach((radio) => expect(radio.getAttribute("aria-checked")).toBe("false"));
    });

    it("ignores the method remembered from an earlier visit, and pushes nothing to the order", () => {
        window.localStorage.setItem("ic.preferredPaymentMethod", WALLET_METHOD);
        const { onPaymentChange } = renderCart({ applePay: available(), cardPayment: available() });

        expect(paymentRow().textContent).toBe(INVITE_EN);
        expect(onPaymentChange).not.toHaveBeenCalled();
        fireEvent.click(paymentRow());
        expect(screen.getByRole("radio", { name: "BenefitPay" }).getAttribute("aria-checked")).toBe("false");
    });

    it("ignores a remembered Apple Pay too, keeping the red Checkout", () => {
        window.localStorage.setItem("ic.preferredPaymentMethod", "applePay");
        renderCart({ applePay: available(), cardPayment: available() });

        expect(paymentRow().textContent).toBe(INVITE_EN);
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });

    it("records nothing for next time when the customer pays", async () => {
        renderCart();

        await choosePayment("BenefitPay");
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(window.localStorage.getItem("ic.preferredPaymentMethod")).toBeNull();
    });

    it("invites an Arabic customer in Arabic", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = render(<CartPopup {...cartProps()} />);

            expect(screen.getByRole("button", { name: `طريقة الدفع ${INVITE_AR}` }).textContent).toBe(INVITE_AR);
            // Unmounted first, so switching the language back cannot re-render it outside act().
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("names the picked method once the customer chooses", async () => {
        renderCart({ applePay: available(), cardPayment: available() });

        await choosePayment("At counter");

        expect(paymentRow().getAttribute("aria-label")).toBe(paymentRowName("At counter"));
        expect(screen.queryByText(INVITE_EN)).toBeNull();
    });

    // Sign-out or a refused eligibility check takes Apple Pay away after it was picked.
    it("goes back to nothing chosen when a picked Apple Pay stops being available", async () => {
        const { rerender } = renderCart({ applePay: available() });
        await choosePayment("Apple Pay");
        expect(screen.getByRole("button", { name: "Pay with Apple Pay" })).toBeTruthy();

        rerender({ applePay: { available: false, busy: false, start: jest.fn<void, []>() } });

        expect(paymentRow().textContent).toBe(INVITE_EN);
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });
});

describe("CartPopup — pay button before a method is chosen", () => {
    it.each([
        ["on the phone", false],
        ["on PC", true],
    ])("opens the payment list and places no order %s", (_label, desktop) => {
        if (desktop) stubMatchMedia(true);
        const applePayStart = jest.fn<void, []>();
        const cardStart = jest.fn<void, []>();
        const { onCheckout, onPaymentChange } = renderCart({
            paymentMethod: PAY_ONLINE_METHOD, applePay: available(applePayStart), cardPayment: available(cardStart),
        });

        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(screen.getByRole("radiogroup", { name: "Payment method" })).toBeTruthy();
        screen.getAllByRole("radio").forEach((radio) => expect(radio.getAttribute("aria-checked")).toBe("false"));
        expect(onCheckout).not.toHaveBeenCalled();
        expect(onPaymentChange).not.toHaveBeenCalled();
        expect(applePayStart).not.toHaveBeenCalled();
        expect(cardStart).not.toHaveBeenCalled();
    });

    it("waits for a second tap after a method is picked from the list it opened", async () => {
        const { onCheckout } = renderCart();
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        fireEvent.click(screen.getByRole("radio", { name: "BenefitPay" }));
        await waitForPaymentSheetToClose();

        expect(onCheckout).not.toHaveBeenCalled();
        expect(paymentRow().getAttribute("aria-label")).toBe(paymentRowName("BenefitPay"));
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", WALLET_METHOD, "", null, false);
    });
});

describe("CartPopup — the flow each picked method starts", () => {
    it.each([
        ["Benefit", PAY_ONLINE_METHOD],
        ["BenefitPay", WALLET_METHOD],
        ["At counter", DEFAULT_PAYMENT_METHOD],
    ])("%s places the order with its tender", async (method, tender) => {
        const { onCheckout, onPaymentChange } = renderCart({ applePay: available(), cardPayment: available() });

        await choosePayment(method);
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        // Pushed to useCheckout too, which the cross-sell resume and the guest detours read.
        expect(onPaymentChange).toHaveBeenCalledWith(tender);
        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", tender, "", null, false);
    });

    it("Card opens the card drawer and places no order itself", async () => {
        const cardStart = jest.fn<void, []>();
        const { onCheckout, onPaymentChange } = renderCart({ applePay: available(), cardPayment: available(cardStart) });

        await choosePayment("Card");
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(cardStart).toHaveBeenCalledTimes(1);
        expect(onCheckout).not.toHaveBeenCalled();
        expect(onPaymentChange).not.toHaveBeenCalled();
    });

    it("Apple Pay opens Apple's session and places no order itself", async () => {
        const applePayStart = jest.fn<void, []>();
        const { onCheckout, onPaymentChange } = renderCart({ applePay: available(applePayStart), cardPayment: available() });

        await choosePayment("Apple Pay");
        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

        expect(applePayStart).toHaveBeenCalledTimes(1);
        expect(onCheckout).not.toHaveBeenCalled();
        expect(onPaymentChange).not.toHaveBeenCalled();
    });
});

describe("CartPopup — no payment row outside customer pickup", () => {
    it("shows no row and no payment label for a Delivery order, only Checkout with its tender", () => {
        const { onCheckout } = renderCart({
            orderType: "Delivery", paymentMethod: WALLET_METHOD, applePay: available(), cardPayment: available(),
        });

        expect(screen.queryByRole("button", { name: PAYMENT_ROW_NAME })).toBeNull();
        expect(screen.queryByText("Payment method")).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Delivery", WALLET_METHOD, "", null, false);
    });

    it.each([
        ["admin", { isAdmin: true }],
        ["kiosk", { isKiosk: true }],
    ])("shows no row for %s", (_label, overrides) => {
        renderCart({ ...overrides, applePay: available(), cardPayment: available() });

        expect(screen.queryByRole("button", { name: PAYMENT_ROW_NAME })).toBeNull();
        expect(screen.queryByText("Payment method")).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });
});

describe("CartPopup — payment row on PC", () => {
    it("is the same row, and its list opens as a dialog above the cart dialog", () => {
        stubMatchMedia(true);
        renderCart({ applePay: available(), cardPayment: available() });

        expect(listedPaymentMethods()).toEqual(ALL_METHODS);
        expect(hasSheetRoot("drawer")).toBe(false);
        const dialogZ = layerOf(sheetRoot("dialog"));
        expect(Number.isNaN(dialogZ)).toBe(false);
        expect(dialogZ > layerOf(cartModalRoot())).toBe(true);
    });

    it("hands the cart the method picked on PC", async () => {
        stubMatchMedia(true);
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, paymentMethod: PAY_ONLINE_METHOD });

        await choosePayment("BenefitPay");

        expect(onPaymentChange).toHaveBeenCalledWith(WALLET_METHOD);
    });
});
