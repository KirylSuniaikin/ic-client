import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BusinessTab from "./BusinessTab";
import { useBusinessStats } from "../../hooks/useBusinessStats";
import { ChannelRowConflictError } from "../../types";
import type { BusinessStatsResponse, ChannelPerformanceMonth, ChannelPerformanceRow } from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts. The hook and the
// table both run for real: every bug these tests pin lived in the seam between the two.
jest.mock("../../../../../shared/api/management");

import {
    getBusinessCategories, getBusinessStats, patchChannelOverride
} from "../../../../../shared/api/management";

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

// Fresh objects, as the server's JSON would be.
function serverMonth(rows: ChannelPerformanceRow[]): ChannelPerformanceMonth {
    return JSON.parse(JSON.stringify({
        period: "2026-09", rows, totalOrders: 621, totalGrossRevenue: 3938.77,
        totalAppFees: 716.498, totalNetRevenue: 3222.272, appFeesMissing: true,
    }));
}

function report(rows: ChannelPerformanceRow[]): BusinessStatsResponse {
    return {
        months: ["2026-09"],
        expensePivot: { months: ["2026-09"], blocks: [], unclassifiedCategoryCount: 0, unclassifiedTotal: 0 },
        revenue: [], inventoryCogs: [], channels: [serverMonth(rows)], profitAndLoss: [], kpi: [],
        costing: { componentsUsed: 0, componentsResolved: 0, coveragePercent: 100, warnings: [] },
        notices: [],
    };
}

const talabatOrders300 = { ...talabat, overrideOrders: 300, effectiveOrders: 300, version: 4 };

function Harness(): React.JSX.Element {
    const stats = useBusinessStats();
    return (
        <BusinessTab
            data={stats.data}
            loading={stats.loading}
            onRefresh={stats.refresh}
            channelSaving={stats.channelSaving}
            channelErrors={stats.channelErrors}
            channelSaveError={stats.channelSaveError}
            onSaveChannelCell={stats.saveChannelCell}
            onRevertChannelRow={stats.revertChannelRow}
            onDismissChannelSaveError={stats.clearChannelSaveError}
        />
    );
}

async function renderTable(): Promise<void> {
    render(<Harness/>);
    await userEvent.click(await screen.findByRole("button", { name: "Expand 🛵 Channel performance" }));
}

function input(field: "orders" | "gross revenue" | "app fees", channel: string): HTMLInputElement {
    return screen.getByLabelText(`${field} ${channel}`) as HTMLInputElement;
}

describe("channel table editing", () => {
    beforeEach(() => {
        jest.mocked(getBusinessCategories).mockResolvedValue([]);
        mockGet.mockResolvedValue(report([talabat, keeta, pickUp]));
    });

    it("keeps what was typed when the input itself is clicked", async () => {
        // The old cell re-seeded its draft from the saved figure on every click inside it.
        await renderTable();

        await userEvent.type(input("orders", "Talabat"), "300");
        await userEvent.click(input("orders", "Talabat"));

        expect(input("orders", "Talabat").value).toBe("300");
        expect(mockPatch).not.toHaveBeenCalled();
    });

    it("sends nothing when a cell is left without a change", async () => {
        await renderTable();

        await userEvent.click(input("gross revenue", "Talabat"));
        userEvent.tab();
        await userEvent.type(input("gross revenue", "Talabat"), "1741.080");
        userEvent.tab();

        expect(mockPatch).not.toHaveBeenCalled();
        expect(input("gross revenue", "Talabat").value).toBe("1741.080");
    });

    it("shows a figure exactly as it is edited, so it does not slide when editing starts", async () => {
        // It used to read "1,741.080" and lose the comma on focus, moving every digit left of it.
        await renderTable();
        const before = input("gross revenue", "Talabat").value;

        await userEvent.click(input("gross revenue", "Talabat"));

        expect(input("gross revenue", "Talabat").value).toBe(before);
    });

    it("focuses the input when the box around it is clicked, so no part of the box is dead", async () => {
        await renderTable();
        const box = input("app fees", "Keeta").closest("[data-testid='cell-appFees-keeta'] > div") as HTMLElement;

        await userEvent.click(box);

        expect(document.activeElement).toBe(input("app fees", "Keeta"));
    });

    it("updates net revenue and the totals as soon as a fee is entered, not when the save answers", async () => {
        const patch = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValue(patch.promise);
        await renderTable();

        await userEvent.type(input("app fees", "Pick Up"), "67.69{Enter}");

        const pickUpRow = screen.getByTestId("cell-appFees-pick up").closest("tr") as HTMLTableRowElement;
        expect(within(pickUpRow).getByText("1,600.000")).toBeTruthy();
        expect(within(pickUpRow).getByText("4.1%")).toBeTruthy();
        const table = pickUpRow.closest("table") as HTMLTableElement;
        const totalRow = within(table).getByText("Total").closest("tr") as HTMLTableRowElement;
        // 666.498 + 50 + 67.69 in fees; 1741.08 + 530 + 1667.69 gross.
        expect(within(totalRow).getByText("784.188")).toBeTruthy();
        expect(within(totalRow).getByText("3,154.582")).toBeTruthy();
        expect(screen.queryByText(/no app fee entered/)).toBeNull();
    });

    it("keeps the typed figure on screen, with a saving mark, while the save is in flight", async () => {
        const patch = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValue(patch.promise);
        await renderTable();

        await userEvent.type(input("orders", "Talabat"), "300{Enter}");

        const cell = screen.getByTestId("cell-orders-talabat");
        expect(input("orders", "Talabat").value).toBe("300");
        expect(within(cell).getByRole("progressbar", { name: "Saving orders" })).toBeTruthy();

        await act(async () => patch.resolve(serverMonth([talabatOrders300, keeta, pickUp])));

        expect(within(cell).queryByRole("progressbar")).toBeNull();
        expect(input("orders", "Talabat").value).toBe("300");
    });

    it("sends the version the first save returned when the same row is edited again before it answers", async () => {
        const first = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValueOnce(first.promise);
        mockPatch.mockResolvedValueOnce(serverMonth([
            { ...talabatOrders300, overrideGrossRevenue: 1800, effectiveGrossRevenue: 1800, version: 5 },
            keeta, pickUp]));
        await renderTable();

        await userEvent.type(input("orders", "Talabat"), "300{Enter}");
        await userEvent.type(input("gross revenue", "Talabat"), "1800{Enter}");
        await act(async () => first.resolve(serverMonth([talabatOrders300, keeta, pickUp])));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
        expect(mockPatch.mock.calls[0][0]).toEqual(expect.objectContaining({ orders: 300, version: 3 }));
        expect(mockPatch.mock.calls[1][0]).toEqual(expect.objectContaining({ grossRevenue: 1800, version: 4 }));
    });

    it("saves on Enter and moves down the same column, and on the last row saves and leaves the cell", async () => {
        mockPatch.mockResolvedValue(serverMonth([talabat, keeta, pickUp]));
        await renderTable();

        await userEvent.type(input("app fees", "Talabat"), "700{Enter}");
        expect(document.activeElement).toBe(input("app fees", "Keeta"));

        await userEvent.type(input("app fees", "Pick Up"), "12{Enter}");
        expect(document.activeElement).toBe(document.body);

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
        expect(mockPatch.mock.calls[0][0]).toEqual(expect.objectContaining({ channelKey: "talabat", appFees: 700 }));
        expect(mockPatch.mock.calls[1][0]).toEqual(expect.objectContaining({ channelKey: "pick up", appFees: 12 }));
    });

    it("throws the draft away on Esc and sends nothing", async () => {
        await renderTable();

        await userEvent.type(input("orders", "Talabat"), "999{Escape}");

        expect(input("orders", "Talabat").value).toBe("269");
        expect(document.activeElement).not.toBe(input("orders", "Talabat"));
        expect(mockPatch).not.toHaveBeenCalled();
    });

    it("reads a comma as the decimal point, and creates the row for a channel that has none yet", async () => {
        mockPatch.mockResolvedValue(serverMonth([talabat, keeta,
            { ...pickUp, id: 12, version: 0, overrideAppFees: 12.5, effectiveAppFees: 12.5, appFeesEntered: true }]));
        await renderTable();

        await userEvent.type(input("app fees", "Pick Up"), "12,5{Enter}");

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
            period: "2026-09", channelKey: "pick up", version: null, appFees: 12.5, clearAppFees: false,
        }));
    });

    it("refuses what is not a figure with an error naming the cell, and puts the figure back", async () => {
        await renderTable();

        await userEvent.type(input("app fees", "Keeta"), "abc{Enter}");

        expect(await screen.findByText("Keeta app fees (Sep 26): “abc” is not a number — nothing was saved."))
            .toBeTruthy();
        expect(input("app fees", "Keeta").value).toBe("50.000");
        expect(mockPatch).not.toHaveBeenCalled();
    });

    it("refuses a negative figure and fractional orders", async () => {
        await renderTable();

        await userEvent.type(input("gross revenue", "Keeta"), "-5{Enter}");
        expect(await screen.findByText(/Keeta gross revenue \(Sep 26\): “-5” cannot be negative/)).toBeTruthy();

        await userEvent.type(input("orders", "Keeta"), "12.5{Enter}");
        expect(await screen.findByText(/Keeta orders \(Sep 26\): “12.5” must be a whole number/)).toBeTruthy();

        expect(mockPatch).not.toHaveBeenCalled();
    });

    it("shows the error and puts the server's figure back when the row changed elsewhere", async () => {
        mockPatch.mockRejectedValue(new ChannelRowConflictError());
        await renderTable();

        await userEvent.type(input("orders", "Talabat"), "300{Enter}");

        expect(await screen.findByText(
            "Couldn't save Talabat orders (Sep 26): this row changed since it was loaded — the latest figures are shown."))
            .toBeTruthy();
        await waitFor(() => expect(input("orders", "Talabat").value).toBe("269"));
        expect(within(screen.getByTestId("cell-orders-talabat")).getByRole("img", { name: "Not saved: orders" }))
            .toBeTruthy();
    });

    it("shows no error mark on a cell once a re-edit queued behind its failed save has been saved", async () => {
        // The failed first save marked the cell after the re-edit had taken it over, and the
        // re-edit's success never cleared the mark: a saved figure sat under a "Not saved" glyph.
        const first = deferred<ChannelPerformanceMonth>();
        const second = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        await renderTable();
        mockGet.mockResolvedValue(report([{ ...talabat, version: 4 }, keeta, pickUp]));

        await userEvent.type(input("orders", "Talabat"), "300{Enter}");
        userEvent.clear(input("orders", "Talabat"));
        await userEvent.type(input("orders", "Talabat"), "310{Enter}");
        await act(async () => first.reject(new ChannelRowConflictError()));
        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
        expect(mockPatch.mock.calls[1][0]).toEqual(expect.objectContaining({ orders: 310, version: 4 }));

        await act(async () => second.resolve(serverMonth([
            { ...talabat, overrideOrders: 310, effectiveOrders: 310, version: 5 }, keeta, pickUp])));

        const cell = screen.getByTestId("cell-orders-talabat");
        expect(input("orders", "Talabat").value).toBe("310");
        expect(within(cell).queryByRole("progressbar")).toBeNull();
        expect(within(cell).queryByRole("img", { name: "Not saved: orders" })).toBeNull();
    });

    it("sends no stale save when the cell is reopened before its save answers and left after", async () => {
        // The old editor reopened on the pre-save figure, and once the refetch had brought a fresh
        // version, leaving the cell saved that old figure back — a revert the server accepted.
        const patch = deferred<ChannelPerformanceMonth>();
        mockPatch.mockReturnValueOnce(patch.promise);
        await renderTable();

        await userEvent.type(input("orders", "Talabat"), "300{Enter}");
        await userEvent.click(input("orders", "Talabat"));
        expect(input("orders", "Talabat").value).toBe("300");

        await act(async () => patch.resolve(serverMonth([talabatOrders300, keeta, pickUp])));
        userEvent.tab();

        expect(mockPatch).toHaveBeenCalledTimes(1);
        expect(input("orders", "Talabat").value).toBe("300");
    });

    it("keeps the app fee when a row is reverted", async () => {
        mockPatch.mockResolvedValue(serverMonth([talabat,
            { ...keeta, overrideGrossRevenue: null, effectiveGrossRevenue: 526.498, version: 6 }, pickUp]));
        await renderTable();

        await userEvent.click(screen.getByRole("button", { name: "Revert Keeta" }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
            channelKey: "keeta", version: 5, clearOrders: true, clearGrossRevenue: true, clearAppFees: false,
        }));
        await waitFor(() => expect(input("gross revenue", "Keeta").value).toBe("526.498"));
        expect(input("app fees", "Keeta").value).toBe("50.000");
    });
});
