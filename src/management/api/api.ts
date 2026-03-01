import type {IBranch, IManagementResponse, IUser, ProductTO, ReportTO} from "../types/inventoryTypes";
import {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseTO,
    VendorTO
} from "../types/purchaseTypes";
import {ConsumptionReportTO} from "../types/consumptionTypes";
import {BaseShiftResponse, CreateShiftReportTO, EditShiftReportTO, ShiftReportTO} from "../types/shiftTypes";
import {VatStatePayload} from "../types/statTypes";
import {BlackListCstmr} from "../types/blacklistTypes";
import {BranchBalanceResponse, CashRegisterEventTO, CashUpdateRequest} from "../types/branchBalanceTypes";
import {AuthRequest, AuthResponse} from "../types/authTypes";

export var PROD_BASE_HOST = "https://icpizza-back.onrender.com/api";
export var DEV_BASE_HOST = "http://localhost:8000/api";


export var URL = PROD_BASE_HOST;

export async function authFetch(url: string, headersWithoutAuth: RequestInit): Promise<Response> {
    const token = localStorage.getItem("jwt_token");

    const headers = new Headers(headersWithoutAuth?.headers);

    if(token){
        headers.set("Authorization", "Bearer " + token);
    }

    const response = await fetch(url, {
        ...headersWithoutAuth,
        headers
    })

    if(response.status === 401){
        console.warn("Unauthorized");
        localStorage.removeItem("jwt_token");
        window.location.href = "/auth";
        return Promise.reject(new Error("Unauthorized"));
    }

    return response;
}

export async function getBaseManagementReports(branchId: string): Promise<IManagementResponse[]> {
    const res = await authFetch(URL + `/base_management?branchId=${branchId}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as IManagementResponse[];
}

export async function fetchAllBranches(): Promise<IBranch[]> {
    const res = await authFetch(URL + '/branch/fetch_branches', { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as IBranch[];
}

export async function createReport(payload: {
    inventoryProducts: { storageQuantity: number;kitchenQuantity: number; finalPrice: number; id: number }[];
    finalPrice: number;
    title: string;
    type: string;
    userId: number;
    branchNo: number
}): Promise<IManagementResponse> {
    const res = await authFetch(URL + `/create_report`, {
        method: "POST",
        headers: {"Content-Type": "application/json" },
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
    const res = await authFetch(URL + `/report_edit`, {
        method: "PUT",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response:  ${res.text()}`);
    return await res.json() as IManagementResponse;
}

export async function getReport(reportId: number ): Promise<ReportTO> {
    const res = await authFetch(URL + `/get_report?reportId=${reportId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return (await res.json()) as ReportTO;
}

export async function getBranchInfo(branchId: string): Promise<IBranch> {
    const res = await authFetch(URL + `/branch/get_branch_info?branchId=${branchId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" },
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchProducts(): Promise<ProductTO[]> {
    const res = await authFetch(URL + `/fetch_products`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    });
    if(!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getUser(userId: number): Promise<IUser> {
    const res = await authFetch(URL + `/get_user?userId=${userId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" },
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchVendors(): Promise<VendorTO[]> {
    const res = await authFetch(URL + `/get_all_vendors`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchPurchaseReports(branchId: string): Promise<BasePurchaseResponse[]> {
    const res = await authFetch(URL + `/get_purchase_reports?branchId=${branchId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function createPurchaseReport(payload: CreatePurchasePayload): Promise<BasePurchaseResponse> {
    const res = await authFetch(URL + `/create_purchase_report`, {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getPurchaseReport(payload:{id: number}): Promise<PurchaseTO> {
    const res = await authFetch(URL + `/get_purchase_report?id=${payload.id}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function editPurchaseReport(payload: EditPurchasePayload) : Promise<BasePurchaseResponse> {
    const res = await authFetch(URL + `/edit_purchase_report`, {
        method: "PUT",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchLatestConsumptionReport(branchId: string): Promise<ConsumptionReportTO> {
    const res = await authFetch(URL + `/get_consumption_report?branchId=${branchId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchShiftReports(branchId: string): Promise<BaseShiftResponse[]> {
    const res = await authFetch(URL + `/get_all_shift_reports?branchId=${branchId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function createShiftReport(payload: CreateShiftReportTO): Promise<BaseShiftResponse> {
    const res = await authFetch(URL + `/create_shift_report`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function editShiftReport(payload: EditShiftReportTO): Promise<BaseShiftResponse> {
    const res = await authFetch(URL + `/edit_shift_report`, {
        method: "PUT",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getShiftReport(payload:{id: number}): Promise<ShiftReportTO> {
    const res = await authFetch(URL + `/get_shift_report?id=${payload.id}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getVatStats(payload:VatStatePayload ){
    const params = new URLSearchParams({
        branchId: payload.branchId,
        fromDate: payload.fromDate,
        toDate: payload.toDate
    });

    const res = await authFetch(URL + `/branch/get_vat_stats?${params}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })

    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return await res.json();
}

export async function addToBlackList(payload: {telephoneNo: string}){
    return await authFetch(URL + `/blacklist/add`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });
}

export async function deleteFromBlackList(payload:{telephoneNo: string}){
    return await authFetch(URL + `/blacklist/delete`, {
        method: "DELETE",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
}

export async function getAllBannedCstmrs(): Promise<BlackListCstmr[]>{
    const res = await authFetch(URL + `/blacklist/get_all`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })

    if (!res.ok) throw new Error(`Response: ${res.status}`);

    return res.json();
}

export async function cashUpdate(payload: CashUpdateRequest){
    return await authFetch(URL + `/branch/cash_update`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
    })
}

export async function getBranchBalance(branchId: string): Promise<BranchBalanceResponse>{
    const res = await authFetch(URL + `/branch/get_branch_balance?branchId=${branchId}`, {
        method: "GET",
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getBranchEvents(branchId: string): Promise<CashRegisterEventTO[]> {
    const res = await authFetch(`${URL}/branch/get_transactions?branchId=${branchId}`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
}

export async function initiateAuth(authRequest: AuthRequest) {
    return await fetch(`${URL}/auth/login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(authRequest),
    })
}