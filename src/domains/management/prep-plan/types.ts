export type PrepPlanUnit = "GRAMS" | "PIECES" | "ML";

export type PrepPlanRow = {
    componentId: number;
    name: string;
    unit: PrepPlanUnit;
    amount: number;
};

export type PrepPlanResponse = {
    reportId: number;
    createdAt: string; // ISO-8601 datetime string
    rows: PrepPlanRow[];
};

export type GeneratePrepPlanRequest = {
    branchId: string;
    fromDate?: string;
    toDate?: string;
};
