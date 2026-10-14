import { describe, it, expect } from "@jest/globals";
import { parseCellInput, PNL_CLASSES, PNL_CLASS_LABELS, PNL_CLASS_HINTS } from "./businessFormat";

describe("PNL classes", () => {
    it("offers NOT_APPLICABLE directly after OPEX", () => {
        expect(PNL_CLASSES.indexOf("NOT_APPLICABLE")).toBe(PNL_CLASSES.indexOf("OPEX") + 1);
    });

    it("has a label and a hint for every class", () => {
        PNL_CLASSES.forEach(c => {
            expect(PNL_CLASS_LABELS[c]).toBeTruthy();
            expect(PNL_CLASS_HINTS[c]).toBeTruthy();
        });
        expect(PNL_CLASS_LABELS.NOT_APPLICABLE).toBe("N/A (expense outside Operating Expenses)");
    });
});

describe("parseCellInput", () => {
    it("reads a comma as the decimal point", () => {
        expect(parseCellInput("12,5", false)).toEqual({ kind: "value", value: 12.5 });
    });

    it("refuses a comma used as a thousands separator rather than guessing which one was meant", () => {
        // For money the two readings differ by a factor of a thousand: 1.8005 or 1800.5.
        expect(parseCellInput("1,800.5", false)).toEqual({ kind: "invalid", reason: "is not a number" });
    });

    it("treats an empty cell as no figure, so emptying a cell clears it", () => {
        expect(parseCellInput("   ", false)).toEqual({ kind: "value", value: null });
    });

    it.each(["abc", "12a", "1e3", "-", "1 000"])("refuses %p as not a number", raw => {
        expect(parseCellInput(raw, false)).toEqual({ kind: "invalid", reason: "is not a number" });
    });

    it("refuses a negative figure", () => {
        expect(parseCellInput("-5", false)).toEqual({ kind: "invalid", reason: "cannot be negative" });
    });

    it("refuses a fraction only where a whole number is required", () => {
        expect(parseCellInput("12.5", true)).toEqual({ kind: "invalid", reason: "must be a whole number" });
        expect(parseCellInput("12.5", false)).toEqual({ kind: "value", value: 12.5 });
    });

    it("refuses more than three decimals, since the server would refuse them after a round trip", () => {
        expect(parseCellInput("12.3456", false)).toEqual({ kind: "invalid", reason: "can have at most 3 decimal places" });
        expect(parseCellInput("12,3456", false)).toEqual({ kind: "invalid", reason: "can have at most 3 decimal places" });
    });

    it("does not count trailing zeros as decimals", () => {
        expect(parseCellInput("12.5000", false)).toEqual({ kind: "value", value: 12.5 });
        expect(parseCellInput("1000", false)).toEqual({ kind: "value", value: 1000 });
        expect(parseCellInput("12.345", false)).toEqual({ kind: "value", value: 12.345 });
    });
});
