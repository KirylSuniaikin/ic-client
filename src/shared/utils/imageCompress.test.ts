import { describe, it, expect } from "@jest/globals";
import { computeTargetSize } from "./imageCompress";

describe("computeTargetSize", () => {
    describe("landscape (w > h)", () => {
        it("scales the longest edge (width) down to exactly maxEdge, preserving aspect ratio", () => {
            const result = computeTargetSize(3200, 1600, 1600);

            expect(result).toEqual({ w: 1600, h: 800 });
        });

        it("returns integer dimensions when the scale does not divide evenly", () => {
            const result = computeTargetSize(3000, 2000, 1600);

            expect(result.w).toBe(1600);
            expect(result.h).toBe(1067);
            expect(Number.isInteger(result.w)).toBe(true);
            expect(Number.isInteger(result.h)).toBe(true);
        });
    });

    describe("portrait (h > w)", () => {
        it("scales the longest edge (height) down to exactly maxEdge, preserving aspect ratio", () => {
            const result = computeTargetSize(1200, 2400, 1600);

            expect(result).toEqual({ w: 800, h: 1600 });
        });
    });

    describe("square (w === h)", () => {
        it("scales both edges down to exactly maxEdge", () => {
            const result = computeTargetSize(2000, 2000, 1600);

            expect(result).toEqual({ w: 1600, h: 1600 });
        });
    });

    describe("already smaller than maxEdge on both edges", () => {
        it("returns the input unchanged instead of scaling up to fill maxEdge", () => {
            // A naive scale-to-fit implementation would enlarge this to 1600x800.
            const result = computeTargetSize(100, 50, 1600);

            expect(result).toEqual({ w: 100, h: 50 });
        });
    });

    describe("exactly equal to maxEdge", () => {
        it("returns the input unchanged", () => {
            const result = computeTargetSize(1600, 900, 1600);

            expect(result).toEqual({ w: 1600, h: 900 });
        });
    });

    describe("degenerate / non-finite input", () => {
        it("returns {w:0, h:0} for zero width", () => {
            const result = computeTargetSize(0, 100, 1600);

            expect(result).toEqual({ w: 0, h: 0 });
        });

        it("returns {w:0, h:0} for zero height", () => {
            const result = computeTargetSize(100, 0, 1600);

            expect(result).toEqual({ w: 0, h: 0 });
        });

        it("returns {w:0, h:0} for NaN width, without producing NaN output", () => {
            const result = computeTargetSize(NaN, 100, 1600);

            expect(result).toEqual({ w: 0, h: 0 });
            expect(Number.isNaN(result.w)).toBe(false);
            expect(Number.isNaN(result.h)).toBe(false);
        });

        it("returns {w:0, h:0} for NaN height, without producing NaN output", () => {
            const result = computeTargetSize(100, NaN, 1600);

            expect(result).toEqual({ w: 0, h: 0 });
            expect(Number.isNaN(result.w)).toBe(false);
            expect(Number.isNaN(result.h)).toBe(false);
        });

        it("returns {w:0, h:0} for a negative width", () => {
            const result = computeTargetSize(-100, 100, 1600);

            expect(result).toEqual({ w: 0, h: 0 });
        });
    });
});
