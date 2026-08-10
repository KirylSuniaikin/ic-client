import { describe, it, expect } from "@jest/globals";
import {
    PAYMENT_POLL_INTERVAL_MS,
    PAYMENT_TIMEOUT_MS,
    PAYMENT_FAILURE_PROMPT_TIMEOUT_MS,
    APPROVED_AUTO_RETURN_MS,
    PHONE_COUNTRY_CODE,
    PHONE_DIGIT_COUNT,
} from "./config";

// These values are pinned to the ic-pizza-kiosk (Expo/RN) reference implementation per task-spec.md
// §6/§22 Open Question 2 -- they must not be "invented". This test is the regression guard against
// a future accidental edit drifting the two kiosks out of sync.
describe("kiosk config constants", () => {
    it("polls the payment result every 2000ms, matching services/config.ts", () => {
        expect(PAYMENT_POLL_INTERVAL_MS).toBe(2000);
    });

    it("times out a payment attempt after 120000ms, matching services/config.ts", () => {
        expect(PAYMENT_TIMEOUT_MS).toBe(120_000);
    });

    it("waits 60000ms on an unanswered failure prompt before auto-abandoning, matching services/config.ts", () => {
        expect(PAYMENT_FAILURE_PROMPT_TIMEOUT_MS).toBe(60_000);
    });

    it("auto-returns from the approved sheet after 15000ms, matching app/(kiosk)/confirm.tsx's AUTO_RETURN_MS", () => {
        expect(APPROVED_AUTO_RETURN_MS).toBe(15_000);
    });

    it("uses Bahrain's country code, matching PhoneEntryPopup.tsx's COUNTRY_CODE", () => {
        expect(PHONE_COUNTRY_CODE).toBe("973");
    });

    it("expects an 8-digit local number, matching PhoneEntryPopup.tsx's PHONE_DIGITS", () => {
        expect(PHONE_DIGIT_COUNT).toBe(8);
    });

    it("produces the 973######## pattern the order payload's tel field expects when combined", () => {
        const tel = `${PHONE_COUNTRY_CODE}${"1".repeat(PHONE_DIGIT_COUNT)}`;

        expect(tel).toBe("97311111111");
        expect(tel).toHaveLength(11);
    });
});
