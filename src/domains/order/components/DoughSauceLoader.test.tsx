import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DoughSauceLoader } from "./DoughSauceLoader";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import { loaderDrawing, loaderPart } from "./cardDrawer.testutil";

// The card form's loading state (owner, 19 Oct 2026): a dough ball and a sauce drop meeting while
// the secure session loads. Drawn inline, so it costs no Lottie file and no dependency.

function loader(): HTMLElement {
    return screen.getByTestId("dough-sauce-loader");
}

describe("DoughSauceLoader", () => {
    it("announces its label as a status and keeps the drawing out of the accessibility tree", () => {
        render(<DoughSauceLoader label="Connecting the dough with the sauce... wait a sec" />);

        const status = screen.getByRole("status");
        expect(status).toBe(loader());
        expect(status.textContent).toBe("Connecting the dough with the sauce... wait a sec");
        expect(loaderDrawing(status).getAttribute("aria-hidden")).toBe("true");
    });

    it("draws the dough, the sauce, the dots between them and the heart they make", () => {
        render(<DoughSauceLoader label="Loading" />);

        for (const part of ["dough", "sauce", "link", "heart"]) {
            expect(loaderPart(loader(), part)).not.toBeNull();
        }
    });

    it("animates both characters towards each other on one cycle", () => {
        render(<DoughSauceLoader label="Loading" />);

        const rules = emotionRulesFor(loader());
        expect(rules).toContain("animation:doughSauceDough 2.4s");
        expect(rules).toContain("animation:doughSauceSauce 2.4s");
        expect(rules).toContain("animation:doughSauceHeart 2.4s");
    });

    // With motion off the heart must not sit there permanently: it starts hidden and only its
    // keyframes show it, so the still frame is the pair waiting apart.
    it("stops every animation when the visitor asks for reduced motion, leaving the heart hidden", () => {
        render(<DoughSauceLoader label="Loading" />);

        const rules = emotionRulesFor(loader());
        expect(rules).toMatch(/@media \(prefers-reduced-motion:reduce\) \{[^}]*svg \*[^}]*animation:none/);
        expect(rules).toMatch(/\.heart \{opacity:0;/);
    });
});
