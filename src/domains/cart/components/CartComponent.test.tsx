import { jest, describe, it, expect, afterEach, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// CartPopup renders its copy via useTranslation, so initialize the real i18n instance the
// same way app/providers.tsx does.
import i18n from "../../../shared/i18n";

import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD } from "../../order/types";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import { wrapperOf } from "./cartLayout.testutil";

// Read through a getter so each describe can open or close delivery for its own tests.
let mockDeliveryComingSoon = false;
jest.mock("../../delivery/constants", () => ({
    KEETA_DEEP_LINK: "https://keeta.example/fallback",
    get DELIVERY_COMING_SOON() {
        return mockDeliveryComingSoon;
    },
}));

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

function cartProps(overrides: Partial<React.ComponentProps<typeof CartPopup>> = {}): React.ComponentProps<typeof CartPopup> {
    return {
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
        orderType: "Pick Up",
        onDeliveryTypeChange: jest.fn<void, [string]>(),
        isKiosk: false,
        ...overrides,
    };
}

function renderCart(overrides: Partial<React.ComponentProps<typeof CartPopup>> = {}) {
    const props = cartProps(overrides);
    render(<CartPopup {...props} />);
    return props;
}

// Owner, 19 Oct 2026: the cart asks only pickup or delivery; the methods are on the payment page
// that follows it (PaymentPage.test.tsx).
describe("CartPopup — no payment choice in the cart", () => {
    it("shows a customer no payment methods, only Checkout", () => {
        renderCart({ paymentMethod: PAY_ONLINE_METHOD });

        expect(screen.queryByText("Payment method")).toBeNull();
        expect(screen.queryByRole("radio")).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        expect(screen.queryByTestId("payment-invite-bubble")).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout · 2.50 BHD" })).toBeTruthy();
    });

    it("shows an Arabic customer no payment section either", async () => {
        await i18n.changeLanguage("ar");
        try {
            renderCart({ paymentMethod: DEFAULT_PAYMENT_METHOD });

            expect(screen.queryByText("طريقة الدفع")).toBeNull();
            expect(screen.queryByRole("radio")).toBeNull();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("shows no payment section for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByText("Payment method")).toBeNull();
    });
});

describe("CartPopup — delivery coming soon", () => {
    beforeEach(() => {
        mockDeliveryComingSoon = true;
    });
    afterEach(() => {
        mockDeliveryComingSoon = false;
    });

    it("greys Delivery out under a Coming soon label", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        const delivery = screen.getByRole("button", { name: /delivery/i });
        expect(delivery.hasAttribute("disabled")).toBe(true);
        expect(delivery.textContent).toBe("DeliveryComing soon");
        fireEvent.click(delivery);
        expect(onDeliveryTypeChange).not.toHaveBeenCalled();
    });

    it("blinks the label, except for customers who turned motion off", () => {
        renderCart();

        const label = screen.getByText("Coming soon");
        const rules = emotionRulesFor(label);
        expect(rules).toContain("animation:deliveryComingSoonBlink 1.4s ease-in-out infinite");
        expect(rules).toMatch(/@media \(prefers-reduced-motion:reduce\) \{[^}]*\banimation:none/);
    });

    it("keeps Pickup selectable", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ orderType: "Delivery", onDeliveryTypeChange });

        fireEvent.click(screen.getByRole("button", { name: /pickup/i }));

        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Pick Up");
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

    /** Once delivery opens, the Coming soon label goes with the disabled state. */
    it("does not promise delivery is coming soon once it is open", () => {
        renderCart();

        expect(screen.queryByText(/coming soon/i)).toBeNull();
    });

    it("reports a Delivery choice to the caller", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        fireEvent.click(screen.getByRole("button", { name: /delivery/i }));

        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Delivery");
    });

    it("shows no payment section when Delivery is selected either", () => {
        renderCart({ orderType: "Delivery" });

        expect(screen.getByRole("button", { name: /delivery/i })).toBeTruthy();
        expect(screen.queryByText("Payment method")).toBeNull();
    });

    it("hides the delivery-type toggle on kiosk (always Pickup), with no payment section", () => {
        renderCart({ isKiosk: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
        expect(screen.queryByText(/payment method/i)).toBeNull();
    });

    it("hides the delivery-type toggle for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
    });

    it("leaves the rest of the cart chrome intact on kiosk — items and the Checkout button with the total still render", () => {
        renderCart({ isKiosk: true });

        expect(screen.getByText("Water")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Checkout · 2.50 BHD" })).toBeTruthy();
    });
});

// Owner, 19 Oct 2026: the total line over the button is gone and the total rides on the button
// itself, so the items get that room; the button is as tall as Apple's on the payment page.
describe("CartPopup — the total on the Checkout button", () => {
    it("names the total on the button, with no total line above it", () => {
        renderCart();

        expect(screen.getByRole("button", { name: "Checkout · 2.50 BHD" })).toBeTruthy();
        expect(screen.queryByText("Total(VAT incl.)")).toBeNull();
    });

    it("adds up quantities and discounts into the total it names", () => {
        renderCart({ items: [{ ...makeCartItem(), quantity: 3, discountAmount: 20 }] });

        expect(screen.getByRole("button", { name: "Checkout · 6.00 BHD" })).toBeTruthy();
    });

    it("says it in Arabic to an Arabic customer", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = render(<CartPopup {...cartProps()} />);

            expect(screen.getByRole("button", { name: "إتمام الطلب · 2.50 د.ب" })).toBeTruthy();
            expect(screen.queryByText("الإجمالي (شامل الضريبة)")).toBeNull();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("is the payment page's 48px button with 16px corners, 24px in from each side", () => {
        renderCart();

        const button = screen.getByRole("button", { name: "Checkout · 2.50 BHD" });
        const rules = emotionRulesFor(button);
        expect(rules).toContain("height:48px");
        expect(rules).toContain("border-radius:16px");
        const slot = emotionRulesFor(wrapperOf(button));
        expect(slot).toContain("padding-left:24px");
        expect(slot).toContain("padding-right:24px");
    });
});

describe("CartPopup — checkout", () => {
    // infoCollected=false: the checkout hook takes a customer on to sign-in and the payment page,
    // where the method is chosen, so the tender sent here is only the one the cart was handed.
    it("passes the order type and infoCollected=false to onCheckout", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, paymentMethod: PAY_ONLINE_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", PAY_ONLINE_METHOD, "", null, false);
    });

    it("checks a Delivery order out the same way", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, orderType: "Delivery", paymentMethod: PAY_ONLINE_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Delivery", PAY_ONLINE_METHOD, "", null, false);
    });

    it("keeps sending the kiosk its own tender — kiosk never chooses", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, isKiosk: true, paymentMethod: DEFAULT_PAYMENT_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", DEFAULT_PAYMENT_METHOD, "", null, false);
    });
});

/**
 * What HomePageModals handed the cart before the card moved: the branch, and the handler without
 * which the old cart hid the card. Spread in untyped, since CartPopup no longer declares them, so
 * these tests fail against the old cart instead of passing for want of a handler.
 */
function oldBranchProps(): Record<string, unknown> {
    return {
        pickupBranch: {
            id: "b-1", externalId: "ext-1", branchNo: 1, branchName: "Grunwald", branchNameAr: "جرونوالد",
            locale: "en", latitude: null, longitude: null, address: "Náměstí 14. října, Praha 5",
        },
        onChangeBranch: jest.fn<void, []>(),
    };
}

// Owner, 19 Oct 2026: the branch picker moved out of the cart to give the items its room. The cart
// keeps the items and the delivery-type picker; the payment page's card changes the pickup branch.
describe("CartPopup — no pick-up branch card", () => {
    it("shows the items and the delivery-type picker, and no 'Pick up from' card", () => {
        render(<CartPopup {...cartProps()} {...oldBranchProps()} />);

        expect(screen.getByText("Water")).toBeTruthy();
        expect(screen.getByText("Delivery type")).toBeTruthy();
        expect(screen.getByRole("button", { name: /pickup/i })).toBeTruthy();
        expect(screen.queryByText("Pick up from")).toBeNull();
        expect(screen.queryByRole("button", { name: /^Pick up from/ })).toBeNull();
        expect(screen.queryByText("Grunwald")).toBeNull();
    });

    it("shows no 'Pick up from' card to an Arabic customer either", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = render(<CartPopup {...cartProps()} {...oldBranchProps()} />);

            expect(screen.queryByText("الاستلام من")).toBeNull();
            expect(screen.queryByText("جرونوالد")).toBeNull();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
