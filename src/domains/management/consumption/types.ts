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
}
