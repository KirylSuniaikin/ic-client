import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useSchedule } from "../hooks/useSchedule";
import type { UseScheduleResult } from "../hooks/useSchedule";
import type { WorkingHoursSchedule, DaySchedule } from "../../../../shared/api/management";
import ScheduleView from "./ScheduleView";

// Factoryless jest.mock() -- the hook is auto-mocked from its real module shape
// (no manual __mocks__ file needed, following the HistoryComponent.test.tsx pattern
// for local hook mocking).
jest.mock("../hooks/useSchedule");

const mockUseSchedule = jest.mocked(useSchedule);

const CLOSED: DaySchedule = { isOpen: false, shifts: [] };

function scheduleResult(overrides: Partial<UseScheduleResult> = {}): UseScheduleResult {
    return {
        schedule: null,
        loading: false,
        error: null,
        localSchedule: null,
        setLocalSchedule: jest.fn(),
        dirty: false,
        save: jest.fn(async () => {}),
        reset: jest.fn(),
        ...overrides,
    };
}

describe("ScheduleView", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders 12:00 - 00:00 for a shift stored as [12:00, 24:00] (end remapped)", () => {
        const schedule: WorkingHoursSchedule = {
            Sunday: CLOSED,
            Monday: { isOpen: true, shifts: [["12:00", "24:00"]] },
            Tuesday: CLOSED,
            Wednesday: CLOSED,
            Thursday: CLOSED,
            Friday: CLOSED,
            Saturday: CLOSED,
        };
        mockUseSchedule.mockReturnValue(scheduleResult({ schedule }));

        render(<ScheduleView branchId="branch-1" />);

        expect(screen.getByText("12:00 - 00:00")).toBeTruthy();
    });

    it("renders 00:00 - 14:00 for a shift stored as [00:00, 14:00] (start left unchanged)", () => {
        const schedule: WorkingHoursSchedule = {
            Sunday: CLOSED,
            Monday: { isOpen: true, shifts: [["00:00", "14:00"]] },
            Tuesday: CLOSED,
            Wednesday: CLOSED,
            Thursday: CLOSED,
            Friday: CLOSED,
            Saturday: CLOSED,
        };
        mockUseSchedule.mockReturnValue(scheduleResult({ schedule }));

        render(<ScheduleView branchId="branch-1" />);

        expect(screen.getByText("00:00 - 14:00")).toBeTruthy();
    });

    it("renders 15:00 - 00:00 for a shift stored with the legacy 23:59 end", () => {
        const schedule: WorkingHoursSchedule = {
            Sunday: CLOSED,
            Monday: { isOpen: true, shifts: [["15:00", "23:59"]] },
            Tuesday: CLOSED,
            Wednesday: CLOSED,
            Thursday: CLOSED,
            Friday: CLOSED,
            Saturday: CLOSED,
        };
        mockUseSchedule.mockReturnValue(scheduleResult({ schedule }));

        render(<ScheduleView branchId="branch-1" />);

        expect(screen.getByText("15:00 - 00:00")).toBeTruthy();
    });

    // ScheduleView no longer owns a branch picker. It used to run its own useBranchSelection,
    // which meant the Config screen had two independent selections that could disagree and
    // neither started from the branch chosen on the homepage. The picker now lives once in
    // ConfigComponent's ManagementTopBar slot and serves both tabs -- its visibility and role
    // gating are covered by ConfigComponent.branchSelector.test.tsx. What remains ScheduleView's
    // responsibility is simply scheduling against whatever branch it is handed.
    describe("branch scoping", () => {
        it("schedules against the branch it is given", () => {
            mockUseSchedule.mockReturnValue(scheduleResult());

            render(<ScheduleView branchId="branch-2" />);

            expect(mockUseSchedule).toHaveBeenCalledWith("branch-2");
        });

        it("does not render a branch picker of its own", () => {
            mockUseSchedule.mockReturnValue(scheduleResult());

            render(<ScheduleView branchId="branch-1" />);

            // MUI's outlined Select doesn't wire an htmlFor/aria-labelledby that
            // testing-library's label-association algorithm can follow, so target the
            // InputLabel element itself rather than getByLabelText.
            expect(screen.queryByText("Branch", { selector: "label" })).toBeNull();
        });
    });
});
