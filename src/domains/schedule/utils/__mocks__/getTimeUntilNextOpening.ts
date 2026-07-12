import { jest } from "@jest/globals";

// Manual mock for getTimeUntilNextOpening.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.
// Used by BranchScheduleHeader.test.tsx via jest.mock("../utils/getTimeUntilNextOpening").
import type { NextOpeningResult } from "../getTimeUntilNextOpening";

export const getTimeUntilNextOpening = jest.fn<NextOpeningResult, []>();
