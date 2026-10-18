import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "../../../shared/i18n";
import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD } from "../../order/types";
import { PAYMENT_ROW_NAME, choosePayment, listedPaymentMethods } from "./paymentSelector.testutil";

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

const AVAILABLE = { available: true, signInRequired: false, busy: false, start: jest.fn<void, []>() };

beforeEach(() => {
    window.localStorage.clear();
});

describe("CartPopup — card in the payment list", () => {
    it("offers no Card row when the cardPayment prop is absent", () => {
        renderCart();

        expect(listedPaymentMethods()).toEqual(["Benefit", "BenefitPay", "At counter"]);
    });

    it("offers no Card row when it is not available", () => {
        renderCart({ cardPayment: { available: false, signInRequired: false, busy: false, start: jest.fn() } });

        expect(listedPaymentMethods()).toEqual(["Benefit", "BenefitPay", "At counter"]);
    });

    // Card first: the most used way to pay among our Talabat customers (see usePaymentChoice).
    it("lists Card first instead of a separate button", () => {
        renderCart({ cardPayment: AVAILABLE });

        // Before the sheet opens: an open sheet hides the cart's own buttons from role queries.
        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
        expect(listedPaymentMethods()).toEqual(["Card", "Benefit", "BenefitPay", "At counter"]);
    });

    it("makes Checkout open the card drawer when Card is selected, without touching checkout", async () => {
        const start = jest.fn<void, []>();
        const { onCheckout } = renderCart({ cardPayment: { available: true, signInRequired: false, busy: false, start } });

        await choosePayment("Card");
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(start).toHaveBeenCalledTimes(1);
        expect(onCheckout).not.toHaveBeenCalled();
    });

    it("never sends Card as the order's payment_type", async () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, cardPayment: AVAILABLE });

        await choosePayment("Card");

        expect(onPaymentChange).not.toHaveBeenCalled();
    });

    it("disables Checkout while a card payment is busy", async () => {
        renderCart({ cardPayment: { available: true, signInRequired: false, busy: true, start: jest.fn() } });

        await choosePayment("Card");

        expect(screen.getByRole("button", { name: "Checkout" }).hasAttribute("disabled")).toBe(true);
    });

    // Delivery is paid in DeliveryCheckoutDrawer; this button would create an address-less order.
    it("offers no card for a Delivery order, only Checkout", () => {
        renderCart({ orderType: "Delivery", cardPayment: AVAILABLE });

        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });

    it("hides Card for kiosk even when available", () => {
        renderCart({ isKiosk: true, cardPayment: AVAILABLE });

        expect(screen.queryByRole("button", { name: PAYMENT_ROW_NAME })).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });

    it("hides Card for admin even when available", () => {
        renderCart({ isAdmin: true, cardPayment: AVAILABLE });

        expect(screen.queryByRole("button", { name: PAYMENT_ROW_NAME })).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });
});
