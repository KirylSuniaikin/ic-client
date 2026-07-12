import { jest } from "@jest/globals";
import type { IBranch, IManagementResponse, IUser, ProductTO, ReportTO } from "../../../domains/management/inventory/types";
import type { BlackListCstmr } from "../../../domains/management/blacklist/types";
import type {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseTO,
    VendorTO
} from "../../../domains/management/purchases/types";
import type { WorkingHoursResponse, WorkingHoursRequest } from '../management';

// Manual mock for shared/api/management.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.

export const fetchAllBranches = jest.fn<Promise<IBranch[]>, []>();

export const getAllBannedCstmrs = jest.fn<Promise<BlackListCstmr[]>, []>();

export const getWorkingHours = jest.fn<Promise<WorkingHoursResponse | null>, [string]>();
export const putWorkingHours = jest.fn<Promise<WorkingHoursResponse>, [WorkingHoursRequest]>();

// Purchase/Inventory popups (Phase 2 — decimal-placeholder component tests).
export const fetchProducts = jest.fn<Promise<ProductTO[]>, []>();
export const fetchVendors = jest.fn<Promise<VendorTO[]>, []>();
export const getUser = jest.fn<Promise<IUser>, [number]>();
export const createPurchaseReport = jest.fn<Promise<BasePurchaseResponse>, [CreatePurchasePayload]>();
export const editPurchaseReport = jest.fn<Promise<BasePurchaseResponse>, [EditPurchasePayload]>();
export const getPurchaseReport = jest.fn<Promise<PurchaseTO>, [{ id: number }]>();
export const createReport = jest.fn<Promise<IManagementResponse>, [Record<string, unknown>]>();
export const editReport = jest.fn<Promise<IManagementResponse>, [Record<string, unknown>]>();
export const getReport = jest.fn<Promise<ReportTO>, [number]>();
