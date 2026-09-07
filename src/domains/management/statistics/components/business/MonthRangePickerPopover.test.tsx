import { describe, it, expect } from "@jest/globals";
import { closeRange, presetRange, rangePosition } from "./MonthRangePickerPopover";

// The picker is one grid of months clicked twice. These cover the three pure rules behind it —
// what two clicks mean, what a preset covers, and how a month is drawn — rather than the popover,
// which renders through a portal and is not worth asserting on.
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

describe("rangePosition", () => {
    // 2026: Jan = 2026*12 + 0, Sep = 2026*12 + 8.
    const jan = 2026 * 12 + 0;
    const mar = 2026 * 12 + 2;
    const jun = 2026 * 12 + 5;
    const sep = 2026 * 12 + 8;

    it("draws a one-month range as a whole pill, not as a range start", () => {
        // The reported bug: Sep 2026 — Sep 2026 rendered rounded on the left and square on the
        // right, which looked like the popover had cut the month off.
        expect(rangePosition(sep, sep, sep)).toBe("single");
    });

    it("marks both ends of a real range", () => {
        expect(rangePosition(mar, mar, sep)).toBe("start");
        expect(rangePosition(sep, mar, sep)).toBe("end");
    });

    it("marks the months between the ends so the range reads as one bar", () => {
        expect(rangePosition(jun, mar, sep)).toBe("inside");
    });

    it("leaves months outside the range unmarked", () => {
        expect(rangePosition(jan, mar, sep)).toBe("none");
    });
});
