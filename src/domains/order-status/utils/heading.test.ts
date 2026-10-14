import { describe, it, expect } from "@jest/globals";
import { iconAngleOf, normalizeDegrees, shortestTurnDegrees } from "./heading";

describe("normalizeDegrees", () => {
    it.each([
        [0, 0],
        [359.5, 359.5],
        [360, 0],
        [370, 10],
        [-10, 350],
        [-370, 350],
        [720, 0],
    ])("wraps %p into [0, 360) as %p", (input, expected) => {
        expect(normalizeDegrees(input)).toBeCloseTo(expected, 10);
    });
});

describe("shortestTurnDegrees", () => {
    it.each([
        [350, 10, 20],
        [10, 350, -20],
        [90, 180, 90],
        [180, 90, -90],
        [0, 0, 0],
        [270, 0, 90],
        [0, 270, -90],
    ])("turns from %p to %p by %p", (from, to, expected) => {
        expect(shortestTurnDegrees(from, to)).toBe(expected);
    });

    it("never turns more than half a circle", () => {
        for (let from = 0; from < 360; from += 17) {
            for (let to = 0; to < 360; to += 13) {
                const turn = shortestTurnDegrees(from, to);
                expect(Math.abs(turn)).toBeLessThanOrEqual(180);
                expect(normalizeDegrees(from + turn)).toBeCloseTo(to, 10);
            }
        }
    });
});

describe("iconAngleOf", () => {
    it.each([
        [0, 0],
        [89.6, 90],
        [359.6, 0],
        [-0.4, 0],
        [-90, 270],
    ])("draws %p at the whole-degree angle %p", (input, expected) => {
        expect(iconAngleOf(input)).toBe(expected);
    });
});
