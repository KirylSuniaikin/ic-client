import type {
    IBranch,
    IManagementResponse,
    IUser,
    ProductTO,
    ReportTO
} from "../management/types";

export var PROD_BASE_HOST = "https://icpizza-back.onrender.com/api";
export var DEV_BASE_HOST = "http://localhost:8000/api";


export var URL = PROD_BASE_HOST;

export async function getBaseManagementReports(branchNo: number): Promise<IManagementResponse[]> {
    const res = await fetch(URL + `/base_management?branchNo=${branchNo}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as IManagementResponse[];
}

export async function createReport(payload: {
    inventoryProducts: { quantity: number; id: number; finalPrice: number }[];
    userId: number;
    title: string;
    type: string;
    branchNo: number
}) {
    const res = await fetch(URL + `/create_report`, {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response: ${res.text()}`);
    return res.text();
}


export async function editReport(payload: {
    inventoryProducts: { quantity: number; id: number; finalPrice: number }[];
    userId: number;
    id: number;
    title: any;
    type: string;
    branchNo: number
}) {
    const res = await fetch(URL + `/report_edit`, {
        method: "PUT",
        headers: {"Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Response:  ${res.text()}`);
    return res.text();
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
        headers: {"Content-Type": "application/json" }
    })
    if (!res.ok) throw new Error(`Response: ${res.status}`);
    return res.json();
}
