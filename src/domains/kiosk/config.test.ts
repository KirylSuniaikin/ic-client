import { describe, it, expect } from "@jest/globals";
import {
    ORDER_PLACED_AUTO_RETURN_MS,
    PHONE_COUNTRY_CODE,
    PHONE_DIGIT_COUNT,
} from "./config";

describe("kiosk config constants", () => {
    it("auto-returns from the order-placed sheet after 15000ms", () => {
        expect(ORDER_PLACED_AUTO_RETURN_MS).toBe(15_000);
    });

    it("uses Bahrain's country code", () => {
        expect(PHONE_COUNTRY_CODE).toBe("973");
    });

    it("expects an 8-digit local number", () => {
        expect(PHONE_DIGIT_COUNT).toBe(8);
    });

    it("produces the 973######## pattern the order payload's tel field expects when combined", () => {
        const tel = `${PHONE_COUNTRY_CODE}${"1".repeat(PHONE_DIGIT_COUNT)}`;

        expect(tel).toBe("97311111111");
        expect(tel).toHaveLength(11);
    });
});
