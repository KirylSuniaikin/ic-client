import type {
    IBranch,
    IManagementResponse,
    IUser,
    ProductTO,
    ReportTO
} from "../types/inventoryTypes";
import {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseTO,
    VendorTO
} from "../types/purchaseTypes";
import {ConsumptionReportTO} from "../types/consumptionTypes";
import {BaseShiftResponse, CreateShiftReportTO, EditShiftReportTO, ShiftReportTO} from "../types/shiftTypes";

export var PROD_BASE_HOST = "https://icpizza-back.onrender.com/api";
export var DEV_BASE_HOST = "http://localhost:8000/api";


export var URL = PROD_BASE_HOST;

export async function getBaseManagementReports(branchNo: number): Promise<IManagementResponse[]> {
    const res = await fetch(URL + `/base_management?branchNo=${branchNo}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as IManagementResponse[];
}

export async function createReport(payload: {
    inventoryProducts: { quantity: number; finalPrice: number; id: number }[];
    finalPrice: number;
    title: string;
    type: string;
    userId: number;
    branchNo: number
}): Promise<IManagementResponse> {
    const res = await fetch(URL + `/create_report`, {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response: ${res.text()}`);
    return await res.json() as IManagementResponse;
}


export async function editReport(payload: {
    inventoryProducts: { quantity: number; finalPrice: number; id: number }[];
    finalPrice: number;
    id: number;
    type: string;
    title: string;
    userId: number;
    branchNo: number
}): Promise<IManagementResponse> {
    const res = await fetch(URL + `/report_edit`, {
        method: "PUT",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response:  ${res.text()}`);
    return await res.json() as IManagementResponse;
}

export async function getReport(reportId: number ): Promise<ReportTO> {
    const res = await fetch(URL + `/get_report?reportId=${reportId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return (await res.json()) as ReportTO;
}

export async function getBranchInfo(branchNo: number): Promise<IBranch> {
    const res = await fetch(URL + `/branch/get_branch_info?branchNumber=${branchNo}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" },
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchProducts(): Promise<ProductTO[]> {
    const res = await fetch(URL + `/fetch_products`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    });
    if(!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getUser(userId: number): Promise<IUser> {
    const res = await fetch(URL + `/get_user?userId=${userId}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" },
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchVendors(): Promise<VendorTO[]> {
    const res = await fetch(URL + `/get_all_vendors`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchPurchaseReports(): Promise<BasePurchaseResponse[]> {
    const res = await fetch(URL + `/get_purchase_reports`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function createPurchaseReport(payload: CreatePurchasePayload): Promise<BasePurchaseResponse> {
    const res = await fetch(URL + `/create_purchase_report`, {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getPurchaseReport(payload:{id: number}): Promise<PurchaseTO> {
    const res = await fetch(URL + `/get_purchase_report?id=${payload.id}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function editPurchaseReport(payload: EditPurchasePayload) : Promise<BasePurchaseResponse> {
    const res = await fetch(URL + `/edit_purchase_report`, {
        method: "PUT",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchLatestConsumptionReport(): Promise<ConsumptionReportTO> {
    const res = await fetch(URL + `/get_consumption_report`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function fetchShiftReports(): Promise<BaseShiftResponse[]> {
    const res = await fetch(URL + `/get_all_shift_reports`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function createShiftReport(payload: CreateShiftReportTO): Promise<BaseShiftResponse> {
    const res = await fetch(URL + `/create_shift_report`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function editShiftReport(payload: EditShiftReportTO): Promise<BaseShiftResponse> {
    const res = await fetch(URL + `/edit_shift_report`, {
        method: "PUT",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}

export async function getShiftReport(payload:{id: number}): Promise<ShiftReportTO> {
    const res = await fetch(URL + `/get_shift_report?id=${payload.id}`, {
        method: "GET",
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}