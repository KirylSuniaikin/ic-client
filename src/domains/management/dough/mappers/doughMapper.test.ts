import { describe, it, expect } from "@jest/globals";
import { makeTotalsDynamic, GRAMS_BY_TYPE } from "./doughMapper";
import type { DoughUsageRow } from "../../statistics/types";

describe("GRAMS_BY_TYPE", () => {
    it("maps Brick Dough to 150 g", () => {
        expect(GRAMS_BY_TYPE["Brick Dough"]).toBe(150);
    });

    it("maps S Dough to 200 g", () => {
        expect(GRAMS_BY_TYPE["S Dough"]).toBe(200);
    });

    it("maps M Dough to 300 g", () => {
        expect(GRAMS_BY_TYPE["M Dough"]).toBe(300);
    });

    it("maps L Dough to 360 g", () => {
        expect(GRAMS_BY_TYPE["L Dough"]).toBe(360);
    });

    it("maps Other to 0 g", () => {
        expect(GRAMS_BY_TYPE["Other"]).toBe(0);
    });
});

describe("makeTotalsDynamic", () => {
    it("sets id to __total_row", () => {
        const result = makeTotalsDynamic([], []);

        expect(result.id).toBe("__total_row");
    });

    it("sets doughType to 'Total dough (grams)'", () => {
        const result = makeTotalsDynamic([], []);

        expect(result.doughType).toBe("Total dough (grams)");
    });

    it("sets isTotal to true", () => {
        const result = makeTotalsDynamic([], []);

        expect(result.isTotal).toBe(true);
    });

    it("returns zero for each date key when rows is empty", () => {
        const result = makeTotalsDynamic([], ["2025-06-01", "2025-06-02"]);

        expect(result["2025-06-01"]).toBe(0);
        expect(result["2025-06-02"]).toBe(0);
    });

    it("calculates gram total for a single S Dough row — 2 units × 200 g = 400 g", () => {
        const rows: DoughUsageRow[] = [
            { id: "1", doughType: "S Dough", "2025-06-01": 2 },
        ];

        const result = makeTotalsDynamic(rows, ["2025-06-01"]);

        expect(result["2025-06-01"]).toBe(400);
    });

    it("calculates gram total for a single L Dough row — 3 units × 360 g = 1080 g", () => {
        const rows: DoughUsageRow[] = [
            { id: "1", doughType: "L Dough", "2025-06-01": 3 },
        ];

        const result = makeTotalsDynamic(rows, ["2025-06-01"]);

        expect(result["2025-06-01"]).toBe(1080);
    });

    it("sums multiple dough types for the same date — S(2×200) + M(1×300) = 700 g", () => {
        const rows: DoughUsageRow[] = [
            { id: "1", doughType: "S Dough", "2025-06-01": 2 },
            { id: "2", doughType: "M Dough", "2025-06-01": 1 },
        ];

        const result = makeTotalsDynamic(rows, ["2025-06-01"]);

        expect(result["2025-06-01"]).toBe(700);
    });

    it("calculates independent totals for each date key", () => {
        const rows: DoughUsageRow[] = [
            { id: "1", doughType: "S Dough", "2025-06-01": 1, "2025-06-02": 3 },
        ];

        const result = makeTotalsDynamic(rows, ["2025-06-01", "2025-06-02"]);

        expect(result["2025-06-01"]).toBe(200);
        expect(result["2025-06-02"]).toBe(600);
    });

    it("treats a missing date cell as 0 quantity", () => {
        const rows: DoughUsageRow[] = [
            { id: "1", doughType: "M Dough" /* no date key */ },
        ];

        const result = makeTotalsDynamic(rows, ["2025-06-01"]);

        expect(result["2025-06-01"]).toBe(0);
    });

    it("treats an unknown dough type as 0 grams-per-unit", () => {
        const rows: DoughUsageRow[] = [
            { id: "1", doughType: "XXL Dough", "2025-06-01": 5 },
        ];

        const result = makeTotalsDynamic(rows, ["2025-06-01"]);

        expect(result["2025-06-01"]).toBe(0);
    });

    it("does not include dateKeys that were not requested even if rows have them", () => {
        const rows: DoughUsageRow[] = [
            { id: "1", doughType: "S Dough", "2025-06-01": 2, "2025-06-03": 10 },
        ];

        const result = makeTotalsDynamic(rows, ["2025-06-01"]);

        expect(result["2025-06-03"]).toBeUndefined();
    });
});
