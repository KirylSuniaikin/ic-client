import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { getNextOpening } from "./getNextOpening";
import type { DaySchedule, WorkingHoursSchedule } from "../../../shared/api/management";

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

// 2026-07-12 is a Sunday. 08:00Z is 11:00 in Bahrain (UTC+3).
const SUNDAY_11_00 = new Date("2026-07-12T08:00:00.000Z");

describe("getNextOpening", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    // A split shift: the first one has already ended, the branch reopens later today.
    it("returns a later shift today with daysAhead 0", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T10:00:00.000Z")); // Sunday 13:00 Bahrain
        const schedule = fullSchedule({
            Sunday: { isOpen: true, shifts: [["10:00", "12:00"], ["18:00", "23:59"]] },
        });

        expect(getNextOpening(schedule)).toEqual({ daysAhead: 0, day: "Sunday", time: "18:00" });
    });

    it("returns tomorrow when today is closed", () => {
        jest.useFakeTimers();
        jest.setSystemTime(SUNDAY_11_00);
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["15:00", "23:59"]] } });

        expect(getNextOpening(schedule)).toEqual({ daysAhead: 1, day: "Monday", time: "15:00" });
    });

    it("names the day when the branch opens in three days", () => {
        jest.useFakeTimers();
        jest.setSystemTime(SUNDAY_11_00);
        const schedule = fullSchedule({ Wednesday: { isOpen: true, shifts: [["16:30", "01:30"]] } });

        expect(getNextOpening(schedule)).toEqual({ daysAhead: 3, day: "Wednesday", time: "16:30" });
    });

    // getTimeUntilNextOpening stops at six days ahead and would report nothing here.
    it("returns next week's opening when the only open day is today and today's shift is over", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T20:00:00.000Z")); // Sunday 23:00 Bahrain
        const schedule = fullSchedule({ Sunday: { isOpen: true, shifts: [["10:00", "22:00"]] } });

        expect(getNextOpening(schedule)).toEqual({ daysAhead: 7, day: "Sunday", time: "10:00" });
    });

    it("returns null for no schedule and for a week with no open day", () => {
        expect(getNextOpening(null)).toBeNull();
        expect(getNextOpening(undefined)).toBeNull();
        expect(getNextOpening(fullSchedule({}))).toBeNull();
    });

    it("skips days missing from the schedule instead of throwing", () => {
        jest.useFakeTimers();
        jest.setSystemTime(SUNDAY_11_00);
        // A payload from an older backend can lack day keys the type promises.
        const partial: Partial<WorkingHoursSchedule> = { Tuesday: { isOpen: true, shifts: [["15:00", "23:59"]] } };
        // Cast: the point of the test is a schedule that breaks the type's all-seven-days promise.
        const schedule = partial as WorkingHoursSchedule;

        expect(getNextOpening(schedule)).toEqual({ daysAhead: 2, day: "Tuesday", time: "15:00" });
    });
});
