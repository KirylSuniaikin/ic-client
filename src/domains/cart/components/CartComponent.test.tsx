import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// CartPopup renders its copy via useTranslation, so initialize the real i18n instance the
// same way app/providers.tsx does.
import "../../../shared/i18n";

import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD } from "../../order/types";

function makeCartItem(): CartItem {
    return {
        id: 1,
        name: "Water",
        size: "M",
        category: "Beverages",
        isThinDough: false,
        isGarlicCrust: false,
        extraIngredients: [],
        toppings: [],
        note: "",
        quantity: 1,
        description: "",
        amount: 2.5,
        discountAmount: 0,
        comboItems: null,
        photo: "",
    };
}

const ITEMS: CartItem[] = [makeCartItem()];

function renderCart(overrides: Partial<React.ComponentProps<typeof CartPopup>> = {}) {
    const props: React.ComponentProps<typeof CartPopup> = {
        open: true,
        onClose: jest.fn<void, []>(),
        items: ITEMS,
        onChangeQuantity: jest.fn(),
        onChangeSize: jest.fn(),
        onRemoveItem: jest.fn(),
        onCheckout: jest.fn(),
        openPizzaEditPopUp: jest.fn(),
        openPizzaComboEditPopup: jest.fn(),
        openDetroitComboEditPopup: jest.fn(),
        isAdmin: false,
        handleDiscountChange: jest.fn(),
        menuData: [],
        paymentMethod: DEFAULT_PAYMENT_METHOD,
        onPaymentChange: jest.fn<void, [string]>(),
        orderType: "Pick Up",
        onDeliveryTypeChange: jest.fn<void, [string]>(),
        isKiosk: false,
        ...overrides,
    };
    render(<CartPopup {...props} />);
    return props;
}

describe("CartPopup — payment toggle", () => {
    it("renders the payment options and preselects the passed method (customer)", () => {
        renderCart();

        expect(screen.getByRole("button", { name: "Cash" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Benefit" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Card" }).getAttribute("aria-pressed")).toBe("true");
    });

    it("calls onPaymentChange with the canonical value when a method is selected", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange });

        fireEvent.click(screen.getByRole("button", { name: "Cash" }));

        expect(onPaymentChange).toHaveBeenCalledWith("Cash");
    });

    it("hides the payment toggle for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByRole("button", { name: "Card" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Cash" })).toBeNull();
    });
});

describe("CartPopup — delivery-type toggle", () => {
    it("renders Pickup and a disabled Delivery option for customers", () => {
        renderCart();

        expect(screen.getByRole("button", { name: /pickup/i })).toBeTruthy();
        expect(screen.getByRole("button", { name: /delivery/i }).hasAttribute("disabled")).toBe(true);
    });

    it("hides the delivery-type toggle on kiosk (always Pickup)", () => {
        renderCart({ isKiosk: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
        // Payment toggle still shows on kiosk.
        expect(screen.getByRole("button", { name: "Card" })).toBeTruthy();
    });

    it("hides the delivery-type toggle for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
    });
});

describe("CartPopup — checkout", () => {
    // The cart supplies the real delivery type + payment method and infoCollected=false so the
    // checkout hook still gates guests/logged-in-without-name into ClientInfoPopup.
    it("passes order type, payment method and infoCollected=false to onCheckout", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", DEFAULT_PAYMENT_METHOD, "", null, false);
    });
});
