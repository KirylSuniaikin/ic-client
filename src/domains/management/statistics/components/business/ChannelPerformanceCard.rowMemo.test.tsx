import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import ChannelPerformanceCard from "./ChannelPerformanceCard";
import { useBusinessStats } from "../../hooks/useBusinessStats";
import type {
    BusinessStatsResponse, ChannelField, ChannelPerformanceMonth, ChannelPerformanceRow as ChannelRow
} from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../../shared/api/management");

import { getBusinessStats, patchChannelOverride } from "../../../../../shared/api/management";

// Counting stand-in for the real row. It is memoized exactly like the real one, so it re-renders
// only when the card hands it a prop that changed identity — which is what these tests assert.
// Prefixed `mock*` so the hoisted jest.mock factory may close over it.
const mockRowRenderCounts: Record<string, number> = {};

jest.mock("./ChannelPerformanceRow", () => {
    const react: typeof React = require("react");
    type MockRowProps = {
        row: ChannelRow;
        onCommitCell: (row: ChannelRow, field: ChannelField, raw: string) => void;
    };
    return {
        // Only aligns the header and total figures with the cells; its value does not matter here.
        PILL_TEXT_INSET: "14px",
        ChannelPerformanceRow: react.memo(function MockChannelPerformanceRow({ row, onCommitCell }: MockRowProps) {
            mockRowRenderCounts[row.channelKey] = (mockRowRenderCounts[row.channelKey] ?? 0) + 1;
            return react.createElement(
                "tr",
                null,
                react.createElement("td", null, react.createElement(
                    "button", { onClick: () => onCommitCell(row, "appFees", "12") }, `edit ${row.channelKey}`)),
            );
        }),
    };
});

const mockGet = jest.mocked(getBusinessStats);
const mockPatch = jest.mocked(patchChannelOverride);

function channelRow(channelKey: string, id: number, version: number): ChannelRow {
    return {
        id, period: "2026-09", channelKey, channelLabel: channelKey,
        generatedOrders: 100, generatedGrossRevenue: 500,
        overrideOrders: null, overrideGrossRevenue: null, overrideAppFees: 20,
        effectiveOrders: 100, effectiveGrossRevenue: 500, effectiveAppFees: 20,
        appFeesEntered: true, netRevenue: 480, appCommissionPercent: 4,
        note: null, generatedAt: null, updatedAt: null, updatedByName: null, version,
    };
}

const rows: ChannelRow[] = [channelRow("talabat", 1, 3), channelRow("keeta", 2, 5), channelRow("pick up", 3, 1)];

// Fresh objects, as the server's JSON would be.
function serverMonth(monthRows: ChannelRow[]): ChannelPerformanceMonth {
    return JSON.parse(JSON.stringify({
        period: "2026-09", rows: monthRows, totalOrders: 300, totalGrossRevenue: 1500,
        totalAppFees: 52, totalNetRevenue: 1448, appFeesMissing: false,
    }));
}

const report: BusinessStatsResponse = {
    months: ["2026-09"],
    expensePivot: { months: ["2026-09"], blocks: [], unclassifiedCategoryCount: 0, unclassifiedTotal: 0 },
    revenue: [], inventoryCogs: [], channels: [serverMonth(rows)], profitAndLoss: [], kpi: [],
    costing: { componentsUsed: 0, componentsResolved: 0, coveragePercent: 100, warnings: [] },
    notices: [],
};

function Harness(): React.JSX.Element | null {
    const stats = useBusinessStats();
    if (stats.data === null) return null;
    return (
        <ChannelPerformanceCard
            months={stats.data.channels}
            saving={stats.channelSaving}
            errors={stats.channelErrors}
            onSaveCell={stats.saveChannelCell}
            onRevertRow={stats.revertChannelRow}
        />
    );
}

describe("ChannelPerformanceCard row memoization", () => {
    beforeEach(() => {
        for (const key of Object.keys(mockRowRenderCounts)) delete mockRowRenderCounts[key];
        mockGet.mockResolvedValue(report);
    });

    it("re-renders only the edited row, both while it saves and when the server's month replaces the old one", async () => {
        let answer: (month: ChannelPerformanceMonth) => void = () => undefined;
        mockPatch.mockReturnValue(new Promise<ChannelPerformanceMonth>(resolve => {
            answer = resolve;
        }));
        render(<Harness/>);
        await screen.findByText("edit talabat");
        expect(mockRowRenderCounts).toEqual({ talabat: 1, keeta: 1, "pick up": 1 });

        act(() => screen.getByText("edit talabat").click());
        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));

        expect(mockRowRenderCounts.keeta).toBe(1);
        expect(mockRowRenderCounts["pick up"]).toBe(1);
        const talabatWhileSaving = mockRowRenderCounts.talabat;
        expect(talabatWhileSaving).toBeGreaterThan(1);

        await act(async () => answer(serverMonth([
            { ...rows[0], overrideAppFees: 12, effectiveAppFees: 12, version: 4 }, rows[1], rows[2]])));

        expect(mockRowRenderCounts.talabat).toBeGreaterThan(talabatWhileSaving);
        expect(mockRowRenderCounts.keeta).toBe(1);
        expect(mockRowRenderCounts["pick up"]).toBe(1);
    });
});
