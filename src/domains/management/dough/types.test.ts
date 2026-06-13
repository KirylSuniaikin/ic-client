import { describe, it, expect } from "@jest/globals";
import { isDoughAlert } from "./types";

describe("isDoughAlert", () => {
    it("returns true for a valid DoughAlert with doughType S", () => {
        const result = isDoughAlert({ doughType: "S", currentAmount: 5 });

        expect(result).toBe(true);
    });

    it("returns true for a valid DoughAlert with doughType M", () => {
        const result = isDoughAlert({ doughType: "M", currentAmount: 0 });

        expect(result).toBe(true);
    });

    it("returns true for a valid DoughAlert with doughType L", () => {
        const result = isDoughAlert({ doughType: "L", currentAmount: 100 });

        expect(result).toBe(true);
    });

    it("returns true for a valid DoughAlert with doughType Brick", () => {
        const result = isDoughAlert({ doughType: "Brick", currentAmount: 3 });

        expect(result).toBe(true);
    });

    it("returns false for an unknown doughType string", () => {
        const result = isDoughAlert({ doughType: "XL", currentAmount: 3 });

        expect(result).toBe(false);
    });

    it("returns false when currentAmount is missing", () => {
        const result = isDoughAlert({ doughType: "S" });

        expect(result).toBe(false);
    });

    it("returns false when doughType is missing", () => {
        const result = isDoughAlert({ currentAmount: 5 });

        expect(result).toBe(false);
    });

    it("returns false when currentAmount is a string instead of number", () => {
        const result = isDoughAlert({ doughType: "S", currentAmount: "5" });

        expect(result).toBe(false);
    });

    it("returns false for null", () => {
        const result = isDoughAlert(null);

        expect(result).toBe(false);
    });

    it("returns false for a plain string", () => {
        const result = isDoughAlert("S");

        expect(result).toBe(false);
    });

    it("returns false for a number", () => {
        const result = isDoughAlert(42);

        expect(result).toBe(false);
    });

    it("returns false for an empty object", () => {
        const result = isDoughAlert({});

        expect(result).toBe(false);
    });
});
