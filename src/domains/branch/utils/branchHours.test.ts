import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { describeBranchHours } from "./branchHours";
import type { DaySchedule, WorkingHoursSchedule } from "../../../shared/api/management";

const CLOSED: DaySchedule = { isOpen: false, shifts: [] };

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

describe("describeBranchHours", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    // The header and the order gate treat a branch with no schedule as open; the sheet must agree.
    it("reads a branch with no schedule as open, with no closing time", () => {
        expect(describeBranchHours(null)).toEqual({ state: "open", closesAt: null });
        expect(describeBranchHours(undefined)).toEqual({ state: "open", closesAt: null });
    });

    it("gives the display closing time of the shift in progress", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T08:00:00.000Z")); // Sunday 11:00 Bahrain
        const schedule = fullSchedule({ Sunday: { isOpen: true, shifts: [["10:00", "23:59"]] } });

        // "23:59" is the stored end of day; the customer reads it as midnight.
        expect(describeBranchHours(schedule)).toEqual({ state: "open", closesAt: "00:00" });
    });

    it("reports a closed branch together with when it next opens", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-07-12T08:00:00.000Z")); // Sunday 11:00 Bahrain
        const schedule = fullSchedule({ Monday: { isOpen: true, shifts: [["15:00", "23:59"]] } });

        expect(describeBranchHours(schedule)).toEqual({
            state: "closed",
            nextOpening: { daysAhead: 1, day: "Monday", time: "15:00" },
        });
    });

    it("reports a closed branch with no next opening when no day of the week is open", () => {
        expect(describeBranchHours(fullSchedule({}))).toEqual({ state: "closed", nextOpening: null });
    });
});
