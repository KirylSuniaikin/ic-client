import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

// The page renders its copy via useTranslation; initialize the real i18n instance.
import i18n from "../../../shared/i18n";

import { CheckoutPaymentPage } from "./CheckoutPaymentPage";
import type { CheckoutPaymentPageProps } from "./CheckoutPaymentPage";
import type { CartItem, MenuItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";

// The payment page (owner, 19 Oct 2026): after the cart and a guest's sign-in, every method this
// customer can use, and one button that pays with the chosen one.

const WATER: CartItem = {
    id: 1, name: "Water", size: "M", category: "Beverages", isThinDough: false, isGarlicCrust: false,
    extraIngredients: [], toppings: [], note: "", quantity: 2, description: "", amount: 1.25,
    discountAmount: 0, comboItems: null, photo: "",
};
const WATER_MENU = { name: "Water", name_ar: "ماء" } as MenuItem;

const ALL_METHODS = ["Card", "Apple Pay", "Benefit", "BenefitPay", "At counter"];

type PickupPayment = Extract<CheckoutPaymentPageProps["payment"], { kind: "pickup" }>;

/** Built per test: CRA's resetMocks would clear a module-level mock's implementation. */
function checkoutMethod(available = true, busy = false) {
    return { available, busy, start: jest.fn<void, []>() };
}

function renderPage(overrides: Partial<CheckoutPaymentPageProps> = {}, payment: Partial<PickupPayment> = {}) {
    const onBack = jest.fn<void, []>();
    const onPayWithTender = jest.fn<void, [string]>();
    const pickup: PickupPayment = { kind: "pickup", onPayWithTender, ...payment };
    const props: CheckoutPaymentPageProps = {
        open: true,
        onBack,
        items: [WATER],
        menuData: [WATER_MENU],
        total: "2.50",
        fulfilment: { title: "Pick up from", name: "Al-Hidd", detail: "Road 114 Block 101" },
        busy: false,
        payment: pickup,
        ...overrides,
    };
    const view = render(<CheckoutPaymentPage {...props} />);
    return { ...view, onBack, onPayWithTender };
}

function methodNames(): string[] {
    return screen.getAllByRole("radio").map((radio) => radio.textContent ?? "");
}

function pick(name: string): void {
    fireEvent.click(screen.getByRole("radio", { name }));
}

afterEach(() => {
    clearMatchMedia();
});

describe("CheckoutPaymentPage — a pickup order", () => {
    it("lists every method by Talabat popularity, the counter last, with none chosen", () => {
        renderPage({}, { applePay: checkoutMethod(), cardPayment: checkoutMethod() });

        expect(methodNames()).toEqual(ALL_METHODS);
        screen.getAllByRole("radio").forEach((radio) => expect(radio.getAttribute("aria-checked")).toBe("false"));
    });

    it("leaves out card and Apple Pay when this customer cannot use them", () => {
        renderPage({}, { applePay: checkoutMethod(false), cardPayment: checkoutMethod(false) });

        expect(methodNames()).toEqual(["Benefit", "BenefitPay", "At counter"]);
    });

    it("says where the order is collected from, and carries the new-methods bubble", () => {
        renderPage();

        const fulfilment = screen.getByTestId("payment-fulfilment");
        expect(screen.getByText("Pick up from")).toBeTruthy();
        expect(within(fulfilment).getByText("Al-Hidd")).toBeTruthy();
        expect(within(fulfilment).getByText("Road 114 Block 101")).toBeTruthy();
        expect(screen.getByTestId("payment-invite-bubble").textContent).toContain("Hey, we added new payment methods");
    });

    it("keeps the pay button off until a method is chosen", () => {
        const { onPayWithTender } = renderPage();

        const button = screen.getByRole("button", { name: "Choose how to pay" });
        expect(button.hasAttribute("disabled")).toBe(true);
        fireEvent.click(button);
        expect(onPayWithTender).not.toHaveBeenCalled();
    });

    it.each([
        ["Benefit", PAY_ONLINE_METHOD],
        ["BenefitPay", WALLET_METHOD],
    ])("pays %s with its tender, the amount on the button", (name, tender) => {
        const { onPayWithTender } = renderPage();

        pick(name);
        fireEvent.click(screen.getByRole("button", { name: "Pay 2.50 BHD" }));

        expect(onPayWithTender).toHaveBeenCalledWith(tender);
    });

    it("places a pay-at-the-counter order with the counter tender", () => {
        const { onPayWithTender } = renderPage();

        pick("At counter");
        fireEvent.click(screen.getByRole("button", { name: "Place order" }));

        expect(onPayWithTender).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
    });

    it("opens the card form for Card, with no tender", () => {
        const cardPayment = checkoutMethod();
        const { onPayWithTender } = renderPage({}, { cardPayment });

        pick("Card");
        fireEvent.click(screen.getByRole("button", { name: "Pay 2.50 BHD" }));

        expect(cardPayment.start).toHaveBeenCalledTimes(1);
        expect(onPayWithTender).not.toHaveBeenCalled();
    });

    it("swaps in Apple's own button for Apple Pay and opens its sheet in the same tap", () => {
        const applePay = checkoutMethod();
        const { onPayWithTender } = renderPage({}, { applePay });

        pick("Apple Pay");
        expect(screen.queryByRole("button", { name: /^Pay 2.50/ })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

        expect(applePay.start).toHaveBeenCalledTimes(1);
        expect(onPayWithTender).not.toHaveBeenCalled();
    });

    it("holds Apple's button while its checkout is busy", () => {
        renderPage({}, { applePay: checkoutMethod(true, true) });

        pick("Apple Pay");

        expect(screen.getByRole("button", { name: "Pay with Apple Pay" }).hasAttribute("disabled")).toBe(true);
    });

    it("holds the pay button while the order is being placed", () => {
        renderPage({ busy: true });

        pick("BenefitPay");

        expect(screen.getByRole("button", { name: "Pay 2.50 BHD" }).hasAttribute("disabled")).toBe(true);
    });

    // Sign-out or a refused eligibility check takes card away after it was picked.
    it("goes back to nothing chosen when a picked card stops being available", () => {
        const pickup: PickupPayment = { kind: "pickup", onPayWithTender: jest.fn(), cardPayment: checkoutMethod() };
        const { rerender } = renderPage({ payment: pickup });
        pick("Card");

        rerender(
            <CheckoutPaymentPage
                open onBack={jest.fn()} items={[WATER]} menuData={[]} total="2.50"
                fulfilment={{ title: "Pick up from", name: "Al-Hidd", detail: "" }} busy={false}
                payment={{ ...pickup, cardPayment: checkoutMethod(false) }}
            />
        );

        expect(screen.getByRole("button", { name: "Choose how to pay" })).toBeTruthy();
    });

    it("goes back with the header's Back button on the phone", () => {
        const { onBack } = renderPage();

        fireEvent.click(screen.getByRole("button", { name: "Back" }));

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("speaks Arabic to an Arabic customer", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = renderPage();

            expect(screen.getByText("الدفع")).toBeTruthy();
            pick("بنفت");
            expect(screen.getByRole("button", { name: "ادفع 2.50 د.ب" })).toBeTruthy();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});

describe("CheckoutPaymentPage — a delivery order", () => {
    function openDeliveryPage() {
        const onPayDelivery = jest.fn<void, [string]>();
        renderPage({
            fulfilment: { title: "Deliver to", name: "Home", detail: "Block 101, Road 114" },
            payment: { kind: "delivery", onPayDelivery },
        });
        return onPayDelivery;
    }

    // EazyPay's hosted page runs card and Apple Pay itself, so they do not depend on ours.
    it("lists what EazyPay's hosted page takes: card, Apple Pay and Benefit", () => {
        openDeliveryPage();

        expect(methodNames()).toEqual(["Card", "Apple Pay", "Benefit"]);
        expect(screen.getByText("Deliver to")).toBeTruthy();
        expect(screen.getByText("Home")).toBeTruthy();
    });

    it.each([
        ["Card", "CARD"],
        ["Benefit", "BENEFIT"],
    ])("pays %s on the hosted page as %s", (name, method) => {
        const onPayDelivery = openDeliveryPage();

        pick(name);
        fireEvent.click(screen.getByRole("button", { name: "Pay 2.50 BHD" }));

        expect(onPayDelivery).toHaveBeenCalledWith(method);
    });

    it("pays Apple Pay on the hosted page too", () => {
        const onPayDelivery = openDeliveryPage();

        pick("Apple Pay");
        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

        expect(onPayDelivery).toHaveBeenCalledWith("APPLE_PAY");
    });
});

describe("CheckoutPaymentPage — on PC", () => {
    it("is the cart's two-column dialog: the order on the warm side, the methods beside it", () => {
        stubMatchMedia(true);
        renderPage();

        const aside = screen.getByTestId("item-popup-aside");
        expect(within(aside).getByText("Your order")).toBeTruthy();
        expect(within(aside).getByText("2 × Water")).toBeTruthy();
        expect(within(aside).getByText("2.50")).toBeTruthy();
        expect(aside.contains(screen.getByRole("radiogroup", { name: "Payment method" }))).toBe(false);
        expect(screen.getByText("Payment")).toBeTruthy();
        expect(screen.getByText("Total(VAT incl.)")).toBeTruthy();
    });

    it("names the items in Arabic for an Arabic customer", async () => {
        stubMatchMedia(true);
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = renderPage();

            expect(within(screen.getByTestId("item-popup-aside")).getByText("2 × ماء")).toBeTruthy();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("goes back with the round close button", () => {
        stubMatchMedia(true);
        const { onBack } = renderPage();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
