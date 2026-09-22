import { describe, it, expect } from "@jest/globals";
import { haversineDistanceKm } from "./haversine";

// Al-Hidd and Saar, Bahrain — the two production branches named in branch-picker-task.txt.
// Expected value computed independently (mean Earth radius 6371 km) and pinned here as a
// fixed, deterministic assertion.
const AL_HIDD = { latitude: 26.2361, longitude: 50.6603 };
const SAAR = { latitude: 26.0667, longitude: 50.5 };
const EXPECTED_KM = 24.714509313324328;

describe("haversineDistanceKm", () => {
    it("returns a correct, deterministic km value for a known coordinate pair", () => {
        expect(haversineDistanceKm(AL_HIDD, SAAR)).toBeCloseTo(EXPECTED_KM, 6);
    });

    it("is symmetric", () => {
        expect(haversineDistanceKm(AL_HIDD, SAAR)).toBeCloseTo(haversineDistanceKm(SAAR, AL_HIDD), 10);
    });

    it("returns 0 for the distance from a point to itself", () => {
        expect(haversineDistanceKm(AL_HIDD, AL_HIDD)).toBe(0);
    });
});
