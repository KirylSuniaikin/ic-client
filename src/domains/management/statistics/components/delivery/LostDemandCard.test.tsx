import {jest, describe, it, expect, beforeEach} from "@jest/globals";
import React from "react";
import {render, screen, within} from "@testing-library/react";

import {LostDemandCard} from "./LostDemandCard";
import type {LostDemandKeeta, LostDemandRefusals, LostDemandStats} from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../../shared/api/management");

import {fetchLostDemandStats} from "../../../../../shared/api/management";

const mockFetch = jest.mocked(fetchLostDemandStats);

const SCOPE = {startDate: "2026-10-05", finishDate: "2026-10-06"};

const REFUSALS: LostDemandRefusals = {
    total: 42,
    estimatedAttempts: 30,
    byReason: [
        {reason: "NO_BRANCH", count: 0},
        {reason: "OUTSIDE_RADIUS", count: 25},
        {reason: "NO_COURIER", count: 12},
        {reason: "DELIVERY_DISABLED", count: 0},
        {reason: "OUTSIDE_ZONE", count: 3},
        {reason: "INSUFFICIENT_COURIERS", count: 2},
    ],
    byStage: [{stage: "CART", count: 20}, {stage: "ADDRESS", count: 20}, {stage: "CHECKOUT", count: 2}],
    byPlatform: [
        {platform: "WEB", count: 25}, {platform: "MOBILE", count: 15}, {platform: "KIOSK", count: 0},
        {platform: "KIOSK_WEB", count: 0}, {platform: "UNKNOWN", count: 2},
    ],
};

const KEETA: LostDemandKeeta = {
    total: 7,
    byStage: [{stage: "CART", count: 5}, {stage: "ADDRESS", count: 2}],
    byReason: [
        {reason: "NO_BRANCH", count: 0},
        {reason: "OUTSIDE_RADIUS", count: 4},
        {reason: "NO_COURIER", count: 2},
        {reason: "DELIVERY_DISABLED", count: 0},
        {reason: "OUTSIDE_ZONE", count: 0},
        {reason: "INSUFFICIENT_COURIERS", count: 0},
        {reason: "UNKNOWN", count: 1},
    ],
    byPlatform: [
        {platform: "WEB", count: 7}, {platform: "MOBILE", count: 0}, {platform: "KIOSK", count: 0},
        {platform: "KIOSK_WEB", count: 0}, {platform: "UNKNOWN", count: 0},
    ],
};

function stats(overrides: Partial<LostDemandStats> = {}): LostDemandStats {
    return {
        refusalsDataSince: "2026-09-01T15:00:00",
        refusalsCoverage: "FULL",
        keetaDataSince: "2026-09-01T15:00:00",
        keetaCoverage: "FULL",
        refusals: REFUSALS,
        keeta: KEETA,
        abandoned: {
            orders: 9, recovered: 4, lost: 5, lostValueBhd: 23.45,
            byStatus: [{status: "Pending Payment", count: 6}, {status: "Payment Failed", count: 3}],
        },
        paidDeliveryOrders: 140,
        byDay: [
            {date: "2026-10-05", refusals: 20, estimatedAttempts: 14, keetaChosen: 3, abandonedLost: 1},
            {date: "2026-10-06", refusals: 22, estimatedAttempts: 16, keetaChosen: 4, abandonedLost: 4},
        ],
        byHour: [
            {dayOfWeek: 5, hour: 20, refusals: 6, estimatedAttempts: 4},
            {dayOfWeek: 1, hour: 13, refusals: 2, estimatedAttempts: 2},
        ],
        ...overrides,
    };
}

async function renderLoaded(report: LostDemandStats): Promise<void> {
    mockFetch.mockResolvedValue(report);
    render(<LostDemandCard scope={SCOPE}/>);
    await screen.findByTestId("lost-demand-scope");
}

function rowCells(testId: string): (string | null)[] {
    return within(screen.getByTestId(testId)).getAllByRole("cell").map((cell) => cell.textContent);
}

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("LostDemandCard", () => {
    it("asks for the applied range, chain-wide", async () => {
        await renderLoaded(stats());

        expect(mockFetch.mock.calls[0]).toEqual(["2026-10-05", "2026-10-06"]);
        expect(screen.getByTestId("lost-demand-scope").textContent).toBe("All branches · Oct 5, 2026 — Oct 6, 2026");
    });

    /** Refused, sent to Keeta, gone at payment — and paid orders beside them for scale, not as a rate. */
    it("shows the three ways a customer was lost, with paid orders for scale", async () => {
        await renderLoaded(stats());

        expect(screen.getByTestId("lost-demand-refusals").textContent).toContain("42");
        expect(screen.getByTestId("lost-demand-refusals").textContent).toContain("≈ 30 customers (estimated)");
        expect(screen.getByTestId("lost-demand-keeta").textContent).toContain("7");
        expect(screen.getByTestId("lost-demand-abandoned").textContent)
            .toContain("BHD 23.450 · 4 of 9 came back and paid");
        expect(screen.getByTestId("lost-demand-paid").textContent).toContain("140");
    });

    /** Every reason listed, even at zero: an absent problem must be visibly absent, not missing. */
    it("breaks refusals and Keeta choices down by reason, stage and platform", async () => {
        await renderLoaded(stats());

        expect(rowCells("lost-demand-by-reason-OUTSIDE_RADIUS")).toEqual(["Too far (radius or drive time)", "25", "4"]);
        expect(rowCells("lost-demand-by-reason-NO_BRANCH")).toEqual(["No branch coordinates", "0", "0"]);
        // A Keeta event sent without a reason has no refusal twin.
        expect(rowCells("lost-demand-by-reason-UNKNOWN")).toEqual(["Reason not sent", "n/a", "1"]);
        // There is no Keeta card at the payment step: n/a, not a zero.
        expect(rowCells("lost-demand-by-stage-CHECKOUT")).toEqual(["At payment", "2", "n/a"]);
        expect(rowCells("lost-demand-by-platform-MOBILE")).toEqual(["App", "15", "0"]);
    });

    it("lists every day with each way a customer was lost", async () => {
        await renderLoaded(stats());

        expect(rowCells("lost-demand-day-2026-10-05")).toEqual(["Mon 5 Oct", "20", "14", "3", "1"]);
    });

    it("draws refusals on the weekday-by-hour grid the other delivery grids use", async () => {
        await renderLoaded(stats());

        expect(screen.getByTestId("lost-demand-hour-5-20").textContent).toBe("6");
        expect(screen.getByTestId("lost-demand-hour-1-13").textContent).toBe("2");
        expect(screen.getByTestId("lost-demand-hour-2-13").textContent).toBe("");
    });

    it("says nobody was turned away rather than drawing a page of zeros", async () => {
        await renderLoaded(stats({
            refusals: {...REFUSALS, total: 0, estimatedAttempts: 0},
            keeta: {...KEETA, total: 0},
            abandoned: {orders: 0, recovered: 0, lost: 0, lostValueBhd: 0,
                byStatus: [{status: "Pending Payment", count: 0}, {status: "Payment Failed", count: 0}]},
            byHour: [],
        }));

        expect(screen.getByText("Nobody was turned away in this range")).toBeTruthy();
        expect(screen.queryByTestId("lost-demand-by-day")).toBeNull();
    });

    /** Figures from part of the range are shown, with the moment each began being recorded. */
    it("captions partly recorded refusals and Keeta choices", async () => {
        await renderLoaded(stats({
            refusalsCoverage: "PARTIAL", refusalsDataSince: "2026-10-06T15:00:00",
            keetaCoverage: "PARTIAL", keetaDataSince: "2026-10-06T15:00:00",
            byDay: [
                {date: "2026-10-05", refusals: null, estimatedAttempts: null, keetaChosen: null, abandonedLost: 1},
                {date: "2026-10-06", refusals: 22, estimatedAttempts: 16, keetaChosen: 4, abandonedLost: 4},
            ],
        }));

        expect(screen.getByTestId("lost-demand-refusals-coverage").textContent)
            .toBe("Refusals — Counted from 6 Oct 2026, 15:00. Earlier days in this range have no data.");
        expect(screen.getByTestId("lost-demand-keeta-coverage").textContent).toContain("Keeta choices — Counted from");
        // The day before recording is a dash, never a zero; the derived column is still a real count.
        expect(rowCells("lost-demand-day-2026-10-05")).toEqual(["Mon 5 Oct", "—", "—", "—", "1"]);
    });

    /**
     * A range wholly before recording: the captured figures say so in place of a number, and the
     * derived ones — abandoned orders, paid orders — are still shown, because they are still true.
     */
    it("says there is no data before the deploy for captured figures, and keeps the derived ones", async () => {
        await renderLoaded(stats({
            refusalsCoverage: "NONE", refusalsDataSince: "2026-10-07T15:00:00",
            keetaCoverage: "NONE", keetaDataSince: "2026-10-07T15:00:00",
            refusals: null,
            keeta: null,
            byDay: [
                {date: "2026-10-05", refusals: null, estimatedAttempts: null, keetaChosen: null, abandonedLost: 1},
                {date: "2026-10-06", refusals: null, estimatedAttempts: null, keetaChosen: null, abandonedLost: 4},
            ],
            byHour: [],
        }));

        expect(screen.getByTestId("lost-demand-refusals").textContent)
            .toBe("Refused deliveryNo data before 7 Oct 2026, 15:00");
        expect(screen.getByTestId("lost-demand-keeta").textContent).toContain("No data before 7 Oct 2026, 15:00");
        expect(screen.getByTestId("lost-demand-abandoned").textContent).toContain("5");
        expect(screen.getByTestId("lost-demand-by-hour-no-data").textContent).toBe("No data before 7 Oct 2026, 15:00");
        expect(screen.queryByTestId("lost-demand-by-reason")).toBeNull();
        expect(rowCells("lost-demand-day-2026-10-06")).toEqual(["Tue 6 Oct", "—", "—", "—", "4"]);
        expect(screen.queryByText("Nobody was turned away in this range")).toBeNull();
    });

    it("shows an error when the request fails", async () => {
        mockFetch.mockRejectedValue(new Error("HTTP 500"));

        render(<LostDemandCard scope={SCOPE}/>);

        expect((await screen.findByTestId("lost-demand-error")).textContent)
            .toBe("Could not load lost demand for this range.");
    });

    it("fetches nothing until a range has been applied", () => {
        render(<LostDemandCard scope={null}/>);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(document.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    });
});
