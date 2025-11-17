import { DoughUsageRow } from "../types/statTypes";

export const GRAMS_BY_TYPE: Record<string, number> = {
    "Brick Dough": 150,
    "S Dough": 200,
    "M Dough": 300,
    "L Dough": 360,
    "Other": 0
};

const w = (type: string) => GRAMS_BY_TYPE[type] ?? 0;

export function makeTotalsDynamic(rows: DoughUsageRow[], dateKeys: string[]): DoughUsageRow {
    const totals: DoughUsageRow = {
        id: "__total_row",
        doughType: "Total dough (grams)",
        isTotal: true
    };

    for (const date of dateKeys) {
        totals[date] = rows.reduce((acc, r) => {
            const qty = (r[date] as number) || 0;
            return acc + qty * w(r.doughType);
        }, 0);
    }

    return totals;
}