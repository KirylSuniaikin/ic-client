import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import { useSchedule } from "../hooks/useSchedule";
import { useBranchSelection } from "../../_shared/hooks/useBranchSelection";
import type { UseScheduleResult } from "../hooks/useSchedule";
import type { WorkingHoursSchedule, DaySchedule } from "../../../../shared/api/management";
import ScheduleView from "./ScheduleView";

// Factoryless jest.mock() -- both hooks are auto-mocked from their real module shape
// (no manual __mocks__ file needed, following the HistoryComponent.test.tsx pattern
// for local hook mocking).
jest.mock("../hooks/useSchedule");
jest.mock("../../_shared/hooks/useBranchSelection");

const mockUseSchedule = jest.mocked(useSchedule);
const mockUseBranchSelection = jest.mocked(useBranchSelection);

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
        mockUseBranchSelection.mockReturnValue({
            branches: [],
            selectedBranch: undefined,
            onBranchChange: jest.fn(),
        });
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

        render(<ScheduleView selectedBranch={{ id: "branch-1" }} role={StaffRoles.MANAGER} />);

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

        render(<ScheduleView selectedBranch={{ id: "branch-1" }} role={StaffRoles.MANAGER} />);

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

        render(<ScheduleView selectedBranch={{ id: "branch-1" }} role={StaffRoles.MANAGER} />);

        expect(screen.getByText("15:00 - 00:00")).toBeTruthy();
    });
});
