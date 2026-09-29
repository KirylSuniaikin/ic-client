import { describe, it, expect } from "@jest/globals";
import { cleanProductName, normalizeProductName } from "./productName";

describe("cleanProductName", () => {
    it("trims and collapses internal whitespace to single spaces, keeping the case", () => {
        expect(cleanProductName("  Green   Bell\tPepper \n")).toBe("Green Bell Pepper");
    });

    it("returns an empty string for a blank name", () => {
        expect(cleanProductName("   ")).toBe("");
    });
});

describe("normalizeProductName", () => {
    it("treats names differing only in case and spacing as the same product", () => {
        expect(normalizeProductName(" MOZZARELLA  cheese")).toBe(normalizeProductName("Mozzarella Cheese"));
    });

    it("keeps genuinely different names apart", () => {
        expect(normalizeProductName("Mozzarella")).not.toBe(normalizeProductName("Mozzarella Cheese"));
    });
});
