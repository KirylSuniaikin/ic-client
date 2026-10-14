import { describe, it, expect } from "@jest/globals";
import { branchDisplayName } from "./branchDisplayName";

/**
 * Must agree with the backend's `Branch.displayName` and the mobile helper case for case: the web
 * cart, the app and the WhatsApp confirmation name the same branch, so one fallback rule everywhere.
 */
describe("branchDisplayName", () => {
    const both = { branchName: "Muharraq", branchNameAr: "المحرق" };

    it("uses the Arabic name for an Arabic reader", () => {
        expect(branchDisplayName(both, "ar")).toBe("المحرق");
    });

    it("matches Arabic by prefix, so a regional tag still counts", () => {
        expect(branchDisplayName(both, "ar-BH")).toBe("المحرق");
    });

    it("uses the English name for an English reader even when an Arabic one exists", () => {
        expect(branchDisplayName(both, "en")).toBe("Muharraq");
    });

    it("falls back to English when no Arabic name has been typed", () => {
        expect(branchDisplayName({ branchName: "Muharraq", branchNameAr: null }, "ar")).toBe("Muharraq");
    });

    it("falls back to English when an older backend omits the field", () => {
        expect(branchDisplayName({ branchName: "Muharraq" }, "ar")).toBe("Muharraq");
    });

    it("treats a whitespace-only Arabic name as absent", () => {
        expect(branchDisplayName({ branchName: "Muharraq", branchNameAr: "   " }, "ar")).toBe("Muharraq");
    });

    it("trims, so a stray space never reaches the label", () => {
        expect(branchDisplayName({ branchName: "  Muharraq ", branchNameAr: " المحرق " }, "ar")).toBe("المحرق");
        expect(branchDisplayName({ branchName: "  Muharraq ", branchNameAr: null }, "en")).toBe("Muharraq");
    });
});
