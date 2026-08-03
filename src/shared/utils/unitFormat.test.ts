import { describe, it, expect } from "@jest/globals";
import { formatUnit } from "./unitFormat";

describe("formatUnit", () => {
    it("formats GRAMS as g", () => {
        const result = formatUnit("GRAMS");

        expect(result).toBe("g");
    });

    it("formats PIECES as pcs", () => {
        const result = formatUnit("PIECES");

        expect(result).toBe("pcs");
    });

    it("formats ML as ml", () => {
        const result = formatUnit("ML");

        expect(result).toBe("ml");
    });

    it("passes through an unknown non-null string unchanged", () => {
        const result = formatUnit("KG");

        expect(result).toBe("KG");
    });

    it("renders an em dash for null", () => {
        const result = formatUnit(null);

        expect(result).toBe("—");
    });

    it("renders an em dash for undefined", () => {
        const result = formatUnit(undefined);

        expect(result).toBe("—");
    });
});
