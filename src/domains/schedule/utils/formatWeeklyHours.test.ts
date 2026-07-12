import { describe, it, expect } from "@jest/globals";
import { formatWeeklyHours } from "./formatWeeklyHours";
import type { WorkingHoursSchedule, DaySchedule } from "../../../shared/api/management";

const CLOSED: DaySchedule = { isOpen: false, shifts: [] };

function schedule(overrides: Partial<WorkingHoursSchedule>): WorkingHoursSchedule {
    return {
        Sunday: CLOSED, Monday: CLOSED, Tuesday: CLOSED, Wednesday: CLOSED,
        Thursday: CLOSED, Friday: CLOSED, Saturday: CLOSED,
        ...overrides,
    };
}

describe("formatWeeklyHours", () => {
    it("returns no rows when there is no schedule", () => {
        expect(formatWeeklyHours(null)).toEqual([]);
        expect(formatWeeklyHours(undefined)).toEqual([]);
    });

    it("groups days that share identical hours into one row", () => {
        const open14: DaySchedule = { isOpen: true, shifts: [["14:00", "23:59"]] };
        const rows = formatWeeklyHours(schedule({
            Monday: open14, Tuesday: open14, Wednesday: open14, Saturday: open14,
        }));

        const grouped = rows.find((r) => r.shifts !== null);
        expect(grouped?.days).toEqual(["Monday", "Tuesday", "Wednesday", "Saturday"]);
        expect(grouped?.shifts).toEqual(["14:00–00:00"]);
    });

    it("renders the stored end-of-day marker as 00:00, matching the header", () => {
        // "24:00" is the marker the backend parser uses for end-of-day; customers must never see it.
        const rows = formatWeeklyHours(schedule({
            Monday: { isOpen: true, shifts: [["12:00", "24:00"]] },
        }));

        expect(rows.find((r) => r.days.includes("Monday"))?.shifts).toEqual(["12:00–00:00"]);
    });

    it("marks a closed day with null shifts rather than dropping it", () => {
        const rows = formatWeeklyHours(schedule({
            Monday: { isOpen: true, shifts: [["14:00", "23:59"]] },
        }));

        const closedRow = rows.find((r) => r.shifts === null);
        expect(closedRow?.days).toContain("Sunday");
    });

    it("keeps a day with multiple shifts as separate ranges on one row", () => {
        const rows = formatWeeklyHours(schedule({
            Friday: { isOpen: true, shifts: [["10:00", "12:00"], ["18:00", "23:59"]] },
        }));

        expect(rows.find((r) => r.days.includes("Friday"))?.shifts).toEqual(["10:00–12:00", "18:00–00:00"]);
    });

    it("orders rows Monday-first", () => {
        const rows = formatWeeklyHours(schedule({
            Monday: { isOpen: true, shifts: [["14:00", "23:59"]] },
            Friday: { isOpen: true, shifts: [["15:30", "01:00"]] },
        }));

        expect(rows[0].days[0]).toBe("Monday");
    });
});
