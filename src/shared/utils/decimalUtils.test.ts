import { describe, it, expect } from "@jest/globals";
import Decimal from "decimal.js-light";
import { toDecimal, p2, q3 } from "./decimalUtils";

describe("toDecimal", () => {
    describe("Decimal input", () => {
        it("returns the same Decimal instance unchanged", () => {
            const d = new Decimal("1.23");

            const result = toDecimal(d);

            expect(result).toBe(d);
        });
    });

    describe("null / undefined input", () => {
        it("returns Decimal(0) for null", () => {
            expect(toDecimal(null).toNumber()).toBe(0);
        });

        it("returns Decimal(0) for undefined", () => {
            expect(toDecimal(undefined).toNumber()).toBe(0);
        });
    });

    describe("number input", () => {
        it("converts a positive integer", () => {
            expect(toDecimal(5).toNumber()).toBe(5);
        });

        it("converts a positive decimal number", () => {
            expect(toDecimal(1.5).toNumber()).toBe(1.5);
        });

        it("converts zero", () => {
            expect(toDecimal(0).toNumber()).toBe(0);
        });

        it("converts a negative number", () => {
            expect(toDecimal(-3.75).toNumber()).toBe(-3.75);
        });

        it("returns Decimal(0) for NaN", () => {
            expect(toDecimal(NaN).toNumber()).toBe(0);
        });

        it("returns Decimal(0) for Infinity", () => {
            expect(toDecimal(Infinity).toNumber()).toBe(0);
        });

        it("returns Decimal(0) for -Infinity", () => {
            expect(toDecimal(-Infinity).toNumber()).toBe(0);
        });
    });

    describe("string input", () => {
        it("converts '3.14' to Decimal(3.14)", () => {
            expect(toDecimal("3.14").toNumber()).toBeCloseTo(3.14);
        });

        it("converts '100' to Decimal(100)", () => {
            expect(toDecimal("100").toNumber()).toBe(100);
        });

        it("converts a string with a comma separator '3,14'", () => {
            expect(toDecimal("3,14").toNumber()).toBeCloseTo(3.14);
        });

        it("converts a negative string '-2.5'", () => {
            expect(toDecimal("-2.5").toNumber()).toBe(-2.5);
        });

        it("returns Decimal(0) for an empty string", () => {
            expect(toDecimal("").toNumber()).toBe(0);
        });

        it("returns Decimal(0) for a bare minus '-'", () => {
            expect(toDecimal("-").toNumber()).toBe(0);
        });

        it("returns Decimal(0) for a lone dot '.'", () => {
            expect(toDecimal(".").toNumber()).toBe(0);
        });

        it("returns Decimal(0) for '.-'", () => {
            expect(toDecimal("-.").toNumber()).toBe(0);
        });

        it("returns Decimal(0) for a non-numeric string 'abc'", () => {
            expect(toDecimal("abc").toNumber()).toBe(0);
        });

        it("returns Decimal(0) for a string with spaces '  '", () => {
            expect(toDecimal("   ").toNumber()).toBe(0);
        });
    });

    describe("unknown / object input", () => {
        it("returns Decimal(0) for a plain object", () => {
            expect(toDecimal({}).toNumber()).toBe(0);
        });

        it("returns Decimal(0) for an array", () => {
            expect(toDecimal([]).toNumber()).toBe(0);
        });

        it("returns Decimal(0) for a boolean true", () => {
            expect(toDecimal(true).toNumber()).toBe(0);
        });
    });
});

describe("p2", () => {
    it("rounds a Decimal to 2 decimal places (half-up)", () => {
        expect(p2(new Decimal("1.234")).toNumber()).toBeCloseTo(1.23);
    });

    it("rounds 1.235 up to 1.24 (half-up rule)", () => {
        expect(p2(new Decimal("1.235")).toFixed(2)).toBe("1.24");
    });

    it("returns 0.00 for Decimal(0)", () => {
        expect(p2(new Decimal(0)).toNumber()).toBe(0);
    });

    it("handles a value that already has 2 decimal places", () => {
        expect(p2(new Decimal("5.50")).toNumber()).toBeCloseTo(5.5);
    });
});

describe("q3", () => {
    it("rounds a Decimal to 3 decimal places (half-up)", () => {
        expect(q3(new Decimal("1.2345")).toFixed(3)).toBe("1.235");
    });

    it("rounds 1.2344 down to 1.234 (half-up rule)", () => {
        expect(q3(new Decimal("1.2344")).toFixed(3)).toBe("1.234");
    });

    it("returns 0.000 for Decimal(0)", () => {
        expect(q3(new Decimal(0)).toNumber()).toBe(0);
    });

    it("handles a value that already has 3 decimal places", () => {
        expect(q3(new Decimal("2.500")).toFixed(3)).toBe("2.500");
    });
});
