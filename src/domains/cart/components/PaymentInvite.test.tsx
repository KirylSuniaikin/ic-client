import { describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// The bubble renders its copy via useTranslation; initialize the real i18n instance.
import "../../../shared/i18n";

import { PaymentInviteArrow, PaymentInviteBubble, arrowPath } from "./PaymentInvite";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

// The owner's sketch (option A, 18 Oct 2026): the cart covers when the pair shows; this suite
// covers how they are drawn.

const INVITE_EN = "Hey, we added new payment methods — check them out!";

// jsdom lays nothing out, so every clientHeight is 0; the arrow is drawn from its box's height.
const realClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");

function layOutBoxesAt(height: number): void {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => height });
}

afterEach(() => {
    if (realClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", realClientHeight);
});

function renderArrow(direction: "ltr" | "rtl" = "ltr") {
    return render(
        <ThemeProvider theme={createTheme({ direction })}>
            <PaymentInviteArrow />
        </ThemeProvider>
    );
}

describe("PaymentInviteBubble", () => {
    it("carries the invitation in white on the brand red, with a tail", () => {
        render(<PaymentInviteBubble />);

        const bubble = screen.getByTestId("payment-invite-bubble");
        expect(bubble.textContent).toBe(`✨${INVITE_EN}`);
        const rules = emotionRulesFor(bubble);
        expect(rules).toContain("background-color:#E44B4C");
        expect(rules).toContain("color:#fff");
        expect(rules).toContain("::after");
    });
});

describe("arrowPath", () => {
    it("sets off under the bubble and ends level with the row's middle, heading into it", () => {
        const path = arrowPath(200);

        expect(path.startsWith("M 60 0 ")).toBe(true);
        expect(path.endsWith("16 200, 24 200")).toBe(true);
    });

    // The bends keep their size; only the straight run down the margin grows.
    it("keeps both bends the same size however tall the arrow is", () => {
        const bends = (path: string): string[] => path.split(/ L \d+ \d+ /);

        const [shortTop] = bends(arrowPath(150));
        const [tallTop] = bends(arrowPath(400));

        expect(tallTop).toBe(shortTop);
        expect(arrowPath(150)).toContain("L 10 124 C 10 142");
        expect(arrowPath(400)).toContain("L 10 374 C 10 392");
    });
});

describe("PaymentInviteArrow", () => {
    it("is hidden from screen readers and from taps", () => {
        renderArrow();

        const arrow = screen.getByTestId("payment-invite-arrow");
        expect(arrow.getAttribute("aria-hidden")).toBe("true");
        expect(emotionRulesFor(arrow)).toContain("pointer-events:none");
    });

    it("draws nothing until its box has a height", () => {
        renderArrow();

        expect(screen.queryByTestId("payment-invite-arrow-drawing")).toBeNull();
    });

    it("draws the curve at its box's measured height", () => {
        layOutBoxesAt(180);
        renderArrow();

        const drawing = screen.getByTestId("payment-invite-arrow-drawing");
        expect(drawing.getAttribute("transform")).toBeNull();
        expect(screen.getByTestId("payment-invite-arrow").innerHTML).toContain(`d="${arrowPath(180)}"`);
    });

    // The RTL cache moves the box to the right margin; the drawing has to be mirrored by hand.
    it("mirrors the drawing in RTL", () => {
        layOutBoxesAt(180);
        renderArrow("rtl");

        expect(screen.getByTestId("payment-invite-arrow-drawing").getAttribute("transform")).toBe("translate(64 0) scale(-1 1)");
    });
});
