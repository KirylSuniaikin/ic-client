import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// The selector renders its copy via useTranslation; initialize the real i18n instance.
import i18n from "../../../shared/i18n";

import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { APPLE_PAY_CHOICE, CARD_CHOICE } from "../hooks/usePaymentChoice";
import type { PaymentChoice } from "../hooks/usePaymentChoice";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { sheetHandleCount } from "../../../shared/components/sheetHandle.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import {
    focusedElement, hasSheetRoot, layerOf, paymentLogo, paymentMarkOf, paymentRow, paymentRowName, sheetRoot,
    waitForPaymentSheetToClose,
} from "./paymentSelector.testutil";

// Option A (owner, 18 Oct 2026): one row naming the chosen method, opening every method as a radio
// list. Its "Payment method" title is the cart's, so this suite sees only the row.

const ALL_CHOICES: PaymentChoice[] = [DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD, APPLE_PAY_CHOICE, CARD_CHOICE];
const ALL_NAMES = ["At counter", "Benefit", "BenefitPay", "Apple Pay", "Card"];

type SelectorProps = React.ComponentProps<typeof PaymentMethodSelector>;

function renderSelector(overrides: Partial<SelectorProps> = {}, theme = createTheme()) {
    const onSelect = jest.fn<void, [PaymentChoice]>();
    const props: SelectorProps = { choices: ALL_CHOICES, selected: PAY_ONLINE_METHOD, onSelect, ...overrides };
    const view = render(
        <ThemeProvider theme={theme}>
            <PaymentMethodSelector {...props} />
        </ThemeProvider>
    );
    return { ...view, onSelect };
}

function radio(name: string): HTMLElement {
    return screen.getByRole("radio", { name });
}

afterEach(() => {
    clearMatchMedia();
});

describe("PaymentMethodSelector — the row", () => {
    it("is one button naming the chosen method, announced as opening a dialog", () => {
        renderSelector({ selected: WALLET_METHOD });

        const row = screen.getByRole("button", { name: paymentRowName("BenefitPay") });
        expect(row.getAttribute("aria-haspopup")).toBe("dialog");
        expect(row.getAttribute("aria-expanded")).toBe("false");
        expect(row.textContent).toBe("BenefitPay");
        // Exactly one control: no chip, toggle or radio is on screen until the row is tapped.
        expect(screen.getAllByRole("button")).toHaveLength(1);
        expect(screen.queryByRole("radio")).toBeNull();
    });

    // "Pay with Apple Pay" is the name of Apple's own pay button right below the row.
    it("never takes the name of Apple's pay button", () => {
        renderSelector({ selected: APPLE_PAY_CHOICE });

        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        expect(screen.getByRole("button", { name: paymentRowName("Apple Pay") })).toBeTruthy();
    });

    it("keeps a touch target of at least 48px, on the cart's gray track", () => {
        renderSelector();

        const rules = emotionRulesFor(paymentRow());
        expect(rules).toContain("min-height:48px");
        expect(rules).toContain("background-color:#f3f3f3");
    });

    it("points the chevron onward in LTR", () => {
        renderSelector();

        expect(screen.getByTestId("cart-payment-chevron-right")).toBeTruthy();
        expect(screen.queryByTestId("cart-payment-chevron-left")).toBeNull();
    });

    // The RTL emotion cache mirrors the row but not the glyph, so a right chevron would point back.
    it("mirrors the chevron in RTL", () => {
        renderSelector({}, createTheme({ direction: "rtl" }));

        expect(screen.getByTestId("cart-payment-chevron-left")).toBeTruthy();
        expect(screen.queryByTestId("cart-payment-chevron-right")).toBeNull();
    });

    // An in-row "Pay with" (الدفع عبر) once read "pay via pay on collection" here: the row now
    // shows the method alone and is named "<section title> <method>", like the branch card.
    it("reads in Arabic for an Arabic customer, without repeating 'pay' for the counter", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = renderSelector({ selected: DEFAULT_PAYMENT_METHOD });

            const row = paymentRowArabic();
            expect(row.textContent).toBe("الدفع عند الاستلام");
            expect(row.getAttribute("aria-label")).toBe("طريقة الدفع الدفع عند الاستلام");
            // Unmounted first, so switching the language back cannot re-render it outside act().
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});

/** The Arabic row, found by its haspopup rather than by English copy. */
function paymentRowArabic(): HTMLElement {
    const row = screen.getAllByRole("button").find((button) => button.getAttribute("aria-haspopup") === "dialog");
    if (row === undefined) throw new Error("no payment row");
    return row;
}

describe("PaymentMethodSelector — marks", () => {
    it("shows the chosen method's BENEFIT lockup in the row, as decoration", () => {
        renderSelector({ selected: PAY_ONLINE_METHOD });

        const logo = paymentLogo("/benefit-logo.png");
        expect(logo.getAttribute("alt")).toBe("");
        expect(logo.getAttribute("aria-hidden")).toBe("true");
        expect(paymentRow().contains(logo)).toBe(true);
    });

    it("lists both BENEFIT lockups and the card glyph in the sheet, and nothing for the others", () => {
        renderSelector({ selected: DEFAULT_PAYMENT_METHOD });
        fireEvent.click(paymentRow());

        expect(paymentMarkOf(radio("Benefit"))).toBe("/benefit-logo.png");
        expect(paymentMarkOf(radio("BenefitPay"))).toBe("/benefitpay-logo.png");
        expect(paymentMarkOf(radio("Card"))).toBe("card");
        expect(paymentMarkOf(radio("Apple Pay"))).toBeNull();
        expect(paymentMarkOf(radio("At counter"))).toBeNull();
    });

    it("hides a lockup that fails to load and keeps the label", () => {
        renderSelector({ selected: WALLET_METHOD });

        const logo = paymentLogo("/benefitpay-logo.png");
        expect(logo.style.display).toBe("");
        fireEvent.error(logo);

        expect(logo.style.display).toBe("none");
        expect(paymentRow().textContent).toContain("BenefitPay");
    });
});

describe("PaymentMethodSelector — the sheet", () => {
    it("lists every method as a radio, in order, with only the chosen one checked", () => {
        renderSelector({ selected: WALLET_METHOD });
        const row = paymentRow();
        fireEvent.click(row);

        const group = screen.getByRole("radiogroup", { name: "Payment method" });
        const radios = screen.getAllByRole("radio");
        expect(radios.map((r) => r.textContent)).toEqual(ALL_NAMES);
        radios.forEach((r) => expect(group.contains(r)).toBe(true));
        expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "false", "true", "false", "false"]);
        expect(row.getAttribute("aria-expanded")).toBe("true");
    });

    it("is a dialog titled with the section name", () => {
        renderSelector();
        fireEvent.click(paymentRow());

        expect(screen.getByRole("dialog", { name: "Payment method" })).toBeTruthy();
    });

    it("reports the picked method and closes", async () => {
        const { onSelect } = renderSelector({ selected: PAY_ONLINE_METHOD });
        fireEvent.click(paymentRow());

        fireEvent.click(radio("At counter"));

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
        await waitForPaymentSheetToClose();
    });

    // As tapping the selected chip did: select() would otherwise mark the cart touched for nothing.
    it("closes without reporting anything when the current method is picked again", async () => {
        const { onSelect } = renderSelector({ selected: PAY_ONLINE_METHOD });
        fireEvent.click(paymentRow());

        fireEvent.click(radio("Benefit"));

        expect(onSelect).not.toHaveBeenCalled();
        await waitForPaymentSheetToClose();
    });

    it("closes on Escape without changing the method", async () => {
        const { onSelect } = renderSelector();
        fireEvent.click(paymentRow());

        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

        await waitForPaymentSheetToClose();
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("gives every option a touch target of at least 44px, and a visible focus ring", () => {
        renderSelector();
        fireEvent.click(paymentRow());

        const rules = emotionRulesFor(radio("Card"));
        expect(rules).toContain("min-height:52px");
        expect(rules).toMatch(/\.Mui-focusVisible \{[^}]*outline:2px solid #E44B4C/);
    });

    it("hands focus back to the row once it closes", async () => {
        renderSelector({ selected: PAY_ONLINE_METHOD });
        const row = paymentRow();
        // A keyboard user's row has focus when it opens the sheet; fireEvent.click alone gives none.
        act(() => row.focus());
        fireEvent.click(row);

        fireEvent.click(radio("BenefitPay"));

        await waitForPaymentSheetToClose();
        await waitFor(() => expect(focusedElement()).toBe(row));
    });

    it("is a bottom sheet with a grab handle on the phone, painted above the cart's modal", () => {
        renderSelector();
        fireEvent.click(paymentRow());

        const root = sheetRoot("drawer");
        expect(hasSheetRoot("dialog")).toBe(false);
        expect(layerOf(root)).toBe(1301);
        expect(sheetHandleCount(root)).toBe(1);
        // The phone sheet is dismissed by swiping or tapping behind it, so it has no close button.
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });

    it("is a centred dialog with a close button and no handle on PC", async () => {
        stubMatchMedia(true);
        const { onSelect } = renderSelector();
        fireEvent.click(paymentRow());

        const root = sheetRoot("dialog");
        expect(hasSheetRoot("drawer")).toBe(false);
        expect(layerOf(root)).toBe(1301);
        expect(sheetHandleCount(root)).toBe(0);
        expect(screen.getByRole("dialog", { name: "Payment method" })).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        await waitForPaymentSheetToClose();
        expect(onSelect).not.toHaveBeenCalled();
    });
});

describe("PaymentMethodSelector — keyboard", () => {
    it("lands on the chosen method and keeps it the group's only tab stop", () => {
        renderSelector({ selected: WALLET_METHOD });
        fireEvent.click(paymentRow());

        expect(focusedElement()).toBe(radio("BenefitPay"));
        expect(screen.getAllByRole("radio").map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "-1", "0", "-1", "-1"]);
    });

    it("moves focus with the arrow keys, wrapping, without choosing", () => {
        const { onSelect } = renderSelector({ selected: WALLET_METHOD });
        fireEvent.click(paymentRow());

        fireEvent.keyDown(focusedElement(), { key: "ArrowDown" });
        expect(focusedElement()).toBe(radio("Apple Pay"));
        fireEvent.keyDown(focusedElement(), { key: "ArrowDown" });
        fireEvent.keyDown(focusedElement(), { key: "ArrowDown" });
        expect(focusedElement()).toBe(radio("At counter"));
        fireEvent.keyDown(focusedElement(), { key: "ArrowUp" });
        expect(focusedElement()).toBe(radio("Card"));
        fireEvent.keyDown(focusedElement(), { key: "Home" });
        expect(focusedElement()).toBe(radio("At counter"));
        fireEvent.keyDown(focusedElement(), { key: "End" });
        expect(focusedElement()).toBe(radio("Card"));

        expect(onSelect).not.toHaveBeenCalled();
        expect(radio("BenefitPay").getAttribute("aria-checked")).toBe("true");
    });

    it("follows the reading direction for Left and Right", () => {
        renderSelector({ selected: PAY_ONLINE_METHOD }, createTheme({ direction: "rtl" }));
        fireEvent.click(paymentRow());

        fireEvent.keyDown(focusedElement(), { key: "ArrowLeft" });
        expect(focusedElement()).toBe(radio("BenefitPay"));
        fireEvent.keyDown(focusedElement(), { key: "ArrowRight" });
        expect(focusedElement()).toBe(radio("Benefit"));
    });

    it("picks the focused method with the button's own activation", () => {
        const { onSelect } = renderSelector({ selected: PAY_ONLINE_METHOD });
        fireEvent.click(paymentRow());

        fireEvent.keyDown(focusedElement(), { key: "ArrowDown" });
        expect(radio("BenefitPay").tagName).toBe("BUTTON");
        fireEvent.click(focusedElement());

        expect(onSelect).toHaveBeenCalledWith(WALLET_METHOD);
    });
});

describe("PaymentMethodSelector — a single method", () => {
    it("is a static row: no button, no chevron, no sheet", () => {
        renderSelector({ choices: [PAY_ONLINE_METHOD], selected: PAY_ONLINE_METHOD });

        const row = screen.getByTestId("cart-payment-static-row");
        expect(row.textContent).toBe("Benefit");
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.queryByTestId("cart-payment-chevron-right")).toBeNull();
        expect(screen.queryByTestId("cart-payment-chevron-left")).toBeNull();

        fireEvent.click(row);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.queryByRole("radiogroup", { hidden: true })).toBeNull();
    });
});
