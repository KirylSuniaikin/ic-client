import { jest } from "@jest/globals";
import type { IBranch, IManagementResponse, IUser, ProductTO, ReportTO } from "../../../domains/management/inventory/types";
import type { BlackListCstmr } from "../../../domains/management/blacklist/types";
import type {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    InvoiceImageMetaTO,
    PurchaseTO,
    SavePurchaseResponse,
    SetPurchaseInvoicePaidPayload,
    UnpaidInvoicesResponse,
    VendorTO
} from "../../../domains/management/purchases/types";
import type { WorkingHoursResponse, WorkingHoursRequest } from '../management';
import type { GetBranchEventsParams, GetBranchEventsResponse } from '../../../domains/management/cash-register/types';
import type {
    BoardOwner,
    ChangeTaskCardPriorityPayload,
    CreateTaskCardPayload,
    EditTaskCardPayload,
    MoveTaskCardPayload,
    TaskCard
} from '../../../domains/management/tasks/types';
import type {
    AccountingCategoryTO,
    AccountingReportSummary,
    AccountingReportTO,
    AccountingType,
    CreateAccountingReportPayload,
    EntryImageMetaTO,
    UpdateAccountingReportPayload
} from '../../../domains/management/accounting/types';

// Manual mock for shared/api/management.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.

export const fetchAllBranches = jest.fn<Promise<IBranch[]>, []>();
export const getBranchInfo = jest.fn<Promise<IBranch>, [string]>();

export const getAllBannedCstmrs = jest.fn<Promise<BlackListCstmr[]>, []>();

export const getWorkingHours = jest.fn<Promise<WorkingHoursResponse | null>, [string]>();
export const putWorkingHours = jest.fn<Promise<WorkingHoursResponse>, [WorkingHoursRequest]>();

// Purchase/Inventory popups (Phase 2 — decimal-placeholder component tests).
export const fetchProducts = jest.fn<Promise<ProductTO[]>, []>();
export const fetchVendors = jest.fn<Promise<VendorTO[]>, []>();
export const getUser = jest.fn<Promise<IUser>, [number]>();
export const createPurchaseReport = jest.fn<Promise<SavePurchaseResponse>, [CreatePurchasePayload]>();
export const editPurchaseReport = jest.fn<Promise<SavePurchaseResponse>, [EditPurchasePayload]>();
export const getPurchaseReport = jest.fn<Promise<PurchaseTO>, [{ id: number }]>();
// The real getReports is overloaded per report type; the mock returns the widest of those unions
// and callers narrow at the assertion site.
export const getReports = jest.fn<
    Promise<BasePurchaseResponse[] | IManagementResponse[]>,
    [{ branchId: string; reportType: string; from?: string; to?: string }]
>();
export const createReport = jest.fn<Promise<IManagementResponse>, [Record<string, unknown>]>();
export const editReport = jest.fn<Promise<IManagementResponse>, [Record<string, unknown>]>();
export const getReport = jest.fn<Promise<ReportTO>, [number]>();

export const uploadPurchaseInvoiceImage = jest.fn<Promise<InvoiceImageMetaTO>, [number, Blob]>();
export const fetchPurchaseInvoiceImage = jest.fn<Promise<Blob | null>, [number]>();
export const deletePurchaseInvoiceImage = jest.fn<Promise<void>, [number]>();
export const fetchUnpaidPurchaseInvoices = jest.fn<Promise<UnpaidInvoicesResponse>, [string]>();
export const setPurchaseInvoicePaid = jest.fn<Promise<void>, [SetPurchaseInvoicePaidPayload]>();

// Cash register transaction history (paged).
export const getBranchEvents = jest.fn<Promise<GetBranchEventsResponse>, [GetBranchEventsParams]>();

// Task board (ST4).
export const fetchTaskBoard = jest.fn<Promise<TaskCard[]>, [number?]>();
export const createTaskCard = jest.fn<Promise<TaskCard>, [CreateTaskCardPayload]>();
export const editTaskCard = jest.fn<Promise<TaskCard>, [number, EditTaskCardPayload]>();
export const changeTaskCardPriority = jest.fn<Promise<TaskCard>, [number, ChangeTaskCardPriorityPayload]>();
export const deleteTaskCard = jest.fn<Promise<void>, [number]>();
export const moveTaskCard = jest.fn<Promise<TaskCard>, [number, MoveTaskCardPayload]>();

// Board owners sidebar (ST6).
export const fetchBoardOwners = jest.fn<Promise<BoardOwner[]>, []>();

// Accounting reports.
export const getAccountingReports = jest.fn<Promise<AccountingReportSummary[]>, [string]>();
export const getAccountingReport = jest.fn<Promise<AccountingReportTO>, [number]>();
export const createAccountingReport = jest.fn<Promise<AccountingReportTO>, [CreateAccountingReportPayload]>();
export const updateAccountingReport = jest.fn<Promise<AccountingReportTO>, [number, UpdateAccountingReportPayload]>();
export const getAccountingCategories = jest.fn<Promise<AccountingCategoryTO[]>, [string, (AccountingType | undefined)?]>();

// Accounting entry photos.
export const uploadAccountingEntryImage = jest.fn<Promise<EntryImageMetaTO>, [number, Blob]>();
export const fetchAccountingEntryImage = jest.fn<Promise<Blob | null>, [number]>();
export const deleteAccountingEntryImage = jest.fn<Promise<void>, [number]>();
