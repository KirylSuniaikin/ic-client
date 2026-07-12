import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { workingHours, ramadanHours } from "./workingHours";
import { isWithinWorkingHours } from "./isWithinWorkingHours";
import { getTimeUntilNextOpening } from "./getTimeUntilNextOpening";
import { getClosingTime, toDisplayClosing } from "./getClosingTime";
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

    it("returns zeros and no next-opening day when schedule is null", () => {
        const result = getTimeUntilNextOpening(null);
        expect(result).toEqual({ hours: 0, minutes: 0, nextOpeningDay: null, nextOpeningTime: null });
    });

    it("returns zeros and no next-opening day when schedule is undefined", () => {
        const result = getTimeUntilNextOpening(undefined);
        expect(result).toEqual({ hours: 0, minutes: 0, nextOpeningDay: null, nextOpeningTime: null });
    });

    // The reported bug: on a closed Sunday the header read "opens in 4 hours" because
    // dayjs duration components are modular — a 28h gap reports hours() === 4, silently
    // dropping the day. The day must be named instead.
    it("names the day and opening time when the branch is closed all of today (Sunday → Monday)", () => {
        // Sunday 2026-07-12, 08:00 UTC = 11:00 Bahrain. Sunday closed; Monday opens 15:00.
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T08:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["15:00", "23:59"]] } });

        const result = getTimeUntilNextOpening(schedule);

        expect(result.nextOpeningDay).toBe("Monday");
        expect(result.nextOpeningTime).toBe("15:00");
    });

    it("reports the true whole-hour gap across a day boundary rather than the modular remainder", () => {
        // Sunday 11:00 Bahrain → Monday 15:00 Bahrain is 28h. The old code reported 4.
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T08:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["15:00", "23:59"]] } });

        const result = getTimeUntilNextOpening(schedule);

        expect(result.hours).toBe(28);
        expect(result.minutes).toBe(0);
    });

    // Same-day reopening keeps the countdown — naming the day would be silly ("opens on Sunday").
    it("returns a countdown and no day name when the branch reopens later the same day", () => {
        // Sunday 11:00 Bahrain, a shift starts 15:00 the same day → 4h away, genuinely.
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T08:00:00.000Z"));
        const schedule = fullSchedule({ Sunday: { isOpen: true, shifts: [["15:00", "23:59"]] } });

        const result = getTimeUntilNextOpening(schedule);

        expect(result).toEqual({ hours: 4, minutes: 0, nextOpeningDay: null, nextOpeningTime: null });
    });

    // A split shift: the earlier one has already ended, but the branch reopens later today, so
    // the answer is today's second shift — not tomorrow's first.
    it("picks a later shift on the same day instead of skipping to the next day", () => {
        // Sunday 13:00 Bahrain; shifts 10:00-12:00 and 18:00-23:59 → next opening is 18:00 today.
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T10:00:00.000Z"));
        const schedule = fullSchedule({
            Sunday: { isOpen: true, shifts: [["10:00", "12:00"], ["18:00", "23:59"]] },
        });

        const result = getTimeUntilNextOpening(schedule);

        expect(result).toEqual({ hours: 5, minutes: 0, nextOpeningDay: null, nextOpeningTime: null });
    });
});

describe("getClosingTime", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("returns null when schedule is null", () => {
        expect(getClosingTime(null)).toBeNull();
    });

    it("returns null when schedule is undefined", () => {
        expect(getClosingTime(undefined)).toBeNull();
    });

    it("returns the closing time of the shift currently in progress", () => {
        // Pin to Monday 2026-01-05 at 10:00 UTC = 13:00 Bahrain; shift 00:00-22:00 covers now
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["00:00", "22:00"]] } });
        expect(getClosingTime(schedule)).toBe("22:00");
    });

    it("maps an end-of-day 23:59 closing to 00:00 for display", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["00:00", "23:59"]] } });
        expect(getClosingTime(schedule)).toBe("00:00");
    });

    it("maps an end-of-day 24:00 closing to 00:00 for display", () => {
        // Phase 3: a shift end stored as the legacy "24:00" sentinel must also display as "00:00".
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["00:00", "24:00"]] } });
        expect(getClosingTime(schedule)).toBe("00:00");
    });

    it("returns null when the day is marked closed even though its shift would cover now", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: false, shifts: [["00:00", "23:59"]] } });
        expect(getClosingTime(schedule)).toBeNull();
    });

    it("returns null when now falls outside every shift for the day", () => {
        // 13:00 Bahrain, but the shift only starts at 15:00 — not open yet
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-05T10:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["15:00", "23:59"]] } });
        expect(getClosingTime(schedule)).toBeNull();
    });

    it("resolves an overnight shift that started the previous day", () => {
        // Tuesday 2026-01-06 at 00:00 UTC = 03:00 Bahrain; Monday's 16:30-04:00 shift is still running
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-01-06T00:00:00.000Z"));
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["16:30", "04:00"]] } });
        expect(getClosingTime(schedule)).toBe("04:00");
    });
});


describe("toDisplayClosing", () => {
    it("maps \"23:59\" to \"00:00\"", () => {
        expect(toDisplayClosing("23:59")).toBe("00:00");
    });

    it("maps \"24:00\" to \"00:00\"", () => {
        expect(toDisplayClosing("24:00")).toBe("00:00");
    });

    it("passes through a regular end time unchanged", () => {
        expect(toDisplayClosing("14:00")).toBe("14:00");
    });

    it("passes through \"00:00\" unchanged when given directly as an end time", () => {
        expect(toDisplayClosing("00:00")).toBe("00:00");
    });
});
