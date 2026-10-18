import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// CartPopup renders its copy via useTranslation; initialize the real i18n instance.
import "../../../shared/i18n";

import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import {
    PAYMENT_ROW_NAME, cartModalRoot, choosePayment, hasSheetRoot, layerOf, listedPaymentMethods, paymentRow,
    paymentRowName, sheetRoot,
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

function renderCart(overrides: Partial<CartProps> = {}): CartProps {
    const props: CartProps = {
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
    render(<CartPopup {...props} />);
    return props;
}

/** Built per test: CRA's resetMocks would clear a module-level mock's implementation. */
function available(start = jest.fn<void, []>()) {
    return { available: true, busy: false, start };
}

const ALL_METHODS = ["At counter", "Benefit", "BenefitPay", "Apple Pay", "Card"];

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    clearMatchMedia();
});

describe("CartPopup — payment row on the phone", () => {
    it("shows one row naming the selected method instead of a control per method", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        expect(paymentRow()).toBeTruthy();
        ALL_METHODS.forEach((name) => expect(screen.queryByRole("button", { name })).toBeNull());
        expect(screen.queryByRole("radio")).toBeNull();
    });

    it("lists every available method in its sheet, in order", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        expect(listedPaymentMethods()).toEqual(ALL_METHODS);
    });

    it("lists only the counter and the two BENEFIT methods when nothing else is available", () => {
        renderCart();

        expect(listedPaymentMethods()).toEqual(["At counter", "Benefit", "BenefitPay"]);
    });

    it("opens on the method it was handed, checked in the sheet", () => {
        renderCart({ paymentMethod: WALLET_METHOD });

        expect(paymentRow().getAttribute("aria-label")).toBe(paymentRowName("BenefitPay"));
        fireEvent.click(paymentRow());
        expect(screen.getByRole("radio", { name: "BenefitPay" }).getAttribute("aria-checked")).toBe("true");
        expect(screen.getByRole("radio", { name: "Benefit" }).getAttribute("aria-checked")).toBe("false");
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
    it("swaps Checkout for Apple's button and opens the session inside the same tap, after remembering it", async () => {
        let dispatching = false;
        let startedDuringTap = false;
        let rememberedAtStart: string | null = null;
        const start = jest.fn<void, []>(() => {
            startedDuringTap = dispatching;
            rememberedAtStart = window.localStorage.getItem("ic.preferredPaymentMethod");
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
        expect(rememberedAtStart).toBe("applePay");
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
