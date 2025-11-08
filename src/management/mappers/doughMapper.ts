import {DoughUsageRow} from "../types/statTypes";

export const GRAMS_BY_TYPE: Record<string, number> = {
    "Brick Dough": 150,
    "S Dough": 200,
    "M Dough": 300,
    "L Dough": 360,
};

const w = (type: string) => GRAMS_BY_TYPE[type] ?? 0;

export function makeTotalsInGrams(rows: DoughUsageRow[]): DoughUsageRow {
    const days: Array<keyof DoughUsageRow> = [
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    ];

    const totals: any = { id: "TOTAL", doughType: "Total dough", isTotal: true };

    for (const d of days) {
        totals[d] = rows.reduce((acc, r) => acc + (r[d] as number) * w(r.doughType), 0);
    }
    return totals as DoughUsageRow;
}