export type ConsumptionReportTO = {
    id: number;
    title: string;
    branchNo: number
    userId: number;
    finalPrice: number;
    consumptionProducts: ConsumptionProductTO[]
    // Names of selected branches with no report for the resolved month -- a merged,
    // multi-branch report must never show a partial sum silently (MULTIBRANCH_SPEC.md Part 4).
    missingBranches?: string[] | null;
}

export type ConsumptionProductTO = {
    productName: string;
    quantity: number;
    finalPrice: number;
    // Money paid for this product in the month's purchase invoices (all vendors); not the consumption cost.
    spent: number;
    // Vendor of the product's most recent purchase invoice; null if never bought with a vendor.
    vendorName?: string | null;
}

export type SpendMonth = { month: string; spent: number };
export type MonthPrice = { month: string; unitPrice: number | null };
export type ProductPriceTrend = {
    productName: string;
    spent: number;
    prices: MonthPrice[];
    // Last vs first bought unit price in the window; null with fewer than two priced months.
    changePercent: number | null;
};
export type SpendHistoryTO = { months: SpendMonth[]; products: ProductPriceTrend[] };
