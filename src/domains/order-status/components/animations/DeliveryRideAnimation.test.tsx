import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import DeliveryRideAnimation from "./DeliveryRideAnimation";
import { emotionRulesFor } from "../../../management/couriers/components/emotionRules.testutil";

/**
 * The "Out for delivery" treatment on the order-status screen (§1.8). Three decisions are worth
 * holding onto, and none of them were pinned by anything before:
 *
 *  - it is composed from an MUI icon over a CSS road, NOT a fourth Lottie file — the stage was
 *    added late and must not drag in an animation dependency or a new asset;
 *  - the scooter bobs but never TRAVELS, because a moving scooter reads as progress and there is
 *    no honest quantity behind it here (elapsed ride time is measured on the island pill);
 *  - it is decorative, so it stays out of the accessibility tree.
 */

/** Pulls the `@keyframes` body an element's compiled `animation` shorthand points at. */
function keyframesDrivingElement(element: Element): string {
    const rules = emotionRulesFor(element);
    const named = /animation:([A-Za-z0-9_-]+)/.exec(rules);
    if (named === null) return "";
    const frames: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.startsWith("@keyframes") && rule.cssText.includes(named[1])) {
                frames.push(rule.cssText);
            }
        }
    }
    return frames.join("\n");
}

function scooter(): Element {
    const icon = document.querySelector('[data-testid="DeliveryDiningRoundedIcon"]');
    if (icon === null) throw new Error("no scooter icon rendered");
    return icon;
}

describe("DeliveryRideAnimation", () => {
    it("draws the courier with an MUI icon rather than a fourth Lottie file", () => {
        render(<DeliveryRideAnimation />);

        expect(scooter()).toBeTruthy();
        // The three real Lottie stages mount a player container; this one must not.
        expect(document.querySelectorAll("canvas")).toHaveLength(0);
        expect(document.querySelectorAll("[data-testid='lottie-player']")).toHaveLength(0);
    });

    it("keeps the scooter moving rather than showing a still picture of a ride", () => {
        render(<DeliveryRideAnimation />);

        expect(keyframesDrivingElement(scooter())).toMatch(/transform/);
    });

    /**
     * The load-bearing one. A `translateX` here would turn the animation into a progress claim the
     * screen cannot back up — the scooter would appear to be a fraction of the way to the door
     * while nothing on this component knows how far along the ride actually is.
     */
    it("never travels the scooter horizontally, so its position cannot read as progress", () => {
        render(<DeliveryRideAnimation />);

        const frames = keyframesDrivingElement(scooter());
        expect(frames).toMatch(/translateY/);
        expect(frames).not.toMatch(/translateX/);
        expect(frames).not.toMatch(/translate3d/);
    });

    /** Decoration. Announcing a looping scooter to a screen reader is noise, not information. */
    it("stays out of the accessibility tree", () => {
        const { container } = render(<DeliveryRideAnimation />);

        const root = screen.getByTestId("delivery-ride-animation");
        expect(root.getAttribute("aria-hidden")).toBe("true");
        expect(container.querySelectorAll("[role]")).toHaveLength(0);
    });
});
