import { jest, describe, it, expect } from "@jest/globals";
import { normalizeRange } from "./useBusinessStats";

describe("normalizeRange", () => {
    it("swaps a reversed range rather than rejecting it", () => {
        // Picking "to" before "from" is a normal way to use two calendars side by side.
        const result = normalizeRange({ from: new Date(2026, 8, 1), to: new Date(2026, 2, 1) });

        expect(result.from).toEqual(new Date(2026, 2, 1));
        expect(result.to).toEqual(new Date(2026, 8, 1));
    });

    it("keeps a range that is exactly at the limit", () => {
        const result = normalizeRange({ from: new Date(2025, 0, 1), to: new Date(2026, 11, 1) });

        expect(result.from).toEqual(new Date(2025, 0, 1));
    });

    it("trims an over-long range from the far end, keeping the recent months", () => {
        // The server refuses more than 24 months. Trimming the OLD end keeps what the owner just
        // asked to see; trimming the new end would silently drop the month they care about most.
        const result = normalizeRange({ from: new Date(2020, 0, 1), to: new Date(2026, 11, 1) });

        expect(result.to).toEqual(new Date(2026, 11, 1));
        expect(result.from).toEqual(new Date(2025, 0, 1));
    });

    it("keeps a single-month range intact", () => {
        const result = normalizeRange({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 1) });

        expect(result.from).toEqual(new Date(2026, 5, 1));
        expect(result.to).toEqual(new Date(2026, 5, 1));
    });
});
