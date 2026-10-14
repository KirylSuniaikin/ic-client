import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "../../../shared/i18n";
import CardPaymentDrawer from "./CardPaymentDrawer";
import type { CardCheckoutStep } from "../hooks/useCardCheckout";

const READY_STEP: CardCheckoutStep = "ready";

function renderDrawer(overrides: Partial<React.ComponentProps<typeof CardPaymentDrawer>> = {}) {
    const props = {
        open: true,
        step: READY_STEP,
        total: "5.000",
        fieldErrors: {},
        error: null,
        fieldContainerRef: jest.fn<void, [HTMLElement | null]>(),
        onClose: jest.fn<void, []>(),
        onPay: jest.fn<void, []>(),
        onRetry: jest.fn<void, []>(),
        ...overrides,
    };
    render(<CardPaymentDrawer {...props} />);
    return props;
}

describe("CardPaymentDrawer", () => {
    it("renders four labelled hosted-field inputs and none has a name attribute", () => {
        renderDrawer();

        for (const label of ["Card number", "Expiry month", "Expiry year", "Security code"]) {
            const input = screen.getByLabelText(label);
            expect(input.tagName).toBe("INPUT");
            expect(input.hasAttribute("name")).toBe(false);
            expect(input.hasAttribute("readonly")).toBe(true);
            expect(input.getAttribute("title")).toBe(label);
        }
    });

    it("associates the title with the dialog via aria-labelledby", () => {
        renderDrawer();

        expect(screen.getByRole("dialog", { name: "Pay by card" })).not.toBeNull();
    });

    it("shows general errors with role=alert", () => {
        renderDrawer({ error: "Something failed" });

        expect(screen.getByRole("alert").textContent).toBe("Something failed");
    });

    it("flags fields in error", () => {
        renderDrawer({ fieldErrors: { cardNumber: true } });

        expect(screen.getByLabelText("Card number").getAttribute("aria-invalid")).toBe("true");
        expect(screen.getByLabelText("Security code").hasAttribute("aria-invalid")).toBe(false);
    });

    it("enables Pay only when the step is ready and calls onPay", () => {
        const props = renderDrawer();

        fireEvent.click(screen.getByRole("button", { name: "Pay now" }));

        expect(props.onPay).toHaveBeenCalledTimes(1);
    });

    it.each(["idle", "preparing","updatingSession", "paying"] as const)("disables Pay in step %s", step => {
        renderDrawer({ step });

        expect(screen.getByRole("button", { name: /Pay now|Paying/ }).hasAttribute("disabled")).toBe(true);
    });

    it("marks the pay button busy and changes its text while paying", () => {
        renderDrawer({ step: "paying" });

        const button = screen.getByRole("button", { name: "Paying..." });
        expect(button.getAttribute("aria-busy")).toBe("true");
    });

    it("has a close button with an aria-label that calls onClose", () => {
        const props = renderDrawer();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("shows Try again in needsNewSession, keeps the fields mounted but hidden", () => {
        const props = renderDrawer({ step: "needsNewSession" });

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));

        expect(props.onRetry).toHaveBeenCalledTimes(1);
        const input = document.getElementById("card-number");
        expect(input).not.toBeNull();
        const container = input?.closest("[dir='ltr']");
        expect(container).not.toBeNull();
        if (!container) return;
        expect(container.getAttribute("class")).toBeTruthy();
        expect(window.getComputedStyle(container).display).toBe("none");
    });

    it("keeps the fields in an LTR container under Arabic", async () => {
        const { default: i18n } = await import("../../../shared/i18n");
        await i18n.changeLanguage("ar");
        try {
            renderDrawer();
            const input = document.getElementById("card-number");
            expect(input?.closest("[dir]")?.getAttribute("dir")).toBe("ltr");
        } finally {
            await act(async () => { await i18n.changeLanguage("en"); });
        }
    });
});
