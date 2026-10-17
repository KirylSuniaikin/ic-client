import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "../../../shared/i18n";
import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD } from "../../order/types";

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

describe("CartPopup — card in the payment list", () => {
    it("offers no Card row when the cardPayment prop is absent", () => {
        renderCart();

        expect(screen.queryByRole("button", { name: "Card" })).toBeNull();
    });

    it("offers no Card row when it is not available", () => {
        renderCart({ cardPayment: { available: false, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Card" })).toBeNull();
    });

    it("lists Card after the BENEFIT methods instead of a separate button", () => {
        renderCart({ cardPayment: AVAILABLE });

        const names = ["Benefit", "BenefitPay", "Card"].map(name => screen.getByRole("button", { name }));
        expect(names[1].compareDocumentPosition(names[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });

    it("makes Checkout open the card drawer when Card is selected, without touching checkout", () => {
        const start = jest.fn<void, []>();
        const { onCheckout } = renderCart({ cardPayment: { available: true, busy: false, start } });

        fireEvent.click(screen.getByRole("button", { name: "Card" }));
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(start).toHaveBeenCalledTimes(1);
        expect(onCheckout).not.toHaveBeenCalled();
        expect(window.localStorage.getItem("ic.preferredPaymentMethod")).toBe("card");
    });

    it("never sends Card as the order's payment_type", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, cardPayment: AVAILABLE });

        fireEvent.click(screen.getByRole("button", { name: "Card" }));

        expect(onPaymentChange).not.toHaveBeenCalled();
    });

    it("disables Checkout while a card payment is busy", () => {
        renderCart({ cardPayment: { available: true, busy: true, start: jest.fn() } });

        fireEvent.click(screen.getByRole("button", { name: "Card" }));

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

        expect(screen.queryByRole("button", { name: "Card" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });

    it("hides Card for admin even when available", () => {
        renderCart({ isAdmin: true, cardPayment: AVAILABLE });

        expect(screen.queryByRole("button", { name: "Card" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });
});
