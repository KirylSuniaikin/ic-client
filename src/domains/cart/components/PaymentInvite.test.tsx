import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";

// The bubble renders its copy via useTranslation; initialize the real i18n instance.
import i18n from "../../../shared/i18n";

import { PaymentInviteBubble } from "./PaymentInvite";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

// The owner's bubble (option A, 18 Oct 2026). PaymentPage.test.tsx covers where it shows.

const INVITE_EN = "Hey, we added new payment methods — check them out!";
const INVITE_AR = "مرحباً! أضفنا طرق دفع جديدة، اكتشفها الآن";

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

    // The sparkle is decoration; a screen reader would otherwise read out "sparkles".
    it("keeps the sparkle out of what a screen reader reads", () => {
        render(<PaymentInviteBubble />);

        expect(screen.getByText("✨").getAttribute("aria-hidden")).toBe("true");
    });

    it("invites in Arabic for an Arabic customer", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = render(<PaymentInviteBubble />);

            expect(screen.getByTestId("payment-invite-bubble").textContent).toBe(`✨${INVITE_AR}`);
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
