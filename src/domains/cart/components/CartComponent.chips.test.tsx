import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// CartPopup renders its copy via useTranslation; initialize the real i18n instance.
import "../../../shared/i18n";

import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

// The payment methods as one row of pill chips (option B): one line on the phone, wrapping on PC.

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

const CHIP_NAMES = ["At counter", "Benefit", "BenefitPay", "Apple Pay", "Card"];

/** The chip row is the ToggleButtonGroup every chip sits in directly. */
function chipRow(): HTMLElement {
    const row = screen.getByRole("button", { name: "Benefit" }).parentElement;
    if (row === null) throw new Error("the Benefit chip has no row");
    return row;
}

/**
 * The declarations of the row's selected-chip rule. emotionRulesFor flattens every rule onto one
 * line, so they are split back apart on their closing braces; MUI's own `selected + selected`
 * group rule is skipped.
 */
function selectedChipDeclarations(): string {
    const rule = emotionRulesFor(chipRow())
        .split("}")
        .map((text) => text.split("{"))
        .find(([selector]) => selector.includes(".MuiToggleButtonGroup-grouped.Mui-selected") && !selector.includes("+"));
    if (rule === undefined || rule[1] === undefined) throw new Error("no selected-chip rule on the row");
    return rule[1];
}

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    clearMatchMedia();
});

describe("CartPopup — payment chips row on the phone", () => {
    it("renders every available method as a chip of one horizontal group, in order", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        const chips = CHIP_NAMES.map((name) => screen.getByRole("button", { name }));
        const row = chipRow();
        chips.forEach((chip) => expect(chip.parentElement).toBe(row));
        expect(row.getAttribute("role")).toBe("group");
        expect(row.className).toContain("MuiToggleButtonGroup-horizontal");
        expect(row.className).not.toContain("MuiToggleButtonGroup-vertical");
        for (let i = 1; i < chips.length; i++) {
            expect(chips[i - 1].compareDocumentPosition(chips[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }
    });

    it("drops the radio marks of the old vertical list", () => {
        renderCart();

        expect(screen.queryByTestId("RadioButtonCheckedRoundedIcon")).toBeNull();
        expect(screen.queryByTestId("RadioButtonUncheckedRoundedIcon")).toBeNull();
    });

    it("scrolls sideways under a hidden scrollbar instead of wrapping, so it stays one line high", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        const rules = emotionRulesFor(chipRow());
        expect(rules).toContain("display:flex");
        expect(rules).toContain("overflow-x:auto");
        expect(rules).toContain("flex-wrap:nowrap");
        expect(rules).not.toContain("flex-wrap:wrap");
        expect(rules).toContain("scrollbar-width:none");
        expect(rules).toContain("scroll-snap-type:x proximity");
        // A chip that could shrink would squeeze its label instead of scrolling.
        expect(rules).toContain("flex-shrink:0");
    });

    it("draws an unselected chip as a gray pill and the selected one white with a red border and text", () => {
        renderCart({ paymentMethod: WALLET_METHOD });

        const selected = screen.getByRole("button", { name: "BenefitPay" });
        const other = screen.getByRole("button", { name: "Benefit" });
        expect(selected.getAttribute("aria-pressed")).toBe("true");
        expect(selected.className).toContain("Mui-selected");
        expect(other.getAttribute("aria-pressed")).toBe("false");
        expect(other.className).not.toContain("Mui-selected");

        const rules = emotionRulesFor(chipRow());
        expect(rules).toContain("border:1.5px solid transparent");
        expect(rules).toContain("background-color:#f3f3f3");

        const rule = selectedChipDeclarations();
        expect(rule).toContain("background-color:#fff");
        expect(rule).toContain("border-color:#E44B4C");
        expect(rule).toContain("color:#E44B4C");
    });

    it("moves the selection to the chip the customer taps", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, paymentMethod: PAY_ONLINE_METHOD });

        fireEvent.click(screen.getByRole("button", { name: "At counter" }));

        expect(onPaymentChange).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
    });

    it("keeps exactly one pay button below the total", () => {
        renderCart({ applePay: available(), cardPayment: available() });

        expect(screen.getAllByRole("button", { name: /checkout|pay with apple pay/i })).toHaveLength(1);
    });
});

describe("CartPopup — Apple Pay chip", () => {
    it("swaps Checkout for Apple's button and opens the session inside the same tap, after remembering it", () => {
        let dispatching = false;
        let startedDuringTap = false;
        let rememberedAtStart: string | null = null;
        const start = jest.fn<void, []>(() => {
            startedDuringTap = dispatching;
            rememberedAtStart = window.localStorage.getItem("ic.preferredPaymentMethod");
        });
        const { onCheckout } = renderCart({ applePay: available(start) });

        fireEvent.click(screen.getByRole("button", { name: "Apple Pay" }));
        expect(screen.getByRole("button", { name: "Apple Pay" }).getAttribute("aria-pressed")).toBe("true");
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

    it("goes back to the red Checkout when another chip is chosen", () => {
        renderCart({ applePay: available() });

        fireEvent.click(screen.getByRole("button", { name: "Apple Pay" }));
        fireEvent.click(screen.getByRole("button", { name: "Benefit" }));

        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
    });
});

describe("CartPopup — no chips outside customer pickup", () => {
    it("shows no chips and no payment label for a Delivery order, only Checkout with its tender", () => {
        const { onCheckout } = renderCart({
            orderType: "Delivery", paymentMethod: WALLET_METHOD, applePay: available(), cardPayment: available(),
        });

        CHIP_NAMES.forEach((name) => expect(screen.queryByRole("button", { name })).toBeNull());
        expect(screen.queryByText("Payment method")).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Delivery", WALLET_METHOD, "", null, false);
    });

    it.each([
        ["admin", { isAdmin: true }],
        ["kiosk", { isKiosk: true }],
    ])("shows no chips for %s", (_label, overrides) => {
        renderCart({ ...overrides, applePay: available(), cardPayment: available() });

        CHIP_NAMES.forEach((name) => expect(screen.queryByRole("button", { name })).toBeNull());
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });
});

describe("CartPopup — payment chips row on PC", () => {
    // A mouse cannot drag a strip whose scrollbar is hidden, so on PC the chips wrap instead.
    it("wraps the chips instead of scrolling them", () => {
        stubMatchMedia(true);
        renderCart({ applePay: available(), cardPayment: available() });

        const rules = emotionRulesFor(chipRow());
        expect(rules).toContain("flex-wrap:wrap");
        expect(rules).not.toContain("flex-wrap:nowrap");
        expect(rules).not.toContain("overflow-x:auto");
    });

    it("keeps the same chip styles on PC", () => {
        stubMatchMedia(true);
        renderCart({ paymentMethod: WALLET_METHOD });

        const rule = selectedChipDeclarations();
        expect(rule).toContain("background-color:#fff");
        expect(rule).toContain("border-color:#E44B4C");
    });
});
