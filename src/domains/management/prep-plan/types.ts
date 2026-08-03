import type { MeasureUnit as PrepPlanUnit } from "../../../shared/utils/unitFormat";

export type { PrepPlanUnit };

export type PrepPlanRow = {
    componentId: number;
    name: string;
    unit: PrepPlanUnit;
    yieldMultiplier: number;
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
