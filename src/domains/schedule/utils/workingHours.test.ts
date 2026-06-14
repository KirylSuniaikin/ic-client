import { describe, it, expect } from "@jest/globals";
import { workingHours, ramadanHours } from "./workingHours";

const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

describe("workingHours", () => {
    it("contains entries for all 7 days of the week", () => {
        ALL_DAYS.forEach(day => {
            expect(Object.prototype.hasOwnProperty.call(workingHours, day)).toBe(true);
        });
    });

    it("Sunday is closed (null)", () => {
        expect(workingHours["Sunday"]).toBeNull();
    });

    it("Saturday is open (non-null)", () => {
        expect(workingHours["Saturday"]).not.toBeNull();
    });

    it("each open day has at least one time range", () => {
        Object.entries(workingHours).forEach(([, ranges]) => {
            if (ranges !== null) {
                expect(ranges.length).toBeGreaterThan(0);
            }
        });
    });

    it("each time range is a tuple of exactly two strings [start, end]", () => {
        Object.values(workingHours).forEach(ranges => {
            if (ranges !== null) {
                ranges.forEach(range => {
                    expect(range).toHaveLength(2);
                    expect(typeof range[0]).toBe("string");
                    expect(typeof range[1]).toBe("string");
                });
            }
        });
    });

    it("time strings match HH:MM format", () => {
        const timePattern = /^\d{2}:\d{2}$/;
        Object.values(workingHours).forEach(ranges => {
            if (ranges !== null) {
                ranges.forEach(([start, end]) => {
                    expect(start).toMatch(timePattern);
                    expect(end).toMatch(timePattern);
                });
            }
        });
    });

    it("Thursday and Friday have late closing times (past midnight)", () => {
        // These days extend past midnight — end time like '01:30'
        const thuRanges = workingHours["Thursday"];
        const friRanges = workingHours["Friday"];
        expect(thuRanges).not.toBeNull();
        expect(friRanges).not.toBeNull();
        // end time should be early morning (next day), e.g. '01:30'
        expect(thuRanges![0][1]).toMatch(/^0\d:/);
        expect(friRanges![0][1]).toMatch(/^0\d:/);
    });
});

describe("ramadanHours", () => {
    it("contains entries for all 7 days of the week", () => {
        ALL_DAYS.forEach(day => {
            expect(Object.prototype.hasOwnProperty.call(ramadanHours, day)).toBe(true);
        });
    });

    it("Sunday is closed (null) during Ramadan", () => {
        expect(ramadanHours["Sunday"]).toBeNull();
    });

    it("Friday is closed (null) during Ramadan", () => {
        expect(ramadanHours["Friday"]).toBeNull();
    });

    it("each open Ramadan day has multiple time ranges (break + night shift)", () => {
        Object.entries(ramadanHours).forEach(([, ranges]) => {
            if (ranges !== null) {
                expect(ranges.length).toBeGreaterThan(1);
            }
        });
    });

    it("each Ramadan time range is a tuple of two strings", () => {
        Object.values(ramadanHours).forEach(ranges => {
            if (ranges !== null) {
                ranges.forEach(range => {
                    expect(range).toHaveLength(2);
                    expect(typeof range[0]).toBe("string");
                    expect(typeof range[1]).toBe("string");
                });
            }
        });
    });
});
