import { describe, it, expect } from "@jest/globals";
import { staffDisplayName, shortStaffName } from "./staffName";

describe("staffDisplayName", () => {
    it("prefers fullName when set", () => {
        const result = staffDisplayName({ fullName: "Ahmed Sayed", username: "ahmeds" });

        expect(result).toBe("Ahmed Sayed");
    });

    it("falls back to username when fullName is null", () => {
        const result = staffDisplayName({ fullName: null, username: "ahmeds" });

        expect(result).toBe("ahmeds");
    });
});

describe("shortStaffName", () => {
    it("keeps the first two words of a long name", () => {
        const result = shortStaffName("Ahmed Sayed Mohammed Abdulla Hasan Ali");

        expect(result).toBe("Ahmed Sayed");
    });

    it("leaves a two-word name unchanged", () => {
        const result = shortStaffName("John Smith");

        expect(result).toBe("John Smith");
    });

    it("returns a single-word name as-is", () => {
        const result = shortStaffName("Cher");

        expect(result).toBe("Cher");
    });

    it("collapses leading, trailing and repeated whitespace", () => {
        const result = shortStaffName("  Ahmed   Sayed   Mohammed  ");

        expect(result).toBe("Ahmed Sayed");
    });

    it("returns an empty string for an empty name", () => {
        const result = shortStaffName("");

        expect(result).toBe("");
    });

    it("splits Arabic names on whitespace with no special casing", () => {
        const result = shortStaffName("أحمد سايد محمد عبدالله");

        expect(result).toBe("أحمد سايد");
    });
});
