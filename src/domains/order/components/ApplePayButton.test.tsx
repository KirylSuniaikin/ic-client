import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "../../../shared/i18n";
import { ApplePayButton } from "./ApplePayButton";

const originalCss = window.CSS;

function setNativeAppearance(supported: boolean): void {
    // Fixture only: jsdom has no CSS.supports; this is the one method the button asks.
    window.CSS = { supports: (): boolean => supported } as unknown as typeof CSS;
}

afterEach(() => {
    window.CSS = originalCss;
});

describe("ApplePayButton", () => {
    describe("in Safari", () => {
        beforeEach(() => setNativeAppearance(true));

        it("keeps the native -apple-pay-button face", () => {
            const { container } = render(<ApplePayButton onClick={jest.fn()} />);

            expect(container.querySelector("apple-pay-button")).toBeNull();
            expect(screen.getByRole("button", { name: "Pay with Apple Pay" }).tagName).toBe("BUTTON");
        });
    });

    describe("outside Safari", () => {
        beforeEach(() => setNativeAppearance(false));

        it("renders Apple's own button component, since the CSS face would be an empty box", () => {
            const { container } = render(<ApplePayButton onClick={jest.fn()} />);

            const button = container.querySelector("apple-pay-button");
            expect(button).not.toBeNull();
            expect(button?.getAttribute("buttonstyle")).toBe("black");
            expect(button?.getAttribute("type")).toBe("buy");
        });

        // Owner, 19 Oct 2026: the same height and corners as the payment page's own red button.
        it("sizes Apple's component like the page's own button: full width, 48px tall, 16px corners", () => {
            render(<ApplePayButton onClick={jest.fn()} />);

            const style = screen.getByRole("button", { name: "Pay with Apple Pay" }).getAttribute("style") ?? "";
            expect(style).toContain("--apple-pay-button-width: 100%");
            expect(style).toContain("--apple-pay-button-height: 48px");
            expect(style).toContain("--apple-pay-button-border-radius: 16px");
        });

        it("starts the payment on tap", () => {
            const onClick = jest.fn<void, []>();
            render(<ApplePayButton onClick={onClick} />);

            fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it("drops taps while busy — the component has no disabled state of its own", () => {
            const onClick = jest.fn<void, []>();
            render(<ApplePayButton onClick={onClick} disabled />);

            const button = screen.getByRole("button", { name: "Pay with Apple Pay" });
            fireEvent.click(button);

            expect(onClick).not.toHaveBeenCalled();
            expect(button.getAttribute("aria-disabled")).toBe("true");
        });
    });
});
