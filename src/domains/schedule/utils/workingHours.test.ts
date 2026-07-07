import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { workingHours, ramadanHours } from "./workingHours";
import { isWithinWorkingHours } from "./isWithinWorkingHours";
import { getTimeUntilNextOpening } from "./getTimeUntilNextOpening";
import type { DaySchedule, WorkingHoursSchedule } from "../../../shared/api/management";

const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CLOSED: DaySchedule = { isOpen: false, shifts: [] };

// WorkingHoursSchedule requires all 7 day keys; build a fully-closed week and override specific days.
function fullSchedule(overrides: Partial<WorkingHoursSchedule>): WorkingHoursSchedule {
    return {
        Sunday: CLOSED,
        Monday: CLOSED,
        Tuesday: CLOSED,
        Wednesday: CLOSED,
        Thursday: CLOSED,
        Friday: CLOSED,
        Saturday: CLOSED,
        ...overrides,
    };
}

describe("workingHours", () => {
    it("contains entries for all 7 days of the week", () => {
        ALL_DAYS.forEach(day => {
            expect(Object.prototype.hasOwnProperty.call(workingHours, day)).toBe(true);
        });
    });

    it("Sunday is closed (isOpen false)", () => {
        expect(workingHours["Sunday"].isOpen).toBe(false);
    });

    it("Saturday is open (isOpen true)", () => {
        expect(workingHours["Saturday"].isOpen).toBe(true);
    });

    it("each open day has at least one shift", () => {
        Object.values(workingHours).forEach(day => {
            if (day.isOpen) {
                expect(day.shifts.length).toBeGreaterThan(0);
            }
        });
    });

    it("each shift is a tuple of exactly two strings [start, end]", () => {
        Object.values(workingHours).forEach(day => {
            day.shifts.forEach(range => {
                expect(range).toHaveLength(2);
                expect(typeof range[0]).toBe("string");
                expect(typeof range[1]).toBe("string");
            });
        });
    });

    it("time strings match HH:MM format", () => {
        const timePattern = /^\d{2}:\d{2}$/;
        Object.values(workingHours).forEach(day => {
            day.shifts.forEach(([start, end]) => {
                expect(start).toMatch(timePattern);
                expect(end).toMatch(timePattern);
            });
        });
    });

    it("Thursday and Friday have late closing times (past midnight)", () => {
        // These days extend past midnight — end time like '01:30'
        expect(workingHours["Thursday"].shifts[0][1]).toMatch(/^0\d:/);
        expect(workingHours["Friday"].shifts[0][1]).toMatch(/^0\d:/);
    });
});

describe("ramadanHours", () => {
    it("contains entries for all 7 days of the week", () => {
        ALL_DAYS.forEach(day => {
            expect(Object.prototype.hasOwnProperty.call(ramadanHours, day)).toBe(true);
        });
    });

    it("Sunday is closed during Ramadan", () => {
        expect(ramadanHours["Sunday"].isOpen).toBe(false);
    });

    it("Friday is closed during Ramadan", () => {
        expect(ramadanHours["Friday"].isOpen).toBe(false);
    });

    it("each open Ramadan day has multiple shifts (break + night shift)", () => {
        Object.values(ramadanHours).forEach(day => {
            if (day.isOpen) {
                expect(day.shifts.length).toBeGreaterThan(1);
            }
        });
    });

    it("each Ramadan shift is a tuple of two strings", () => {
        Object.values(ramadanHours).forEach(day => {
            day.shifts.forEach(range => {
                expect(range).toHaveLength(2);
                expect(typeof range[0]).toBe("string");
                expect(typeof range[1]).toBe("string");
            });
        });
    });
});

describe("isWithinWorkingHours", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("returns true when schedule is null", () => {
        expect(isWithinWorkingHours(null)).toBe(true);
    });

    it("returns true when schedule is undefined", () => {
        expect(isWithinWorkingHours(undefined)).toBe(true);
    });

    it("returns false when all days are closed", () => {
        expect(isWithinWorkingHours(fullSchedule({}))).toBe(false);
    });

    it("returns false when current time is outside all shifts for today", () => {
        // Pin to Monday 2026-01-05 at 10:00 UTC = 13:00 Bahrain (UTC+3); shift starts at 15:00
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["15:00", "23:59"]] } });
        expect(isWithinWorkingHours(schedule)).toBe(false);
    });

    it("returns true when current time is within a shift", () => {
        // Pin to Monday 2026-01-05 at 10:00 UTC = 13:00 Bahrain; shift covers 00:00-23:59
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["00:00", "23:59"]] } });
        expect(isWithinWorkingHours(schedule)).toBe(true);
    });

    it("returns false when the day is marked closed even though its shifts would cover now", () => {
        // Same covering shift as the passing case above, but isOpen=false => treated as closed.
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: false, shifts: [["00:00", "23:59"]] } });
        expect(isWithinWorkingHours(schedule)).toBe(false);
    });
});

describe("getTimeUntilNextOpening", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("returns zeros and null message when schedule is null", () => {
        const result = getTimeUntilNextOpening(null);
        expect(result).toEqual({ hours: 0, minutes: 0, nextOpeningMessage: null });
    });

    it("returns zeros and null message when schedule is undefined", () => {
        const result = getTimeUntilNextOpening(undefined);
        expect(result).toEqual({ hours: 0, minutes: 0, nextOpeningMessage: null });
    });

    it("returns non-zero time and null message when a future shift exists in the schedule", () => {
        // Pin to Monday 2026-01-05 at 10:00 UTC = 13:00 Bahrain; next open is Tuesday 15:00
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Tuesday: { isOpen: true, shifts: [["15:00", "23:59"]] } });
        const result = getTimeUntilNextOpening(schedule);
        // nextOpeningMessage is always null after removing the Monday hardcode
        expect(result.nextOpeningMessage).toBeNull();
        // There is a future shift (Tuesday 15:00 Bahrain), so time components are non-zero
        expect(result.hours > 0 || result.minutes > 0).toBe(true);
    });
});
