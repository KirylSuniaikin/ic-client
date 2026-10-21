import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "@mui/material";
import "../../../shared/i18n";
import { ApplePayButton } from "./ApplePayButton";

const originalCss = window.CSS;

// Stands in for Apple's apple-pay-button.js, which jsdom never loads. Its one behaviour that
// matters here is real: the connectedCallback stops every click at the host, so a click never
// bubbles to the root where React 18 dispatches onClick. Without this stub the tests below passed
// while Apple Pay was dead on every desktop browser but Safari.
if (!customElements.get("apple-pay-button")) {
    customElements.define(
        "apple-pay-button",
        class extends HTMLElement {
            connectedCallback(): void {
                this.addEventListener("click", (event: Event) => event.stopPropagation());
            }
        },
    );
}

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

        it("starts the payment on tap, although Apple's component stops the click at its host", () => {
            const onClick = jest.fn<void, []>();
            render(<ApplePayButton onClick={onClick} />);

            fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        // The payment page is an MUI Dialog, portalled to <body>: React's listener there is cut off
        // by Apple's stopPropagation just the same.
        it("starts the payment on tap inside the payment Dialog's portal", () => {
            const onClick = jest.fn<void, []>();
            render(
                <Dialog open>
                    <ApplePayButton onClick={onClick} />
                </Dialog>,
            );

            fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it("follows a new handler and a busy-to-idle change without leaving a stale listener", () => {
            const first = jest.fn<void, []>();
            const second = jest.fn<void, []>();
            const { rerender } = render(<ApplePayButton onClick={first} disabled />);
            const button = screen.getByRole("button", { name: "Pay with Apple Pay" });

            fireEvent.click(button);
            rerender(<ApplePayButton onClick={first} />);
            fireEvent.click(button);
            rerender(<ApplePayButton onClick={second} />);
            fireEvent.click(button);

            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);
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
