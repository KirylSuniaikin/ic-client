import { describe, it, expect } from "@jest/globals";
import {
    applyEntryView,
    areRowsEqual,
    DEFAULT_SORTS,
    EMPTY_FILTERS,
    isDefaultView,
    nextSorts,
    nextTypeFilter,
    setSortDir,
    unsavedRowKeys,
} from "./entryView";
import type { DirtyRow, EntryFilters, EntrySort, EntryViewContext } from "./entryView";

type TestRow = DirtyRow & { runningBalance: number | null; contributorName: string | null };

let seq = 0;
function row(overrides: Partial<TestRow> = {}): TestRow {
    seq += 1;
    return {
        _key: `k${seq}`,
        id: seq,
        date: "2026-07-01T00:00",
        type: "DEBIT",
        amount: "10",
        note: "",
        account: null,
        categoryId: null,
        hasImage: false,
        pendingImage: null,
        removeImage: false,
        runningBalance: null,
        contributorName: null,
        ...overrides,
    };
}

const CTX: EntryViewContext = {
    categoryNameById: new Map([
        [1, "Sales"],
        [2, "Supplies"],
        [3, "Rent"],
    ]),
};

const view = (rows: TestRow[], sorts: EntrySort[], filters: Partial<EntryFilters> = {}, ctx = CTX) =>
    applyEntryView(rows, { ...EMPTY_FILTERS, ...filters }, sorts, ctx);

const keys = (rows: TestRow[]) => rows.map((r) => r._key);

describe("applyEntryView sorting", () => {
    it("sorts by date both ways", () => {
        const a = row({ date: "2026-07-01T00:00" });
        const b = row({ date: "2026-07-03T00:00" });
        const c = row({ date: "2026-07-02T00:00" });
        expect(keys(view([a, b, c], [{ column: "date", dir: "asc" }]))).toEqual([a._key, c._key, b._key]);
        expect(keys(view([a, b, c], [{ column: "date", dir: "desc" }]))).toEqual([b._key, c._key, a._key]);
    });

    it("sorts amount numerically so 9 < 10", () => {
        const nine = row({ amount: "9" });
        const ten = row({ amount: "10" });
        expect(keys(view([ten, nine], [{ column: "amount", dir: "asc" }]))).toEqual([nine._key, ten._key]);
        expect(keys(view([nine, ten], [{ column: "amount", dir: "desc" }]))).toEqual([ten._key, nine._key]);
    });

    it("sorts notes case-insensitively", () => {
        const a = row({ note: "banana" });
        const b = row({ note: "Apple" });
        const c = row({ note: "cherry" });
        expect(keys(view([a, b, c], [{ column: "note", dir: "asc" }]))).toEqual([b._key, a._key, c._key]);
        expect(keys(view([a, b, c], [{ column: "note", dir: "desc" }]))).toEqual([c._key, a._key, b._key]);
    });

    it("sorts accounts by label", () => {
        const card = row({ account: "DEBIT_CARD" });
        const cash = row({ account: "CASH" });
        const corp = row({ account: "CORPORATE_ACCOUNT" });
        // Labels: Cash < Corporate Account < Debit Card
        expect(keys(view([card, cash, corp], [{ column: "account", dir: "asc" }]))).toEqual([
            cash._key,
            corp._key,
            card._key,
        ]);
        expect(keys(view([card, cash, corp], [{ column: "account", dir: "desc" }]))).toEqual([
            card._key,
            corp._key,
            cash._key,
        ]);
    });

    it("sorts categories by name", () => {
        const sales = row({ categoryId: 1 });
        const supplies = row({ categoryId: 2 });
        const rent = row({ categoryId: 3 });
        expect(keys(view([sales, supplies, rent], [{ column: "category", dir: "asc" }]))).toEqual([
            rent._key,
            sales._key,
            supplies._key,
        ]);
        expect(keys(view([sales, supplies, rent], [{ column: "category", dir: "desc" }]))).toEqual([
            supplies._key,
            sales._key,
            rent._key,
        ]);
    });

    const blankCases: [string, EntrySort["column"], Partial<TestRow>, Partial<TestRow>][] = [
        ["blank amount", "amount", { amount: "" }, { amount: "5" }],
        ["empty note", "note", { note: "" }, { note: "x" }],
        ["null account", "account", { account: null }, { account: "CASH" }],
        ["null category", "category", { categoryId: null }, { categoryId: 1 }],
        ["unknown category", "category", { categoryId: 99 }, { categoryId: 1 }],
    ];
    it.each(blankCases)("puts %s last in both directions", (_label, column, blankPatch, filledPatch) => {
        const blank = row(blankPatch);
        const filled = row(filledPatch);
        expect(keys(view([blank, filled], [{ column, dir: "asc" }]))).toEqual([filled._key, blank._key]);
        expect(keys(view([blank, filled], [{ column, dir: "desc" }]))).toEqual([filled._key, blank._key]);
    });

    it("resolves ties on the first sort with the second, and priority order matters", () => {
        const a = row({ date: "2026-07-01T00:00", amount: "5" });
        const b = row({ date: "2026-07-01T00:00", amount: "9" });
        const c = row({ date: "2026-07-02T00:00", amount: "1" });
        const dateThenAmount: EntrySort[] = [
            { column: "date", dir: "desc" },
            { column: "amount", dir: "desc" },
        ];
        const amountThenDate: EntrySort[] = [
            { column: "amount", dir: "desc" },
            { column: "date", dir: "desc" },
        ];
        expect(keys(view([a, b, c], dateThenAmount))).toEqual([c._key, b._key, a._key]);
        expect(keys(view([a, b, c], amountThenDate))).toEqual([b._key, a._key, c._key]);
    });

    it("breaks final ties by insertion order, latest first", () => {
        const a = row();
        const b = row();
        const c = row();
        expect(keys(view([a, b, c], DEFAULT_SORTS as EntrySort[]))).toEqual([c._key, b._key, a._key]);
        expect(keys(view([a, b, c], []))).toEqual([c._key, b._key, a._key]);
    });

    it("honours an explicit insertionIndex", () => {
        const a = row();
        const b = row();
        const insertionIndex = new Map([
            [a._key, 5],
            [b._key, 1],
        ]);
        expect(keys(view([a, b], [], {}, { ...CTX, insertionIndex }))).toEqual([a._key, b._key]);
    });
});

describe("applyEntryView filtering", () => {
    it("filters by type", () => {
        const d = row({ type: "DEBIT" });
        const c = row({ type: "CREDIT" });
        expect(keys(view([d, c], [], { type: "DEBIT" }))).toEqual([d._key]);
        expect(keys(view([d, c], [], { type: "CREDIT" }))).toEqual([c._key]);
        expect(view([d, c], [], { type: "ALL" })).toHaveLength(2);
    });

    it("matches notes as a trimmed, case-insensitive contains; blank is no filter", () => {
        const rent = row({ note: "Monthly RENT" });
        const other = row({ note: "milk" });
        expect(keys(view([rent, other], [], { note: "  rent " }))).toEqual([rent._key]);
        expect(view([rent, other], [], { note: "   " })).toHaveLength(2);
    });

    it("ORs within accounts and lets None match null", () => {
        const cash = row({ account: "CASH" });
        const card = row({ account: "DEBIT_CARD" });
        const none = row({ account: null });
        expect(keys(view([cash, card, none], [], { accounts: ["CASH", "DEBIT_CARD"] })).sort()).toEqual(
            [cash._key, card._key].sort()
        );
        expect(keys(view([cash, card, none], [], { accounts: ["NONE"] }))).toEqual([none._key]);
    });

    it("filters by category multiselect", () => {
        const a = row({ categoryId: 1 });
        const b = row({ categoryId: 2 });
        const c = row({ categoryId: null });
        expect(keys(view([a, b, c], [], { categoryIds: [1, 2] })).sort()).toEqual([a._key, b._key].sort());
    });

    it("ANDs across columns", () => {
        const hit = row({ type: "DEBIT", account: "CASH", note: "rent" });
        const wrongType = row({ type: "CREDIT", account: "CASH", note: "rent" });
        const wrongAccount = row({ type: "DEBIT", account: "DEBIT_CARD", note: "rent" });
        expect(
            keys(view([hit, wrongType, wrongAccount], [], { type: "DEBIT", accounts: ["CASH"], note: "rent" }))
        ).toEqual([hit._key]);
    });

    it("never hides unsaved rows, and still sorts them", () => {
        const saved = row({ amount: "1" });
        const fresh = row({ id: undefined, amount: "50", type: "CREDIT" });
        const result = view([saved, fresh], [{ column: "amount", dir: "desc" }], {
            type: "DEBIT",
            note: "zzz",
            accounts: ["CASH"],
            categoryIds: [3],
        });
        expect(keys(result)).toEqual([fresh._key]);
        const both = view([saved, fresh], [{ column: "amount", dir: "desc" }]);
        expect(keys(both)).toEqual([fresh._key, saved._key]);
    });
});

describe("applyEntryView purity", () => {
    it("does not mutate the input array or rows and returns the same references", () => {
        const a = row({ date: "2026-07-01T00:00", runningBalance: 5 });
        const b = row({ date: "2026-07-02T00:00", runningBalance: 7 });
        const input = [a, b];
        const snapshot = JSON.stringify(input);

        const result = view(input, [{ column: "date", dir: "desc" }]);

        expect(result).not.toBe(input);
        expect(input).toEqual([a, b]);
        expect(input[0]).toBe(a);
        expect(JSON.stringify(input)).toBe(snapshot);
        expect(result[0]).toBe(b);
        expect(result[1]).toBe(a);
        expect(result.map((r) => r.runningBalance)).toEqual([7, 5]);
    });
});

describe("nextSorts", () => {
    it("appends a new column at lowest priority with its default direction", () => {
        expect(nextSorts([{ column: "date", dir: "desc" }], "amount")).toEqual([
            { column: "date", dir: "desc" },
            { column: "amount", dir: "desc" },
        ]);
        expect(nextSorts([], "note")).toEqual([{ column: "note", dir: "asc" }]);
    });

    it("runs the full three-step cycle", () => {
        const step1 = nextSorts([], "note");
        const step2 = nextSorts(step1, "note");
        const step3 = nextSorts(step2, "note");
        expect(step1).toEqual([{ column: "note", dir: "asc" }]);
        expect(step2).toEqual([{ column: "note", dir: "desc" }]);
        expect(step3).toEqual([]);
    });

    it("keeps the priority slot on reversal and closes up on removal", () => {
        const start: EntrySort[] = [
            { column: "date", dir: "desc" },
            { column: "amount", dir: "desc" },
            { column: "note", dir: "asc" },
        ];
        const reversed = nextSorts(start, "amount");
        expect(reversed.map((s) => `${s.column}:${s.dir}`)).toEqual(["date:desc", "amount:asc", "note:asc"]);
        expect(nextSorts(reversed, "amount").map((s) => s.column)).toEqual(["date", "note"]);
    });

    it("does not mutate its input", () => {
        const start: EntrySort[] = [{ column: "date", dir: "desc" }];
        nextSorts(start, "date");
        expect(start).toEqual([{ column: "date", dir: "desc" }]);
    });
});

describe("nextTypeFilter / isDefaultView", () => {
    it("cycles All -> Debit -> Credit -> All", () => {
        expect(nextTypeFilter("ALL")).toBe("DEBIT");
        expect(nextTypeFilter("DEBIT")).toBe("CREDIT");
        expect(nextTypeFilter("CREDIT")).toBe("ALL");
    });

    it("recognises the default view only", () => {
        expect(isDefaultView(EMPTY_FILTERS, DEFAULT_SORTS)).toBe(true);
        expect(isDefaultView({ ...EMPTY_FILTERS, type: "DEBIT" }, DEFAULT_SORTS)).toBe(false);
        expect(isDefaultView({ ...EMPTY_FILTERS, note: "  " }, DEFAULT_SORTS)).toBe(true);
        expect(isDefaultView(EMPTY_FILTERS, [{ column: "date", dir: "asc" }])).toBe(false);
        expect(isDefaultView(EMPTY_FILTERS, [])).toBe(false);
    });
});

describe("areRowsEqual", () => {
    it("ignores runningBalance and contributorName", () => {
        const a = row();
        const withDerived: TestRow = { ...a, runningBalance: 99, contributorName: "someone" };
        expect(areRowsEqual([a], [withDerived])).toBe(true);
    });

    const changeCases: [string, Partial<TestRow>][] = [
        ["_key", { _key: "other" }],
        ["id", { id: 12345 }],
        ["date", { date: "2030-01-01T00:00" }],
        ["type", { type: "CREDIT" }],
        ["amount", { amount: "99" }],
        ["note", { note: "edited" }],
        ["account", { account: "CASH" }],
        ["categoryId", { categoryId: 3 }],
        ["hasImage", { hasImage: true }],
        ["pendingImage", { pendingImage: new Blob(["x"]) }],
        ["removeImage", { removeImage: true }],
    ];
    it.each(changeCases)("detects a change in %s", (_field, patch) => {
        const a = row();
        const changed: TestRow = { ...a, ...patch };
        expect(areRowsEqual([a], [changed])).toBe(false);
    });

    it("detects added and removed rows and order changes", () => {
        const a = row();
        const b = row();
        expect(areRowsEqual([a], [a, b])).toBe(false);
        expect(areRowsEqual([a, b], [a])).toBe(false);
        expect(areRowsEqual([a, b], [b, a])).toBe(false);
        expect(areRowsEqual([], [])).toBe(true);
    });
});

describe("pinned (unsaved) rows", () => {
    it("keeps a pinned row that no longer matches the filters, and only that row", () => {
        const edited = row({ type: "CREDIT" });
        const other = row({ type: "CREDIT" });
        const match = row({ type: "DEBIT" });
        const pinned = new Set([edited._key]);
        expect(keys(view([edited, other, match], [], { type: "DEBIT" }, { ...CTX, pinnedKeys: pinned })).sort()).toEqual(
            [edited._key, match._key].sort()
        );
    });
});

describe("unsavedRowKeys", () => {
    it("flags new and edited rows, ignores untouched and removed ones", () => {
        const untouched = row();
        const edited = row({ note: "a" });
        const removed = row();
        const snapshot = [untouched, edited, removed];
        const added = row({ id: undefined });
        const rows = [untouched, { ...edited, note: "b" }, added];
        expect([...unsavedRowKeys(rows, snapshot)].sort()).toEqual([edited._key, added._key].sort());
    });

    it("is empty when nothing changed", () => {
        const rows = [row(), row()];
        expect(unsavedRowKeys(rows, rows).size).toBe(0);
    });
});

describe("setSortDir", () => {
    it("appends a column that is not sorted yet, keeping priority order", () => {
        expect(setSortDir([{ column: "date", dir: "desc" }], "note", "asc")).toEqual([
            { column: "date", dir: "desc" },
            { column: "note", dir: "asc" },
        ]);
    });

    it("switches direction in place, keeping the priority slot", () => {
        const sorts: EntrySort[] = [
            { column: "note", dir: "asc" },
            { column: "date", dir: "desc" },
        ];
        expect(setSortDir(sorts, "note", "desc")).toEqual([
            { column: "note", dir: "desc" },
            { column: "date", dir: "desc" },
        ]);
    });

    it("turns the sort off when the active direction is picked again", () => {
        expect(setSortDir([{ column: "note", dir: "asc" }], "note", "asc")).toEqual([]);
    });
});
