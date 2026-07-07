import { jest } from "@jest/globals";

// Manual mock for getTimeUntilNextOpening.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.
// Used by BranchScheduleHeader.test.tsx via jest.mock("../utils/getTimeUntilNextOpening").
type NextOpeningResult = {
    hours: number;
    minutes: number;
    nextOpeningMessage: string | null;
};

export const getTimeUntilNextOpening = jest.fn<NextOpeningResult, []>();
