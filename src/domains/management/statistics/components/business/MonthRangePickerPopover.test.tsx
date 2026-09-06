import { describe, it, expect } from "@jest/globals";
import { closeRange, presetRange } from "./MonthRangePickerPopover";

// The picker is one calendar clicked twice. These cover the rule that decides what those two
// clicks mean; the widget itself is MUI's and renders through a portal, which is not worth
// asserting on.
describe("closeRange", () => {
    it("keeps the order when the second click is later", () => {
        const r = closeRange(new Date(2026, 0, 1), new Date(2026, 3, 1));

        expect(r.from.getMonth()).toBe(0);
        expect(r.to.getMonth()).toBe(3);
    });

    it("flips the order when the second click is earlier", () => {
        // Clicking a later month first is a normal way to use a single calendar, and it means the
        // same range. Taking the clicks literally would give an inverted range the server rejects.
        const r = closeRange(new Date(2026, 5, 1), new Date(2026, 1, 1));

        expect(r.from.getMonth()).toBe(1);
        expect(r.to.getMonth()).toBe(5);
    });

    it("allows a single month when both clicks are the same", () => {
        const r = closeRange(new Date(2026, 4, 1), new Date(2026, 4, 1));

        expect(r.from).toEqual(r.to);
    });
});

describe("presetRange", () => {
    it("counts the current month as one of them", () => {
        // "Last 3 months" in September means July, August, September - not June to September.
        const r = presetRange(3, new Date(2026, 8, 15));

        expect(r.from).toEqual(new Date(2026, 6, 1));
        expect(r.to).toEqual(new Date(2026, 8, 1));
    });

    it("crosses a year boundary correctly", () => {
        const r = presetRange(12, new Date(2026, 2, 20));

        expect(r.from).toEqual(new Date(2025, 3, 1));
        expect(r.to).toEqual(new Date(2026, 2, 1));
    });
});
