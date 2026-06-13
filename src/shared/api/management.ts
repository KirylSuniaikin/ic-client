import { authFetch, BASE_URL } from './client';
import type { IBranch, IManagementResponse, IUser, ProductTO, ReportTO } from '../../domains/management/inventory/types';
import type { DoughAvailabilityFlags, DoughInventory, DoughStatus } from '../../domains/management/dough/types';
import type { GeneratePrepPlanRequest, PrepPlanResponse } from '../../domains/management/prep-plan/types';
import type {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseTO,
    VendorTO
} from '../../domains/management/purchases/types';
import type { ConsumptionReportTO } from '../../domains/management/consumption/types';
import type {
    BaseShiftResponse,
    CreateShiftReportTO,
    EditShiftReportTO,
    MonthlyShiftReport,
    ShiftReportTO,
    StaffOption
} from '../../domains/management/shift/types';
import type { VatStatePayload } from '../../domains/management/statistics/types';
import type { BlackListCstmr } from '../../domains/management/blacklist/types';
import type { BranchBalanceResponse, CashRegisterEventTO, CashUpdateRequest } from '../../domains/management/cash-register/types';
import type { AuthRequest } from '../../domains/auth/types';
import type {
    AccountingCategoryTO,
    AccountingReportSummary,
    AccountingReportTO,
    AccountingType,
    CreateAccountingReportPayload,
    UpdateAccountingReportPayload
} from '../../domains/management/accounting/types';

type VatStatsResponse = { totalOrders: number; totalRevenue: number; branchName: string };

type ListableReportType = 'INVENTORY' | 'PURCHASE' | 'SHIFT_REPORT';

type GetReportsParams<T extends ListableReportType> = {
    branchId: string;
    reportType: T;
    from?: string;
    to?: string;
};

export async function getReports(params: GetReportsParams<'INVENTORY'>): Promise<IManagementResponse[]>;
export async function getReports(params: GetReportsParams<'PURCHASE'>): Promise<BasePurchaseResponse[]>;
export async function getReports(params: GetReportsParams<'SHIFT_REPORT'>): Promise<BaseShiftResponse[]>;
export async function getReports(
    params: GetReportsParams<ListableReportType>
): Promise<IManagementResponse[] | BasePurchaseResponse[] | BaseShiftResponse[]> {
    const query = new URLSearchParams({ branchId: params.branchId, reportType: params.reportType });
    if (params.from !== undefined) query.set('from', params.from);
    if (params.to !== undefined) query.set('to', params.to);
    const res = await authFetch(BASE_URL + `/reports?${query}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchAllBranches(): Promise<IBranch[]> {
    const res = await authFetch(BASE_URL + '/branch/fetch_branches', { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as IBranch[];
}

export async function createReport(payload: {
    inventoryProducts: { storageQuantity: number; kitchenQuantity: number; finalPrice: number; id: number }[];
    finalPrice: number;
    title: string;
    type: string;
    userId: number;
    branchNo: number
}): Promise<IManagementResponse> {
    const res = await authFetch(BASE_URL + `/create_report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response: ${res.text()}`);
    return await res.json() as IManagementResponse;
}

export async function editReport(payload: {
    inventoryProducts: { storageQuantity: number; kitchenQuantity: number; finalPrice: number; id: number }[];
    finalPrice: number;
    id: number;
    type: string;
    title: string;
    userId: number;
    branchNo: number
}): Promise<IManagementResponse> {
    const res = await authFetch(BASE_URL + `/report_edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response:  ${res.text()}`);
    return await res.json() as IManagementResponse;
}

export async function getReport(reportId: number): Promise<ReportTO> {
    const res = await authFetch(BASE_URL + `/get_report?reportId=${reportId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return (await res.json()) as ReportTO;
}

export async function getBranchInfo(branchId: string): Promise<IBranch> {
    const res = await authFetch(BASE_URL + `/branch/get_branch_info?branchId=${branchId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchProducts(): Promise<ProductTO[]> {
    const res = await authFetch(BASE_URL + `/fetch_products`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getUser(userId: number): Promise<IUser> {
    const res = await authFetch(BASE_URL + `/get_user?userId=${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchVendors(): Promise<VendorTO[]> {
    const res = await authFetch(BASE_URL + `/get_all_vendors`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function createPurchaseReport(payload: CreatePurchasePayload): Promise<BasePurchaseResponse> {
    const res = await authFetch(BASE_URL + `/create_purchase_report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getPurchaseReport(payload: { id: number }): Promise<PurchaseTO> {
    const res = await authFetch(BASE_URL + `/get_purchase_report?id=${payload.id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function editPurchaseReport(payload: EditPurchasePayload): Promise<BasePurchaseResponse> {
    console.log(payload);
    const res = await authFetch(BASE_URL + `/edit_purchase_report`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchLatestConsumptionReport(branchId: string): Promise<ConsumptionReportTO> {
    const res = await authFetch(BASE_URL + `/get_consumption_report?branchId=${branchId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function createShiftReport(payload: CreateShiftReportTO): Promise<BaseShiftResponse> {
    const res = await authFetch(BASE_URL + `/create_shift_report`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function editShiftReport(payload: EditShiftReportTO): Promise<BaseShiftResponse> {
    const res = await authFetch(BASE_URL + `/edit_shift_report`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getShiftReport(payload: { id: number }): Promise<ShiftReportTO> {
    const res = await authFetch(BASE_URL + `/get_shift_report?id=${payload.id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getVatStats(payload: VatStatePayload): Promise<VatStatsResponse> {
    const params = new URLSearchParams({
        branchId: payload.branchId,
        fromDate: payload.fromDate,
        toDate: payload.toDate
    });

    const res = await authFetch(BASE_URL + `/branch/get_vat_stats?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return await res.json();
}

export async function addToBlackList(payload: { telephoneNo: string }): Promise<Response> {
    return await authFetch(BASE_URL + `/blacklist/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function deleteFromBlackList(payload: { telephoneNo: string }): Promise<Response> {
    return await authFetch(BASE_URL + `/blacklist/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function getAllBannedCstmrs(): Promise<BlackListCstmr[]> {
    const res = await authFetch(BASE_URL + `/blacklist/get_all`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error(`Response: ${res.status}`);

    return res.json();
}

export async function cashUpdate(payload: CashUpdateRequest): Promise<Response> {
    return await authFetch(BASE_URL + `/branch/cash_update`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
    });
}

export async function getBranchBalance(branchId: string): Promise<BranchBalanceResponse> {
    const res = await authFetch(BASE_URL + `/branch/get_branch_balance?branchId=${branchId}`, {
        method: "GET",
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getBranchEvents(branchId: string): Promise<CashRegisterEventTO[]> {
    const res = await authFetch(`${BASE_URL}/branch/get_transactions?branchId=${branchId}`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
}

export async function getMonthlyShiftReport(
    branchId: string,
    yearMonth: string
): Promise<MonthlyShiftReport> {
    const params = new URLSearchParams({ branchId, yearMonth });
    const res = await authFetch(BASE_URL + `/shift_monthly_report?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getStaffByBranch(branchId: string): Promise<StaffOption[]> {
    const res = await authFetch(BASE_URL + `/staff_by_branch?branchId=${branchId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function initiateAuth(authRequest: AuthRequest): Promise<Response> {
    return await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authRequest),
    });
}

export async function getAccountingReports(branchId: string): Promise<AccountingReportSummary[]> {
    const params = new URLSearchParams({ branchId });
    const res = await authFetch(BASE_URL + `/accounting/reports?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function getAccountingReport(id: number): Promise<AccountingReportTO> {
    const res = await authFetch(BASE_URL + `/accounting/reports/${id}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function createAccountingReport(payload: CreateAccountingReportPayload): Promise<AccountingReportTO> {
    const res = await authFetch(BASE_URL + `/accounting/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function updateAccountingReport(id: number, payload: UpdateAccountingReportPayload): Promise<AccountingReportTO> {
    const res = await authFetch(BASE_URL + `/accounting/reports/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function getAccountingCategories(branchId: string, type?: AccountingType): Promise<AccountingCategoryTO[]> {
    const params = new URLSearchParams({ branchId });
    if (type !== undefined) {
        params.append("type", type);
    }
    const res = await authFetch(BASE_URL + `/accounting/categories?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchCurrentPrepPlan(branchId: number): Promise<PrepPlanResponse | null> {
    const res = await authFetch(BASE_URL + `/prep-plan/current?branch_id=${branchId}`, {
        method: "GET",
        headers: { Accept: "application/json" },
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function generatePrepPlan(payload: GeneratePrepPlanRequest): Promise<PrepPlanResponse> {
    const res = await authFetch(BASE_URL + `/prep-plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function getDoughInventory(branchId: string): Promise<DoughStatus> {
    const res = await authFetch(BASE_URL + `/branches/${branchId}/dough-inventory`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function putDoughInventory(branchId: string, body: DoughInventory): Promise<DoughStatus> {
    const res = await authFetch(BASE_URL + `/branches/${branchId}/dough-inventory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function putDoughAvailability(
    branchId: string,
    availability: DoughAvailabilityFlags,
): Promise<DoughStatus> {
    const res = await authFetch(BASE_URL + `/branches/${branchId}/dough-availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(availability),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

