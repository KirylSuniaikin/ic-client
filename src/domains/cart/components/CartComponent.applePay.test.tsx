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

describe("CartPopup — Apple Pay button", () => {
    it("renders no Apple Pay button when the applePay prop is absent", () => {
        renderCart();

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });

    it("renders no Apple Pay button when it is not available", () => {
        renderCart({ applePay: { available: false, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });

    it("renders the button when available and calls start on click without touching checkout", () => {
        const start = jest.fn<void, []>();
        const { onCheckout } = renderCart({ applePay: { available: true, busy: false, start } });

        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

        expect(start).toHaveBeenCalledTimes(1);
        expect(onCheckout).not.toHaveBeenCalled();
    });

    it("disables the button while busy", () => {
        renderCart({ applePay: { available: true, busy: true, start: jest.fn() } });

        expect(screen.getByRole("button", { name: "Pay with Apple Pay" }).hasAttribute("disabled")).toBe(true);
    });

    it("keeps the Checkout button behaviour unchanged when Apple Pay is shown", () => {
        const { onCheckout } = renderCart({ applePay: { available: true, busy: false, start: jest.fn() } });

        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(onCheckout).toHaveBeenCalledWith([ITEM], null, null, "Pick Up", DEFAULT_PAYMENT_METHOD, "", null, false);
    });

    // Delivery is paid in DeliveryCheckoutDrawer; this button would create an address-less order.
    it("hides the button for a Delivery order even when available", () => {
        renderCart({ orderType: "Delivery", applePay: { available: true, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });

    it("hides the button for kiosk even when available", () => {
        renderCart({ isKiosk: true, applePay: { available: true, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });

    it("hides the button for admin and kiosk even when available", () => {
        renderCart({ isAdmin: true, applePay: { available: true, busy: false, start: jest.fn() } });

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });
});
