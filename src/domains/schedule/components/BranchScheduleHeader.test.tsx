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

const mockIsWithinWorkingHours = jest.mocked(isWithinWorkingHours);
const mockGetTimeUntilNextOpening = jest.mocked(getTimeUntilNextOpening);
const mockGetClosingTime = jest.mocked(getClosingTime);

// IBranch.id is typed `number`, but the real API returns UUID-string branch ids
// (production code coerces this exact mismatch via `String(b.id)`, e.g. in
// HomePageModals). Mirroring that here to exercise the real match/no-match paths.
const MATCHING_BRANCH: IBranch = {
    id: DEFAULT_BRANCH_ID as unknown as number,
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Manama Branch",
    locale: "en",
};

describe("BranchScheduleHeader", () => {
    beforeEach(() => {
        mockIsWithinWorkingHours.mockReset();
        mockGetTimeUntilNextOpening.mockReset();
        mockGetClosingTime.mockReset();
    });

    it("renders the matched default branch's name", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} />);

        expect(screen.getByText("Manama Branch")).toBeTruthy();
    });

    it("falls back to 'IC Pizza' when branches is empty", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);

        render(<BranchScheduleHeader branches={[]} />);

        expect(screen.getByText("IC Pizza")).toBeTruthy();
    });

    it("shows the closing time when isWithinWorkingHours is true", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);
        mockGetClosingTime.mockReturnValue("23:00");

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} />);

        expect(screen.getByText("Closes at 23:00")).toBeTruthy();
    });

    it("falls back to 'Open now' when open but no closing time can be resolved", () => {
        mockIsWithinWorkingHours.mockReturnValue(true);
        mockGetClosingTime.mockReturnValue(null);

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} />);

        expect(screen.getByText("Open now")).toBeTruthy();
    });

    it("shows next-opening text when isWithinWorkingHours is false", () => {
        mockIsWithinWorkingHours.mockReturnValue(false);
        mockGetTimeUntilNextOpening.mockReturnValue({ hours: 2, minutes: 15, nextOpeningMessage: null });

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} />);

        expect(screen.getByText("Opens in 2h 15m")).toBeTruthy();
    });

    it("shows the 'less than a minute' fallback when hours and minutes are both 0, mirroring ClosedPopup", () => {
        mockIsWithinWorkingHours.mockReturnValue(false);
        mockGetTimeUntilNextOpening.mockReturnValue({ hours: 0, minutes: 0, nextOpeningMessage: null });

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} />);

        expect(screen.getByText("less than a minute")).toBeTruthy();
    });

    it("prefers the explicit nextOpeningMessage when provided, mirroring ClosedPopup", () => {
        mockIsWithinWorkingHours.mockReturnValue(false);
        mockGetTimeUntilNextOpening.mockReturnValue({
            hours: 23, minutes: 30, nextOpeningMessage: "We open on Tuesday at 11:30",
        });

        render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} />);

        expect(screen.getByText("We open on Tuesday at 11:30")).toBeTruthy();
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
            mockGetTimeUntilNextOpening.mockReturnValue({ hours: 1, minutes: 0, nextOpeningMessage: null });

            render(<BranchScheduleHeader branches={[MATCHING_BRANCH]} />);

            expect(screen.getByText("Closes at 23:00")).toBeTruthy();

            mockIsWithinWorkingHours.mockReturnValue(false);
            act(() => {
                jest.advanceTimersByTime(60_000);
            });

            expect(screen.getByText("Opens in 1h 0m")).toBeTruthy();
        });
    });
});
