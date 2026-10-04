import { describe, it, expect } from "@jest/globals";
import { cleanProductName, cleanVendorName, normalizeProductName, normalizeVendorName } from "./productName";

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

// POST /api/vendors stores and compares vendor names by the product rule.
describe("vendor names", () => {
    it("are cleaned like product names, keeping the case", () => {
        expect(cleanVendorName("  Fresh   Farms\t")).toBe("Fresh Farms");
    });

    it("treat names differing only in case and spacing as the same vendor", () => {
        expect(normalizeVendorName(" FRESH  farms ")).toBe(normalizeVendorName("Fresh Farms"));
        expect(normalizeVendorName("Fresh")).not.toBe(normalizeVendorName("Fresh Farms"));
    });
});
