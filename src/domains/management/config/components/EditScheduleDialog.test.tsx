import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { UseScheduleResult } from "../hooks/useSchedule";
import type { WorkingHoursSchedule, DaySchedule } from "../../../../shared/api/management";
import EditScheduleDialog from "./EditScheduleDialog";

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

function scheduleHookResult(
    localSchedule: WorkingHoursSchedule,
    setLocalSchedule: (s: WorkingHoursSchedule) => void
): UseScheduleResult {
    return {
        schedule: localSchedule,
        loading: false,
        error: null,
        localSchedule,
        setLocalSchedule,
        dirty: false,
        save: jest.fn(async () => {}),
        reset: jest.fn(),
    };
}

describe("EditScheduleDialog", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("defaults a newly-opened, previously-closed day's shift to [12:00, 23:59], never 24:00", () => {
        const localSchedule = fullSchedule({ Monday: CLOSED });
        const setLocalSchedule = jest.fn<void, [WorkingHoursSchedule]>();
        const scheduleHook = scheduleHookResult(localSchedule, setLocalSchedule);

        render(<EditScheduleDialog open={true} onClose={jest.fn()} scheduleHook={scheduleHook} />);

        // Toggle Monday's switch from closed to open.
        const switches = screen.getAllByRole("switch");
        // Day rows render Sunday..Saturday in order; Monday is index 1.
        fireEvent.click(switches[1]);

        expect(setLocalSchedule).toHaveBeenCalledWith({
            ...localSchedule,
            Monday: { isOpen: true, shifts: [["12:00", "23:59"]] },
        });
    });

    it("appends a new shift defaulting to [12:00, 23:59] when 'Add shift' is clicked on an already-open day", () => {
        const localSchedule = fullSchedule({
            Monday: { isOpen: true, shifts: [["09:00", "17:00"]] },
        });
        const setLocalSchedule = jest.fn<void, [WorkingHoursSchedule]>();
        const scheduleHook = scheduleHookResult(localSchedule, setLocalSchedule);

        render(<EditScheduleDialog open={true} onClose={jest.fn()} scheduleHook={scheduleHook} />);

        fireEvent.click(screen.getByRole("button", { name: /add shift/i }));

        expect(setLocalSchedule).toHaveBeenCalledWith({
            ...localSchedule,
            Monday: { isOpen: true, shifts: [["09:00", "17:00"], ["12:00", "23:59"]] },
        });
    });

    it("never mints a new 24:00 shift end for either the reopen-day or add-shift path", () => {
        const localSchedule = fullSchedule({ Monday: CLOSED });
        const setLocalSchedule = jest.fn<void, [WorkingHoursSchedule]>();
        const scheduleHook = scheduleHookResult(localSchedule, setLocalSchedule);

        render(<EditScheduleDialog open={true} onClose={jest.fn()} scheduleHook={scheduleHook} />);

        const switches = screen.getAllByRole("switch");
        fireEvent.click(switches[1]);

        const calls = setLocalSchedule.mock.calls;
        const anyShiftHas2400 = calls.some(([schedule]) =>
            Object.values(schedule).some(day =>
                day.shifts.some(([, end]) => end === "24:00")
            )
        );
        expect(anyShiftHas2400).toBe(false);
    });
});
