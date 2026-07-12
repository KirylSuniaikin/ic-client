import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, act } from "@testing-library/react";

// BranchScheduleHeader's "less than a minute" fallback reads schedule.closed.lessThanMinute
// via useTranslation — initialize the real i18n instance (side effect import), the same way
// app/providers.tsx bootstraps it, so that key resolves instead of warning + echoing the raw key.
import "../../../shared/i18n";

// Factoryless jest.mock() — resolves to the ./__mocks__ manual mocks next to these utils.
jest.mock("../utils/isWithinWorkingHours");
jest.mock("../utils/getTimeUntilNextOpening");
jest.mock("../utils/getClosingTime");

import { isWithinWorkingHours } from "../utils/isWithinWorkingHours";
import { getTimeUntilNextOpening } from "../utils/getTimeUntilNextOpening";
import { getClosingTime } from "../utils/getClosingTime";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import BranchScheduleHeader from "./BranchScheduleHeader";
import type { IBranch } from "../../management/inventory/types";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

const mockIsWithinWorkingHours = jest.mocked(isWithinWorkingHours);
const mockGetTimeUntilNextOpening = jest.mocked(getTimeUntilNextOpening);
const mockGetClosingTime = jest.mocked(getClosingTime);

// IBranch.id is a UUID string; use the default branch id so resolveBranchName matches.
const MATCHING_BRANCH: IBranch = {
    id: DEFAULT_BRANCH_ID,
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Manama Branch",
    locale: "en",
};

const SCHEDULE: WorkingHoursSchedule = {
    Sunday: { isOpen: false, shifts: [] },
    Monday: { isOpen: true, shifts: [["15:00", "23:59"]] },
    Tuesday: { isOpen: true, shifts: [["15:00", "23:59"]] },
    Wednesday: { isOpen: true, shifts: [["15:00", "23:59"]] },
    Thursday: { isOpen: true, shifts: [["16:30", "01:30"]] },
    Friday: { isOpen: true, shifts: [["16:30", "01:30"]] },
    Saturday: { isOpen: true, shifts: [["14:00", "23:59"]] },
};

describe("BranchScheduleHeader", () => {
    beforeEach(() => {
        mockIsWithinWorkingHours.mockReset();
        mockGetTimeUntilNextOpening.mockReset();
        mockGetClosingTime.mockReset();
    });

    it("renders the matched default branch's name", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={null} />);

        expect(screen.getByText("Manama Branch")).toBeTruthy();
    });

    it("falls back to 'IC Pizza' when branches is empty", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);

        render(<BranchScheduleHeader branches={[]} workingHours={null} />);

        expect(screen.getByText("IC Pizza")).toBeTruthy();
    });

    it("shows the closing time when isWithinWorkingHours is true", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);
        mockGetClosingTime.mockReturnValue("23:00");

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={null} />);

        expect(screen.getByText("Closes at 23:00")).toBeTruthy();
    });

    it("falls back to 'Open now' when open but no closing time can be resolved", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);
        mockGetClosingTime.mockReturnValue(null);

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={null} />);

        expect(screen.getByText("Open now")).toBeTruthy();
    });

    it("shows next-opening text when isWithinWorkingHours is false", () => {
        mockIsWithinWorkingHours.mockReturnValue(false);
        mockGetTimeUntilNextOpening.mockReturnValue({ hours: 2, minutes: 15, nextOpeningDay: null, nextOpeningTime: null });

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={null} />);

        expect(screen.getByText("Opens in 2h 15m")).toBeTruthy();
    });

    it("shows the 'less than a minute' fallback when hours and minutes are both 0, mirroring ClosedPopup", () => {
        mockIsWithinWorkingHours.mockReturnValue(false);
        mockGetTimeUntilNextOpening.mockReturnValue({ hours: 0, minutes: 0, nextOpeningDay: null, nextOpeningTime: null });

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={null} />);

        expect(screen.getByText("less than a minute")).toBeTruthy();
    });

    it("forwards the workingHours prop into the schedule utils when open", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);
        mockGetClosingTime.mockReturnValue("23:00");

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={SCHEDULE} />);

        // The header must thread the backend schedule through, not call the utils with no argument.
        expect(mockIsWithinWorkingHours).toHaveBeenCalledWith(SCHEDULE);
        expect(mockGetClosingTime).toHaveBeenCalledWith(SCHEDULE);
    });

    it("forwards the workingHours prop into getTimeUntilNextOpening when closed", () => {
        mockIsWithinWorkingHours.mockReturnValue(false);
        mockGetTimeUntilNextOpening.mockReturnValue({ hours: 2, minutes: 15, nextOpeningDay: null, nextOpeningTime: null });

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={SCHEDULE} />);

        expect(mockGetTimeUntilNextOpening).toHaveBeenCalledWith(SCHEDULE);
    });

    // A countdown across a day boundary is unreadable ("opens in 23h 30m" on a closed Sunday),
    // so the day is named instead — and the countdown must NOT be shown in that case.
    it("names the day and opening time when the branch reopens on a later day", () => {
        mockIsWithinWorkingHours.mockReturnValue(false);
        mockGetTimeUntilNextOpening.mockReturnValue({
            hours: 23, minutes: 30, nextOpeningDay: "Monday", nextOpeningTime: "15:30",
        });

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={null} />);

        expect(screen.getByText("Opens on Monday at 15:30")).toBeTruthy();
        expect(screen.queryByText(/Opens in/)).toBeNull();
    });

    describe("60s re-poll", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("re-checks isWithinWorkingHours every 60s and updates the rendered copy", () => {
            mockIsWithinWorkingHours.mockReturnValue(true);
            mockGetClosingTime.mockReturnValue("23:00");
            mockGetTimeUntilNextOpening.mockReturnValue({ hours: 1, minutes: 0, nextOpeningDay: null, nextOpeningTime: null });

            render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} workingHours={null} />);

            expect(screen.getByText("Closes at 23:00")).toBeTruthy();

            mockIsWithinWorkingHours.mockReturnValue(false);
            act(() => {
                jest.advanceTimersByTime(60_000);
            });

            expect(screen.getByText("Opens in 1h 0m")).toBeTruthy();
        });
    });
});
