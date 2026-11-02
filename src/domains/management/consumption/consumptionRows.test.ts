import {describe, it, expect} from "@jest/globals";
import {distinctVendors, filterRows, NO_VENDOR, Row, summarizeRows} from "./consumptionRows";

const row = (id: number, name: string, vendor: string, spent: number): Row => ({
    id, name, vendor, spent, usage: 1, usagePerWeek: 1, usagePerShift: 1,
});

const rows: Row[] = [
    row(0, "Mozzarella", "Gulf Dairy", 100),
    row(1, "Mozzarella Light", "Gulf Dairy", 20.5),
    row(2, "Flour", "Mill Co", 40),
    row(3, "Napkins", "", 5),
];

describe("filterRows", () => {
    it("returns every row when no filter is set", () => {
        expect(filterRows(rows, "", "")).toHaveLength(4);
    });

    it("matches the name case-insensitively as a substring", () => {
        expect(filterRows(rows, "  mozz", "").map((r) => r.id)).toEqual([0, 1]);
    });

    it("keeps only the chosen vendor's rows", () => {
        expect(filterRows(rows, "", "Mill Co").map((r) => r.id)).toEqual([2]);
    });

    it("keeps only vendor-less rows for the NO_VENDOR sentinel", () => {
        expect(filterRows(rows, "", NO_VENDOR).map((r) => r.id)).toEqual([3]);
    });

    it("combines name and vendor filters", () => {
        expect(filterRows(rows, "light", "Gulf Dairy").map((r) => r.id)).toEqual([1]);
        expect(filterRows(rows, "flour", "Gulf Dairy")).toEqual([]);
    });
});

describe("summarizeRows", () => {
    it("sums the spend and counts the rows", () => {
        expect(summarizeRows(rows)).toEqual({count: 4, total: 165.5});
    });

    it("is zero for an empty list", () => {
        expect(summarizeRows([])).toEqual({count: 0, total: 0});
    });
});

describe("distinctVendors", () => {
    it("lists each named vendor once, sorted, without the empty vendor", () => {
        expect(distinctVendors(rows)).toEqual(["Gulf Dairy", "Mill Co"]);
    });
});
