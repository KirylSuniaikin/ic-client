import { jest } from "@jest/globals";

// Manual mock for getClosingTime.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.
// Used by BranchScheduleHeader.test.tsx via jest.mock("../utils/getClosingTime").
export const getClosingTime = jest.fn<string | null, []>();
