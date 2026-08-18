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

    // City-level roles (SUPER_MANAGER, OWNER) get a branch picker driven by useBranchSelection
    // instead of the selectedBranch prop; MANAGER never sees it (covered above implicitly, since
    // useBranchSelection's smBranch is undefined there and the picker's guard requires it non-null).
    describe("role-based branch picker", () => {
        const CITY_BRANCH = { id: "branch-2", externalId: "ext-2", branchNo: 2, branchName: "City Branch", locale: "cty" };

        // MUI's outlined Select doesn't wire an htmlFor/aria-labelledby that
        // testing-library's label-association algorithm can follow, so target the
        // InputLabel element itself rather than getByLabelText.
        const branchSelectorLabel = () => screen.queryByText("Branch", { selector: "label" });

        it.each([
            [StaffRoles.SUPER_MANAGER],
            [StaffRoles.OWNER],
        ])("shows the branch picker and schedules against the picked branch for %s", (role) => {
            mockUseBranchSelection.mockReturnValue({
                branches: [CITY_BRANCH],
                selectedBranch: CITY_BRANCH,
                onBranchChange: jest.fn(),
            });
            mockUseSchedule.mockReturnValue(scheduleResult());

            render(<ScheduleView selectedBranch={{ id: "branch-1" }} role={role} />);

            expect(branchSelectorLabel()).toBeTruthy();
            expect(mockUseSchedule).toHaveBeenCalledWith("branch-2");
        });

        it("hides the branch picker for MANAGER even when useBranchSelection returns a branch", () => {
            mockUseBranchSelection.mockReturnValue({
                branches: [CITY_BRANCH],
                selectedBranch: CITY_BRANCH,
                onBranchChange: jest.fn(),
            });
            mockUseSchedule.mockReturnValue(scheduleResult());

            render(<ScheduleView selectedBranch={{ id: "branch-1" }} role={StaffRoles.MANAGER} />);

            expect(branchSelectorLabel()).toBeNull();
            // MANAGER schedules against the prop-supplied branch, not the city-wide selection.
            expect(mockUseSchedule).toHaveBeenCalledWith("branch-1");
        });
    });
});
