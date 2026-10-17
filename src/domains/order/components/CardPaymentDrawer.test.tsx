import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "../../../shared/i18n";
import CardPaymentDrawer from "./CardPaymentDrawer";
import type { CardCheckoutStep } from "../hooks/useCardCheckout";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { sheetHandleCount } from "../../../shared/components/sheetHandle.testutil";

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

describe("CardPaymentDrawer on PC", () => {
    afterEach(() => {
        clearMatchMedia();
    });

    /** A matchMedia whose answer can change between renders, as a resized window's does. */
    function stubMutableMatchMedia(initial: boolean): { setWide: (wide: boolean) => void } {
        let wide = initial;
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            configurable: true,
            value: (query: string) => ({
                get matches(): boolean {
                    return wide;
                },
                media: query,
                onchange: null,
                addListener: (): void => {},
                removeListener: (): void => {},
                addEventListener: (): void => {},
                removeEventListener: (): void => {},
                dispatchEvent: (): boolean => false,
            }),
        });
        return { setWide: (next: boolean): void => { wide = next; } };
    }

    it("is a dialog at the card sheet's 1350, named by its title, with no handle", () => {
        stubMatchMedia(true);
        renderDrawer();

        const root = document.querySelector<HTMLElement>(".MuiDialog-root");
        expect(root).toBeTruthy();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        expect(Number(window.getComputedStyle(root as HTMLElement).zIndex)).toBe(1350);
        const dialog = screen.getByRole("dialog", { name: "Pay by card" });
        expect(dialog.getAttribute("aria-labelledby")).toBe("card-payment-drawer-title");
        expect(sheetHandleCount(root as HTMLElement)).toBe(0);
    });

    // The gateway's hosted fields attach to this node once; a resize mid-payment must not remount it.
    it("keeps the hosted-field container mounted when the viewport crosses the breakpoint", () => {
        const viewport = stubMutableMatchMedia(true);
        const fieldContainerRef = jest.fn<void, [HTMLElement | null]>();
        const props = {
            open: true, step: READY_STEP, total: "5.000", fieldErrors: {}, error: null, fieldContainerRef,
            onClose: jest.fn<void, []>(), onPay: jest.fn<void, []>(), onRetry: jest.fn<void, []>(),
        };
        const { rerender } = render(<CardPaymentDrawer {...props} />);

        expect(fieldContainerRef).toHaveBeenCalledTimes(1);
        const node = fieldContainerRef.mock.calls[0][0];
        expect(node).toBeInstanceOf(HTMLElement);

        viewport.setWide(false);
        rerender(<CardPaymentDrawer {...props} total="5.500" />);

        expect(fieldContainerRef).toHaveBeenCalledTimes(1);
        expect(document.querySelector(".MuiDialog-root")).toBeTruthy();
        expect(document.getElementById("card-number")?.closest("[dir='ltr']")).toBe(node);
    });
});
