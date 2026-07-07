import { jest } from "@jest/globals";

// Manual mock for isWithinWorkingHours.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.
// Used by BranchScheduleHeader.test.tsx via jest.mock("../utils/isWithinWorkingHours").
export const isWithinWorkingHours = jest.fn<boolean, []>();
