import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "../../../shared/i18n";
import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD } from "../../order/types";
import { PAYMENT_ROW_NAME, choosePayment, listedPaymentMethods, openPaymentSheet } from "./paymentSelector.testutil";

const ITEM: CartItem = {
    id: 1, name: "Water", size: "M", category: "Beverages", isThinDough: false, isGarlicCrust: false,
    extraIngredients: [], toppings: [], note: "", quantity: 1, description: "", amount: 2.5,
    discountAmount: 0, comboItems: null, photo: "",
};

function renderCart(overrides: Partial<React.ComponentProps<typeof CartPopup>> = {}) {
    const onCheckout = jest.fn();
    render(
        <CartPopup
            open
            onClose={jest.fn()}
            items={[ITEM]}
            onChangeQuantity={jest.fn()}
            onChangeSize={jest.fn()}
            onRemoveItem={jest.fn()}
            onCheckout={onCheckout}
            openPizzaEditPopUp={jest.fn()}
            openPizzaComboEditPopup={jest.fn()}
            openDetroitComboEditPopup={jest.fn()}
            isAdmin={false}
            handleDiscountChange={jest.fn()}
            menuData={[]}
            paymentMethod={DEFAULT_PAYMENT_METHOD}
            onPaymentChange={jest.fn()}
            orderType="Pick Up"
            onDeliveryTypeChange={jest.fn()}
            isKiosk={false}
            {...overrides}
        />,
    );
    return { onCheckout };
}

const AVAILABLE = { available: true, busy: false, start: jest.fn<void, []>() };

beforeEach(() => {
    window.localStorage.clear();
});

describe("CartPopup — Apple Pay in the payment list", () => {
    // The Apple Pay button is checked before the sheet opens: an open sheet hides the cart behind
    // it from role queries, which would make its absence trivially true.
    it("offers no Apple Pay row and no Apple Pay button when the applePay prop is absent", () => {
        renderCart();

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        expect(listedPaymentMethods()).toEqual(["Benefit", "BenefitPay", "At counter"]);
    });

    it("offers no Apple Pay row when it is not available", () => {
        renderCart({ applePay: { available: false, busy: false, start: jest.fn() } });

        expect(listedPaymentMethods()).toEqual(["Benefit", "BenefitPay", "At counter"]);
    });

    // One list, one button: Apple Pay is a row like the others, and its button only replaces
    // Checkout once the customer has chosen it.
    it("lists Apple Pay as a method without replacing Checkout until it is selected", () => {
        renderCart({ applePay: AVAILABLE });

        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        openPaymentSheet();
        expect(screen.getByRole("radio", { name: "Apple Pay" }).getAttribute("aria-checked")).toBe("false");
    });

    it("swaps Checkout for Apple's button when selected, and starts the session without touching checkout", async () => {
        const start = jest.fn<void, []>();
        const { onCheckout } = renderCart({ applePay: { available: true, busy: false, start } });

        await choosePayment("Apple Pay");
        expect(screen.queryByRole("button", { name: "Checkout" })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

        expect(start).toHaveBeenCalledTimes(1);
        expect(onCheckout).not.toHaveBeenCalled();
    });

    it("disables Apple's button while busy", async () => {
        renderCart({ applePay: { available: true, busy: true, start: jest.fn() } });

        await choosePayment("Apple Pay");

        expect(screen.getByRole("button", { name: "Pay with Apple Pay" }).hasAttribute("disabled")).toBe(true);
    });

    // Nothing is preselected any more (owner, 18 Oct 2026), not even the method used last time.
    it("does not open on Apple Pay for a customer who paid with it last time", () => {
        window.localStorage.setItem("ic.preferredPaymentMethod", "applePay");

        renderCart({ applePay: AVAILABLE });

        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        openPaymentSheet();
        expect(screen.getByRole("radio", { name: "Apple Pay" }).getAttribute("aria-checked")).toBe("false");
    });

    // Delivery is paid in DeliveryCheckoutDrawer; this button would create an address-less order.
    it("offers no Apple Pay for a Delivery order, only Checkout", () => {
        renderCart({ orderType: "Delivery", applePay: AVAILABLE });

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });

    it("hides Apple Pay for kiosk even when available", () => {
        renderCart({ isKiosk: true, applePay: AVAILABLE });

        expect(screen.queryByRole("button", { name: PAYMENT_ROW_NAME })).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });

    it("hides Apple Pay for admin even when available", () => {
        renderCart({ isAdmin: true, applePay: AVAILABLE });

        expect(screen.queryByRole("button", { name: PAYMENT_ROW_NAME })).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });
});
