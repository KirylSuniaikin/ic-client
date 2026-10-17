import { jest, describe, it, expect } from "@jest/globals";
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

describe("CartPopup — Pay by card button", () => {
    it("renders no card button when the cardPayment prop is absent", () => {
        renderCart();

        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });

    it("renders no card button when it is not available", () => {
        renderCart({ cardPayment: { available: false, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });

    it("renders the button when available and calls start without touching checkout", () => {
        const start = jest.fn<void, []>();
        const { onCheckout } = renderCart({ cardPayment: { available: true, busy: false, start } });

        fireEvent.click(screen.getByRole("button", { name: "Pay by card" }));

        expect(start).toHaveBeenCalledTimes(1);
        expect(onCheckout).not.toHaveBeenCalled();
    });

    it("disables the button while busy", () => {
        renderCart({ cardPayment: { available: true, busy: true, start: jest.fn() } });

        expect(screen.getByRole("button", { name: "Pay by card" }).hasAttribute("disabled")).toBe(true);
    });

    // Delivery is paid in DeliveryCheckoutDrawer; this button would create an address-less order.
    it("hides the button for a Delivery order even when available", () => {
        renderCart({ orderType: "Delivery", cardPayment: { available: true, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });

    it("hides the button for kiosk even when available", () => {
        renderCart({ isKiosk: true, cardPayment: { available: true, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });

    it("hides the button for admin even when available", () => {
        renderCart({ isAdmin: true, cardPayment: { available: true, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay by card" })).toBeNull();
    });
});
