export type Row = {
    id: number;
    name: string;
    vendor: string;
    spent: number;
    usage: number;
    usagePerWeek: number;
    usagePerShift: number;
};

// Sentinel for the "no vendor" option of the vendor filter; no real vendor can be named this.
export const NO_VENDOR = "__no_vendor__";

export type RowSummary = {
    count: number;
    total: number;
};

export function filterRows(rows: Row[], nameQuery: string, vendor: string): Row[] {
    const query = nameQuery.trim().toLowerCase();
    return rows.filter((r) => {
        if (query && !r.name.toLowerCase().includes(query)) return false;
        if (vendor === NO_VENDOR) return r.vendor === "";
        return !vendor || r.vendor === vendor;
    });
}

export function summarizeRows(rows: Row[]): RowSummary {
    return {count: rows.length, total: rows.reduce((sum, r) => sum + r.spent, 0)};
}

export function distinctVendors(rows: Row[]): string[] {
    return Array.from(new Set(rows.map((r) => r.vendor).filter((v) => v !== ""))).sort((a, b) => a.localeCompare(b));
}
