import { jest } from "@jest/globals";
import type { IBranch } from "../../../domains/management/inventory/types";
import type { BlackListCstmr } from "../../../domains/management/blacklist/types";
import type { WorkingHoursResponse, WorkingHoursRequest } from '../management';

// Manual mock for shared/api/management.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.

export const fetchAllBranches = jest.fn<Promise<IBranch[]>, []>();

export const getAllBannedCstmrs = jest.fn<Promise<BlackListCstmr[]>, []>();

export const getWorkingHours = jest.fn<Promise<WorkingHoursResponse | null>, [string]>();
export const putWorkingHours = jest.fn<Promise<WorkingHoursResponse>, [WorkingHoursRequest]>();
