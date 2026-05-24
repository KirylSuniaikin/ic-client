import { describe, it, expect } from "@jest/globals";
import { formatPrepPlanUnit } from "./PrepPlanTable";

describe("formatPrepPlanUnit", () => {
    it("returns 'g' for GRAMS", () => {
        const result = formatPrepPlanUnit("GRAMS");

        expect(result).toBe("g");
    });

    it("returns 'pcs' for PIECES", () => {
        const result = formatPrepPlanUnit("PIECES");

        expect(result).toBe("pcs");
    });

    it("returns 'ml' for ML", () => {
        const result = formatPrepPlanUnit("ML");

        expect(result).toBe("ml");
    });

    it("returns the input unchanged for an unrecognised value", () => {
        const result = formatPrepPlanUnit("UNKNOWN_UNIT");

        expect(result).toBe("UNKNOWN_UNIT");
    });
});

describe("amount display rounding", () => {
    it("rounds a whole-number amount to itself", () => {
        const result = Math.round(480.0);

        expect(result).toBe(480);
    });

    it("rounds down a sub-0.5 fractional amount", () => {
        const result = Math.round(9200.4);

        expect(result).toBe(9200);
    });

    it("rounds up a 0.5-or-greater fractional amount", () => {
        const result = Math.round(84.6);

        expect(result).toBe(85);
    });
});
