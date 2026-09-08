import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// CartPopup renders its copy via useTranslation, so initialize the real i18n instance the
// same way app/providers.tsx does.
import "../../../shared/i18n";

import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";

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
        renderCart({ paymentMethod: PAY_ONLINE_METHOD });

        expect(screen.getByRole("button", { name: "Benefit (Online)" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "BenefitPay" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Benefit (Online)" }).getAttribute("aria-pressed")).toBe("true");
    });

    // Customer orders are paid before they reach the kitchen, so there is no pay-at-counter
    // choice. The tender string still exists for the kiosk — only the option was removed.
    it("does not offer paying at the counter", () => {
        renderCart();

        expect(screen.queryByRole("button", { name: "At counter" })).toBeNull();
    });

    it("calls onPaymentChange with the canonical value when a method is selected", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, paymentMethod: WALLET_METHOD });

        fireEvent.click(screen.getByRole("button", { name: "Benefit (Online)" }));

        expect(onPaymentChange).toHaveBeenCalledWith(PAY_ONLINE_METHOD);
    });

    it("offers the wallet as its own method, distinct from the hosted card page", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange });

        fireEvent.click(screen.getByRole("button", { name: "BenefitPay" }));

        expect(onPaymentChange).toHaveBeenCalledWith(WALLET_METHOD);
    });

    it("hides the payment toggle for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByRole("button", { name: "Benefit (Online)" })).toBeNull();
        expect(screen.queryByRole("button", { name: "BenefitPay" })).toBeNull();
    });
});

describe("CartPopup — delivery-type toggle", () => {
    // Delivery is selectable: HomePageModals' onDeliveryTypeChange runs the availability gate and
    // falls back to Keeta, so the cart must not pre-empt that decision by disabling the option.
    it("renders Pickup and a selectable Delivery option for customers", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        const delivery = screen.getByRole("button", { name: /delivery/i });
        expect(screen.getByRole("button", { name: /pickup/i })).toBeTruthy();
        expect(delivery.hasAttribute("disabled")).toBe(false);
        // The absence of the attribute is not the same as the option being operable: MUI can mark
        // a ToggleButton unusable through its own class alone, and the "coming soon" state this
        // replaced was exactly that shape. Press it and see that the choice actually leaves.
        expect(delivery.className).not.toMatch(/Mui-disabled/);
        fireEvent.click(delivery);
        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Delivery");
    });

    /** The retired sub-label. `cart.comingSoon` was removed with the option's disabled state. */
    it("no longer promises delivery is coming soon", () => {
        renderCart();

        expect(screen.queryByText(/coming soon/i)).toBeNull();
    });

    it("reports a Delivery choice to the caller", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        fireEvent.click(screen.getByRole("button", { name: /delivery/i }));

        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Delivery");
    });

    // Delivery is paid online in DeliveryCheckoutDrawer, which asks for the method itself.
    // A visible group here would let a customer pick Cash and then be charged by card.
    it("hides the payment-method toggle when Delivery is selected", () => {
        renderCart({ orderType: "Delivery" });

        expect(screen.getByRole("button", { name: /delivery/i })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Benefit (Online)" })).toBeNull();
        expect(screen.queryByRole("button", { name: "BenefitPay" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Benefit (Online)" })).toBeNull();
    });

    it("hides both the delivery-type and payment-method toggles on kiosk (always Pickup + Card)", () => {
        renderCart({ isKiosk: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
        expect(screen.queryByRole("button", { name: "Benefit (Online)" })).toBeNull();
        expect(screen.queryByRole("button", { name: "BenefitPay" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Benefit (Online)" })).toBeNull();
        expect(screen.queryByText(/payment method/i)).toBeNull();
    });

    it("hides the delivery-type toggle for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
    });

    it("leaves the rest of the cart chrome intact on kiosk — items, total and Checkout button still render", () => {
        renderCart({ isKiosk: true });

        expect(screen.getByText("Water")).toBeTruthy();
        expect(screen.getByText(/total/i)).toBeTruthy();
        expect(screen.getAllByText("2.50").length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: /checkout/i })).toBeTruthy();
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
