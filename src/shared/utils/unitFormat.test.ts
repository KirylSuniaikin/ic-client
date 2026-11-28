import { describe, it, expect } from "@jest/globals";
import { formatStockUnit, formatUnit, perStockUnit } from "./unitFormat";

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

describe("formatStockUnit", () => {
    it("formats GRAMS as kg: stock is counted per kilogram", () => {
        expect(formatStockUnit("GRAMS")).toBe("kg");
    });

    it("formats ML as L: stock is counted per litre", () => {
        expect(formatStockUnit("ML")).toBe("L");
    });

    it("formats PIECES as pcs", () => {
        expect(formatStockUnit("PIECES")).toBe("pcs");
    });

    it("renders an em dash for a product with no unit", () => {
        expect(formatStockUnit(null)).toBe("—");
    });
});

describe("perStockUnit", () => {
    it("says what a price is per, in the stock unit", () => {
        expect(perStockUnit("GRAMS")).toBe("/ kg");
        expect(perStockUnit("ML")).toBe("/ L");
        expect(perStockUnit("PIECES")).toBe("/ pcs");
    });

    it("adds nothing for a product with no unit yet", () => {
        expect(perStockUnit(null)).toBe("");
    });
});
