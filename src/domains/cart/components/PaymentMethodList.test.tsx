import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// The list renders its labels via useTranslation; initialize the real i18n instance.
import i18n from "../../../shared/i18n";

import { PaymentMethodList } from "./PaymentMethodList";
import { APPLE_PAY_CHOICE, CARD_CHOICE } from "../hooks/usePaymentChoice";
import type { PaymentChoice } from "../hooks/usePaymentChoice";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import { focusedElement, paymentLogo, paymentMarkOf } from "./cartLayout.testutil";

// The payment page's methods (owner, 19 Oct 2026): every one as a radio in a single list.

// usePaymentChoice's display order; the list shows whatever order it is handed.
const ALL_CHOICES: PaymentChoice[] = [CARD_CHOICE, APPLE_PAY_CHOICE, PAY_ONLINE_METHOD, WALLET_METHOD, DEFAULT_PAYMENT_METHOD];
const ALL_NAMES = ["Card", "Apple Pay", "Benefit", "BenefitPay", "At counter"];

type ListProps = React.ComponentProps<typeof PaymentMethodList>;

function renderList(overrides: Partial<ListProps> = {}, theme = createTheme()) {
    const onSelect = jest.fn<void, [PaymentChoice]>();
    const props: ListProps = { choices: ALL_CHOICES, selected: null, onSelect, labelledBy: "methods-title", ...overrides };
    const view = render(
        <ThemeProvider theme={theme}>
            <h2 id="methods-title">Payment method</h2>
            <PaymentMethodList {...props} />
        </ThemeProvider>
    );
    return { ...view, onSelect };
}

function radio(name: string): HTMLElement {
    return screen.getByRole("radio", { name });
}

describe("PaymentMethodList — the list", () => {
    it("lists every method as a radio in the order handed, named by the heading", () => {
        renderList({ selected: WALLET_METHOD });

        expect(screen.getByRole("radiogroup", { name: "Payment method" })).toBeTruthy();
        const radios = screen.getAllByRole("radio");
        expect(radios.map((r) => r.textContent)).toEqual(ALL_NAMES);
        expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "false", "false", "true", "false"]);
    });

    it("checks nothing until the customer picks", () => {
        renderList();

        screen.getAllByRole("radio").forEach((r) => expect(r.getAttribute("aria-checked")).toBe("false"));
    });

    it("reports the picked method", () => {
        const { onSelect } = renderList();

        fireEvent.click(radio("At counter"));

        expect(onSelect).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
    });

    it("gives every option a touch target of at least 44px, and a visible focus ring", () => {
        renderList();

        const rules = emotionRulesFor(radio("Card"));
        expect(rules).toContain("min-height:52px");
        expect(rules).toMatch(/\.Mui-focusVisible \{[^}]*outline:2px solid #E44B4C/);
    });

    it("names the methods in Arabic for an Arabic customer", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = renderList({ choices: [DEFAULT_PAYMENT_METHOD] });

            expect(radio("الدفع عند الاستلام")).toBeTruthy();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});

describe("PaymentMethodList — marks", () => {
    it("shows both BENEFIT lockups and the card glyph, as decoration, and nothing for the others", () => {
        renderList();

        expect(paymentMarkOf(radio("Benefit"))).toBe("/benefit-logo.png");
        expect(paymentMarkOf(radio("BenefitPay"))).toBe("/benefitpay-logo.png");
        expect(paymentMarkOf(radio("Card"))).toBe("card");
        expect(paymentMarkOf(radio("Apple Pay"))).toBeNull();
        expect(paymentMarkOf(radio("At counter"))).toBeNull();
        const logo = paymentLogo("/benefit-logo.png");
        expect(logo.getAttribute("alt")).toBe("");
        expect(logo.getAttribute("aria-hidden")).toBe("true");
    });

    it("hides a lockup that fails to load and keeps the label", () => {
        renderList();

        const logo = paymentLogo("/benefitpay-logo.png");
        expect(logo.style.display).toBe("");
        fireEvent.error(logo);

        expect(logo.style.display).toBe("none");
        expect(radio("BenefitPay").textContent).toBe("BenefitPay");
    });
});

describe("PaymentMethodList — keyboard", () => {
    it("keeps one tab stop, on the chosen method", () => {
        renderList({ selected: WALLET_METHOD });

        expect(screen.getAllByRole("radio").map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "-1", "-1", "0", "-1"]);
    });

    it("puts the tab stop on the first method while nothing is chosen", () => {
        renderList();

        expect(screen.getAllByRole("radio").map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
    });

    it("moves focus with the arrow keys, wrapping, without choosing", () => {
        const { onSelect } = renderList({ selected: WALLET_METHOD });
        act(() => radio("BenefitPay").focus());

        fireEvent.keyDown(focusedElement(), { key: "ArrowDown" });
        expect(focusedElement()).toBe(radio("At counter"));
        fireEvent.keyDown(focusedElement(), { key: "ArrowDown" });
        expect(focusedElement()).toBe(radio("Card"));
        fireEvent.keyDown(focusedElement(), { key: "ArrowUp" });
        expect(focusedElement()).toBe(radio("At counter"));
        fireEvent.keyDown(focusedElement(), { key: "Home" });
        expect(focusedElement()).toBe(radio("Card"));
        fireEvent.keyDown(focusedElement(), { key: "End" });
        expect(focusedElement()).toBe(radio("At counter"));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it("follows the reading direction for Left and Right", () => {
        renderList({ selected: PAY_ONLINE_METHOD }, createTheme({ direction: "rtl" }));
        act(() => radio("Benefit").focus());

        fireEvent.keyDown(focusedElement(), { key: "ArrowLeft" });
        expect(focusedElement()).toBe(radio("BenefitPay"));
        fireEvent.keyDown(focusedElement(), { key: "ArrowRight" });
        expect(focusedElement()).toBe(radio("Benefit"));
    });

    it("picks the focused method with the button's own activation", () => {
        const { onSelect } = renderList({ selected: PAY_ONLINE_METHOD });
        act(() => radio("Benefit").focus());

        fireEvent.keyDown(focusedElement(), { key: "ArrowDown" });
        expect(radio("BenefitPay").tagName).toBe("BUTTON");
        fireEvent.click(focusedElement());

        expect(onSelect).toHaveBeenCalledWith(WALLET_METHOD);
    });
});
