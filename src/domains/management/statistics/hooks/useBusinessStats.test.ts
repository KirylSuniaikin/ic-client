import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import { channelCellKey, normalizeRange, useBusinessStats } from "./useBusinessStats";
import { ChannelRowConflictError } from "../types";
import type { BusinessStatsResponse, ChannelPerformanceMonth, ChannelPerformanceRow } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../shared/api/management");

import { getBusinessStats, patchChannelOverride } from "../../../../shared/api/management";

const mockGet = jest.mocked(getBusinessStats);
const mockPatch = jest.mocked(patchChannelOverride);

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

function deferred<T>(): Deferred<T> {
    let resolve: (value: T) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function channelRow(overrides: Partial<ChannelPerformanceRow>): ChannelPerformanceRow {
    return {
        id: 10, period: "2026-09", channelKey: "talabat", channelLabel: "Talabat",
        generatedOrders: 269, generatedGrossRevenue: 1741.08,
        overrideOrders: null, overrideGrossRevenue: null, overrideAppFees: 666.498,
        effectiveOrders: 269, effectiveGrossRevenue: 1741.08, effectiveAppFees: 666.498,
        appFeesEntered: true, netRevenue: 1074.582, appCommissionPercent: 38.28,
        note: null, generatedAt: null, updatedAt: null, updatedByName: "owner", version: 3,
        ...overrides,
    };
}

const talabat = channelRow({});
const keeta = channelRow({
    id: 11, channelKey: "keeta", channelLabel: "Keeta",
    generatedOrders: 98, generatedGrossRevenue: 526.498,
    overrideGrossRevenue: 530, overrideAppFees: 50,
    effectiveOrders: 98, effectiveGrossRevenue: 530, effectiveAppFees: 50,
    netRevenue: 480, appCommissionPercent: 9.43, version: 5,
});
// Live orders, nothing stored yet: no id, no version.
const pickUp = channelRow({
    id: null, channelKey: "pick up", channelLabel: "Pick Up",
    generatedOrders: 254, generatedGrossRevenue: 1667.69,
    overrideAppFees: null, effectiveOrders: 254, effectiveGrossRevenue: 1667.69, effectiveAppFees: null,
    appFeesEntered: false, netRevenue: 1667.69, appCommissionPercent: null,
    updatedByName: null, version: null,
});

function month(rows: ChannelPerformanceRow[]): ChannelPerformanceMonth {
    return {
        period: "2026-09", rows, totalOrders: 621, totalGrossRevenue: 3938.77,
        totalAppFees: 716.498, totalNetRevenue: 3222.272, appFeesMissing: true,
    };
}

function report(rows: ChannelPerformanceRow[]): BusinessStatsResponse {
    return {
        months: ["2026-09"],
        expensePivot: { months: ["2026-09"], blocks: [], unclassifiedCategoryCount: 0, unclassifiedTotal: 0 },
        revenue: [], inventoryCogs: [], channels: [month(rows)], profitAndLoss: [], kpi: [],
        costing: { componentsUsed: 0, componentsResolved: 0, coveragePercent: 100, warnings: [] },
        notices: [],
    };
}

// What the server answers: fresh objects, equal in content to what the client already holds, so
// identity is only preserved if the hook does it on purpose.
function serverMonth(rows: ChannelPerformanceRow[]): ChannelPerformanceMonth {
    return JSON.parse(JSON.stringify(month(rows)));
}

function shownRow(result: { current: ReturnType<typeof useBusinessStats> }, key: string): ChannelPerformanceRow | undefined {
    return result.current.data?.channels[0].rows.find(r => r.channelKey === key);
}

async function renderLoaded(): Promise<{ result: { current: ReturnType<typeof useBusinessStats> } }> {
    const rendered = renderHook(() => useBusinessStats());
    await waitFor(() => expect(rendered.result.current.data).not.toBeNull());
    return rendered;
}

describe("normalizeRange", () => {
    it("swaps a reversed range rather than rejecting it", () => {
        // Picking "to" before "from" is a normal way to use two calendars side by side.
        const result = normalizeRange({ from: new Date(2026, 8, 1), to: new Date(2026, 2, 1) });

        expect(result.from).toEqual(new Date(2026, 2, 1));
        expect(result.to).toEqual(new Date(2026, 8, 1));
    });

    it("keeps a range that is exactly at the limit", () => {
        const result = normalizeRange({ from: new Date(2025, 0, 1), to: new Date(2026, 11, 1) });

        expect(result.from).toEqual(new Date(2025, 0, 1));
    });

    it("trims an over-long range from the far end, keeping the recent months", () => {
        // The server refuses more than 24 months. Trimming the OLD end keeps what the owner just
        // asked to see; trimming the new end would silently drop the month they care about most.
        const result = normalizeRange({ from: new Date(2020, 0, 1), to: new Date(2026, 11, 1) });

        expect(result.to).toEqual(new Date(2026, 11, 1));
        expect(result.from).toEqual(new Date(2025, 0, 1));
    });

    it("keeps a single-month range intact", () => {
        const result = normalizeRange({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 1) });

        expect(result.from).toEqual(new Date(2026, 5, 1));
        expect(result.to).toEqual(new Date(2026, 5, 1));
    });
});

describe("useBusinessStats channel edits", () => {
    beforeEach(() => {
        mockGet.mockResolvedValue(report([talabat, keeta, pickUp]));
    });

    it("sends the whole upsert body, with version null, for a channel that has no stored row yet", async () => {
        mockPatch.mockResolvedValue(serverMonth([talabat, keeta,
            { ...pickUp, id: 12, version: 0, overrideAppFees: 30, effectiveAppFees: 30, appFeesEntered: true }]));
        const { result } = await renderLoaded();

        act(() => result.current.saveChannelCell("2026-09", "pick up", "appFees", 30));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith({
            period: "2026-09", channelKey: "pick up", version: null,
            orders: null, grossRevenue: null, appFees: 30, note: null,
            clearOrders: false, clearGrossRevenue: false, clearAppFees: false,
        });
    });

    it("sends nothing when a cell is left at the value it already shows", async () => {
        // Saving the live figure back would pin it as an override, tint the cell and bump the
        // version, all for an edit nobody made.
        const { result } = await renderLoaded();

        act(() => {
            result.current.saveChannelCell("2026-09", "talabat", "orders", 269);
            result.current.saveChannelCell("2026-09", "talabat", "appFees", 666.498);
            result.current.saveChannelCell("2026-09", "talabat", "grossRevenue", null);
        });

        expect(mockPatch).not.toHaveBeenCalled();
        expect(result.current.channelSaving.size).toBe(0);
    });

    it("shows the new value at once and marks only that cell as saving until the server answers", async () => {
        const patch = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValue(patch.promise);
        const { result } = await renderLoaded();

        act(() => result.current.saveChannelCell("2026-09", "talabat", "orders", 300));

        expect(shownRow(result, "talabat")?.effectiveOrders).toBe(300);
        expect(shownRow(result, "talabat")?.overrideOrders).toBe(300);
        expect(Array.from(result.current.channelSaving)).toEqual([channelCellKey("2026-09", "talabat", "orders")]);

        await act(async () => patch.resolve(serverMonth([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, version: 4 }, keeta, pickUp])));

        expect(result.current.channelSaving.size).toBe(0);
        expect(shownRow(result, "talabat")?.effectiveOrders).toBe(300);
        expect(shownRow(result, "talabat")?.version).toBe(4);
    });

    it("sends the version the previous save returned when one row is edited twice in quick succession", async () => {
        // Reading it from the row on screen sent the same version twice, and the second edit came
        // back 409 and was silently lost.
        const first = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValueOnce(first.promise);
        mockPatch.mockResolvedValueOnce(serverMonth([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, overrideGrossRevenue: 1800, effectiveGrossRevenue: 1800, version: 5 },
            keeta, pickUp]));
        const { result } = await renderLoaded();

        act(() => {
            result.current.saveChannelCell("2026-09", "talabat", "orders", 300);
            result.current.saveChannelCell("2026-09", "talabat", "grossRevenue", 1800);
        });
        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        await act(async () => first.resolve(serverMonth([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, version: 4 }, keeta, pickUp])));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
        expect(mockPatch.mock.calls[0][0]).toEqual(expect.objectContaining({ orders: 300, version: 3 }));
        expect(mockPatch.mock.calls[1][0]).toEqual(expect.objectContaining({ grossRevenue: 1800, version: 4 }));
    });

    it("keeps every untouched row as the same object when the server's month replaces the old one", async () => {
        // That is what lets the memoized table rows skip the re-render.
        mockPatch.mockResolvedValue(serverMonth([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, version: 4 }, keeta, pickUp]));
        const { result } = await renderLoaded();
        const before = result.current.data?.channels[0].rows ?? [];

        act(() => result.current.saveChannelCell("2026-09", "talabat", "orders", 300));
        await waitFor(() => expect(result.current.channelSaving.size).toBe(0));

        const after = result.current.data?.channels[0].rows ?? [];
        expect(after[0]).not.toBe(before[0]);
        expect(after[1]).toBe(before[1]);
        expect(after[2]).toBe(before[2]);
    });

    it("rolls back, reports a 409 without blaming someone else, and reloads the month", async () => {
        mockPatch.mockRejectedValue(new ChannelRowConflictError());
        const { result } = await renderLoaded();
        mockGet.mockResolvedValue(report([
            { ...talabat, overrideOrders: 280, effectiveOrders: 280, version: 4 }, keeta, pickUp]));

        act(() => result.current.saveChannelCell("2026-09", "talabat", "orders", 300));

        await waitFor(() => expect(shownRow(result, "talabat")?.effectiveOrders).toBe(280));
        expect(mockGet).toHaveBeenLastCalledWith("2026-09", "2026-09");
        expect(result.current.channelSaveError).toBe(
            "Couldn't save Talabat orders (Sep 26): this row changed since it was loaded — the latest figures are shown.");
        expect(result.current.channelErrors.has(channelCellKey("2026-09", "talabat", "orders"))).toBe(true);
        expect(result.current.channelSaving.size).toBe(0);
    });

    it("leaves no error mark on a cell whose failed save was overtaken by a later save that succeeded", async () => {
        // The failure used to mark the cell after the later save had already taken it over, and
        // only a save's queueing cleared a mark, so a saved cell kept a red "Not saved" glyph.
        const first = deferred<ChannelPerformanceMonth>();
        const second = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result } = await renderLoaded();
        mockGet.mockResolvedValue(report([{ ...talabat, version: 4 }, keeta, pickUp]));
        const orders = channelCellKey("2026-09", "talabat", "orders");

        act(() => {
            result.current.saveChannelCell("2026-09", "talabat", "orders", 270);
            result.current.saveChannelCell("2026-09", "talabat", "orders", 280);
        });
        await act(async () => first.reject(new ChannelRowConflictError()));
        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));

        // Still saving the newer figure, so nothing about this cell has failed yet.
        expect(result.current.channelErrors.has(orders)).toBe(false);
        expect(shownRow(result, "talabat")?.effectiveOrders).toBe(280);
        expect(mockPatch.mock.calls[1][0]).toEqual(expect.objectContaining({ orders: 280, version: 4 }));

        await act(async () => second.resolve(serverMonth([
            { ...talabat, overrideOrders: 280, effectiveOrders: 280, version: 5 }, keeta, pickUp])));

        expect(result.current.channelSaving.size).toBe(0);
        expect(result.current.channelErrors.size).toBe(0);
        expect(shownRow(result, "talabat")?.effectiveOrders).toBe(280);
    });

    it("marks only the cells a failed revert still owned when a later save took one of them over", async () => {
        // Gross revenue really did fail to revert; orders is the later save's to report on.
        const revert = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValueOnce(revert.promise).mockResolvedValueOnce(serverMonth([
            talabat, { ...keeta, overrideOrders: 100, effectiveOrders: 100, version: 7 }, pickUp]));
        const { result } = await renderLoaded();
        mockGet.mockResolvedValue(report([talabat, { ...keeta, version: 6 }, pickUp]));

        act(() => {
            result.current.revertChannelRow("2026-09", "keeta");
            result.current.saveChannelCell("2026-09", "keeta", "orders", 100);
        });
        await act(async () => revert.reject(new Error("boom")));

        await waitFor(() => expect(result.current.channelSaving.size).toBe(0));
        expect(mockPatch).toHaveBeenCalledTimes(2);
        expect(Array.from(result.current.channelErrors.keys()))
            .toEqual([channelCellKey("2026-09", "keeta", "grossRevenue")]);
        expect(shownRow(result, "keeta")?.effectiveOrders).toBe(100);
    });

    it("puts the server's figure back when a save is refused", async () => {
        mockPatch.mockRejectedValue(new Error("Orders must be a whole number"));
        const { result } = await renderLoaded();

        act(() => result.current.saveChannelCell("2026-09", "talabat", "orders", 300));

        await waitFor(() => expect(result.current.channelSaveError)
            .toBe("Couldn't save Talabat orders (Sep 26): Orders must be a whole number"));
        expect(shownRow(result, "talabat")?.effectiveOrders).toBe(269);
    });

    it("reverts orders and gross revenue but leaves the app fee alone", async () => {
        // The fee has no live figure to fall back to, so clearing it in a revert would delete it.
        mockPatch.mockResolvedValue(serverMonth([talabat,
            { ...keeta, overrideGrossRevenue: null, effectiveGrossRevenue: 526.498, version: 6 }, pickUp]));
        const { result } = await renderLoaded();

        act(() => result.current.revertChannelRow("2026-09", "keeta"));

        expect(shownRow(result, "keeta")?.effectiveGrossRevenue).toBe(526.498);
        expect(shownRow(result, "keeta")?.effectiveAppFees).toBe(50);
        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
            channelKey: "keeta", version: 5, appFees: null,
            clearOrders: true, clearGrossRevenue: true, clearAppFees: false,
        }));
    });

    it("refreshes the rest of the report quietly once the saves are done", async () => {
        mockPatch.mockResolvedValue(serverMonth([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, version: 4 }, keeta, pickUp]));
        const { result } = await renderLoaded();
        const background = deferred<BusinessStatsResponse>();
        mockGet.mockReturnValue(background.promise);

        act(() => result.current.saveChannelCell("2026-09", "talabat", "orders", 300));

        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2), { timeout: 2000 });
        // The skeleton and the spinner key off `loading`; a save must never bring them back.
        expect(result.current.loading).toBe(false);
        await act(async () => background.resolve(report([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, version: 4 }, keeta, pickUp])));
    });

    it("discards a background refresh that was overtaken by a newer save", async () => {
        // Its figures predate the save, so applying them would bring back the old version and
        // turn the owner's next edit into a 409.
        mockPatch.mockResolvedValueOnce(serverMonth([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, version: 4 }, keeta, pickUp]));
        const { result } = await renderLoaded();
        const background = deferred<BusinessStatsResponse>();
        mockGet.mockReturnValue(background.promise);

        act(() => result.current.saveChannelCell("2026-09", "talabat", "orders", 300));
        await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2), { timeout: 2000 });

        const second = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValueOnce(second.promise);
        act(() => result.current.saveChannelCell("2026-09", "talabat", "grossRevenue", 1800));
        await act(async () => background.resolve(report([talabat, keeta, pickUp])));

        expect(shownRow(result, "talabat")?.version).toBe(4);
        expect(shownRow(result, "talabat")?.effectiveOrders).toBe(300);
        await act(async () => second.resolve(serverMonth([
            { ...talabat, overrideOrders: 300, effectiveOrders: 300, overrideGrossRevenue: 1800, effectiveGrossRevenue: 1800, version: 5 },
            keeta, pickUp])));
    });
});

describe("useBusinessStats refresh", () => {
    it("never lets an older response overwrite a newer one", async () => {
        mockGet.mockResolvedValue(report([talabat, keeta, pickUp]));
        const { result } = await renderLoaded();
        const older = deferred<BusinessStatsResponse>();
        const newer = deferred<BusinessStatsResponse>();
        mockGet.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

        let refreshes: Promise<void>[] = [];
        act(() => {
            refreshes = [result.current.refresh(), result.current.refresh()];
        });
        await act(async () => newer.resolve(report([{ ...talabat, version: 9 }, keeta, pickUp])));
        await act(async () => older.resolve(report([{ ...talabat, version: 7 }, keeta, pickUp])));
        await act(async () => {
            await Promise.all(refreshes);
        });

        expect(shownRow(result, "talabat")?.version).toBe(9);
        expect(result.current.loading).toBe(false);
    });
});
