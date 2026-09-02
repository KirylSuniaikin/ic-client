import type { SalarySlipForm } from '../../../domains/management/shift/types';
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
import type { WorkingHoursResponse, WorkingHoursRequest, SalarySlipDownload } from '../management';
import type { GeneratePrepPlanRequest, PrepPlanResponse } from '../../../domains/management/prep-plan/types';
import type { VatStatePayload, BusinessStatsResponse, CategoryClassification, ChannelOverridePatch, ChannelPerformanceRow, ChannelRegenerateResponse, ComponentCost, MenuCostCardsResponse, UpdateCategoryClassification, UpdateComponentCost } from '../../../domains/management/statistics/types';
import type { MonthlyShiftReport } from '../../../domains/management/shift/types';
import type { GetBranchEventsParams, GetBranchEventsResponse } from '../../../domains/management/cash-register/types';
import type { DoughStatus, DoughAvailabilityFlags } from '../../../domains/management/dough/types';
import type {
    BoardOwner,
    ChangeTaskCardPriorityPayload,
    CreateTaskCardPayload,
    EditTaskCardPayload,
    MoveTaskCardPayload,
    TaskCard,
    TaskCardImageMetaTO
} from '../../../domains/management/tasks/types';
import type {
    CurrentStaffTO,
    HireStaffRequest,
    HiredStaffTO,
    StaffAdminTO,
    UpdateStaffPayrollRequest
} from '../../../domains/management/staff/types';
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

// Task card photos.
export const uploadTaskCardImage = jest.fn<Promise<TaskCardImageMetaTO>, [number, Blob]>();
export const fetchTaskCardImage = jest.fn<Promise<Blob | null>, [number]>();
export const deleteTaskCardImage = jest.fn<Promise<void>, [number]>();

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

// Prep plan (Statistics -> Consumption tab; MULTIBRANCH_SPEC.md Part 4).
export const fetchCurrentPrepPlan = jest.fn<Promise<PrepPlanResponse | null>, [string]>();
export const generatePrepPlan = jest.fn<Promise<PrepPlanResponse>, [GeneratePrepPlanRequest]>();

// VAT report (Statistics -> Reports tab).
type VatStatsResponse = { totalOrders: number; totalRevenue: number; branchName: string };
export const getVatStats = jest.fn<Promise<VatStatsResponse>, [VatStatePayload]>();

// Monthly shift report (Statistics -> Shifts tab).
export const getMonthlyShiftReport = jest.fn<Promise<MonthlyShiftReport>, [string, string]>();

// Dough inventory (Config -> Menu tab).
export const getDoughInventory = jest.fn<Promise<DoughStatus>, [string]>();
export const putDoughInventory = jest.fn<Promise<DoughStatus>, [string, DoughStatus]>();
export const putDoughAvailability = jest.fn<Promise<DoughStatus>, [string, DoughAvailabilityFlags]>();

// Staff hiring (Task 2c).
export const hireStaff = jest.fn<Promise<HiredStaffTO>, [HireStaffRequest]>();
export const getStaffAdminList = jest.fn<Promise<StaffAdminTO[]>, [string?]>();
export const resetStaffPassword = jest.fn<Promise<void>, [number, string]>();
export const setStaffEnabled = jest.fn<Promise<StaffAdminTO>, [number, boolean]>();
export const setStaffBranch = jest.fn<Promise<StaffAdminTO>, [number, string]>();
export const getCurrentStaff = jest.fn<Promise<CurrentStaffTO>, []>();

// Salary slip PDF (Phase F6/F7/F8).
export const updateStaffPayroll = jest.fn<Promise<StaffAdminTO>, [number, UpdateStaffPayrollRequest]>();
export const getSalarySlipPreview = jest.fn<Promise<SalarySlipForm>, [number, string]>();
export const downloadSalarySlip = jest.fn<Promise<SalarySlipDownload>, [number, string, SalarySlipForm]>();

// Business Stats (Statistics -> Business tab).
export const getBusinessCategories = jest.fn<Promise<CategoryClassification[]>, []>();
export const updateCategoryClassification =
    jest.fn<Promise<CategoryClassification>, [number, UpdateCategoryClassification]>();
export const getBusinessStats = jest.fn<Promise<BusinessStatsResponse>, [string, string]>();
export const regenerateChannelPerformance =
    jest.fn<Promise<ChannelRegenerateResponse>, [string, string]>();
export const patchChannelPerformance =
    jest.fn<Promise<ChannelPerformanceRow>, [number, ChannelOverridePatch]>();
export const getMenuCostCards = jest.fn<Promise<MenuCostCardsResponse>, []>();
export const getComponentCosts = jest.fn<Promise<ComponentCost[]>, []>();
export const updateComponentCost = jest.fn<Promise<ComponentCost>, [number, UpdateComponentCost]>();
