import {jest, describe, it, expect, beforeEach} from "@jest/globals";
import React from "react";
import {render, screen, within} from "@testing-library/react";

import {DeliveryQualityCard} from "./DeliveryQualityCard";
import type {DeliveryQualityStats, DurationSummary} from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../../shared/api/management");

import {fetchDeliveryQualityStats} from "../../../../../shared/api/management";

const mockFetch = jest.mocked(fetchDeliveryQualityStats);

const SCOPE = {startDate: "2026-10-01", finishDate: "2026-10-06"};

function summary(overrides: Partial<DurationSummary> = {}): DurationSummary {
    return {sampleCount: 99, meanMinutes: 4.1, medianMinutes: 3.2, p90Minutes: 9, ...overrides};
}

const EMPTY_SUMMARY: DurationSummary = {sampleCount: 0, meanMinutes: null, medianMinutes: null, p90Minutes: null};

function stats(overrides: Partial<DeliveryQualityStats> = {}): DeliveryQualityStats {
    return {
        lateness: {
            deliveredOrders: 100, ordersWithPromise: 90, lateOrders: 18,
            lateShare: 0.2, meanMinutesLate: 6.4, p90MinutesLate: 12,
        },
        freshness: {
            budgetMinutes: 20, deliveredParts: 104, measuredParts: 99, freshParts: 80,
            freshShare: 0.808, unmeasurableParts: 5,
        },
        readyToHandover: summary(),
        courierWaitAtKitchen: summary({sampleCount: 70, meanMinutes: 2.5, medianMinutes: 1.9, p90Minutes: 6.1}),
        timeAtDoor: {
            dataSince: "2026-09-01T15:00:00",
            coverage: "FULL",
            summary: summary({sampleCount: 40, meanMinutes: 1.8, medianMinutes: 1.2, p90Minutes: 4}),
        },
        cancellations: {count: 3, share: 0.028, amountBhd: 12.5},
        returns: {count: 1, share: 0.009, amountBhd: 4.2},
        concludedOrders: 104,
        ...overrides,
    };
}

async function renderLoaded(report: DeliveryQualityStats): Promise<void> {
    mockFetch.mockResolvedValue(report);
    render(<DeliveryQualityCard scope={SCOPE}/>);
    await screen.findByTestId("delivery-quality-scope");
}

function rowCells(testId: string): (string | null)[] {
    return within(screen.getByTestId(testId)).getAllByRole("cell").map((cell) => cell.textContent);
}

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("DeliveryQualityCard", () => {
    it("asks for the applied range, chain-wide", async () => {
        await renderLoaded(stats());

        expect(mockFetch.mock.calls[0]).toEqual(["2026-10-01", "2026-10-06"]);
        expect(screen.getByTestId("delivery-quality-scope").textContent).toBe("All branches · Oct 1, 2026 — Oct 6, 2026");
    });

    it("leads with the late share and how late, against the promise", async () => {
        await renderLoaded(stats());

        const late = screen.getByTestId("quality-late").textContent;
        expect(late).toContain("20.0%");
        expect(late).toContain("18 of 90 orders · mean 6.4 · p90 12.0 min late");
    });

    it("measures freshness against the server's own budget", async () => {
        await renderLoaded(stats());

        const fresh = screen.getByTestId("quality-fresh").textContent;
        expect(fresh).toContain("Fresh · within 20 min of Ready");
        expect(fresh).toContain("80.8%");
        expect(fresh).toContain("80 of 99 drop-offs");
        expect(screen.getByText(/5 drop-offs had no Ready time/)).toBeTruthy();
    });

    /** Paid money that has to be refunded by hand: count, share and BHD, never one without the others. */
    it("counts cancelled and returned orders with their share and the money involved", async () => {
        await renderLoaded(stats());

        expect(screen.getByTestId("quality-cancelled").textContent).toContain("3");
        expect(screen.getByTestId("quality-cancelled").textContent).toContain("2.8% of concluded · BHD 12.500");
        expect(screen.getByTestId("quality-returned").textContent).toContain("0.9% of concluded · BHD 4.200");
    });

    it("tables the three waits nobody quotes", async () => {
        await renderLoaded(stats());

        expect(rowCells("quality-wait-pass").slice(1)).toEqual(["99 of 104", "3.2", "9.0", "4.1"]);
        expect(rowCells("quality-wait-kitchen").slice(1)).toEqual(["70 of 104", "1.9", "6.1", "2.5"]);
        expect(rowCells("quality-wait-door").slice(1)).toEqual(["40 of 104", "1.2", "4.0", "1.8"]);
    });

    it("prints dashes, not zeros, where nothing could be measured", async () => {
        await renderLoaded(stats({
            lateness: {deliveredOrders: 4, ordersWithPromise: 0, lateOrders: 0, lateShare: null,
                meanMinutesLate: null, p90MinutesLate: null},
            courierWaitAtKitchen: EMPTY_SUMMARY,
            cancellations: {count: 0, share: 0, amountBhd: 0},
        }));

        expect(screen.getByTestId("quality-late").textContent).toContain("—");
        expect(screen.getByTestId("quality-late").textContent).toContain("no orders with a promise on record");
        expect(rowCells("quality-wait-kitchen").slice(2)).toEqual(["—", "—", "—"]);
    });

    it("says nothing concluded rather than drawing empty figures", async () => {
        await renderLoaded(stats({
            lateness: {deliveredOrders: 0, ordersWithPromise: 0, lateOrders: 0, lateShare: null,
                meanMinutesLate: null, p90MinutesLate: null},
            freshness: {budgetMinutes: 20, deliveredParts: 0, measuredParts: 0, freshParts: 0, freshShare: null,
                unmeasurableParts: 0},
            readyToHandover: EMPTY_SUMMARY,
            courierWaitAtKitchen: EMPTY_SUMMARY,
            cancellations: {count: 0, share: null, amountBhd: 0},
            returns: {count: 0, share: null, amountBhd: 0},
            concludedOrders: 0,
        }));

        expect(screen.getByText("No delivery orders concluded in this range")).toBeTruthy();
        expect(screen.queryByTestId("quality-waits-table")).toBeNull();
    });

    /** Time at the door is the one captured figure here; a partial range says from when it counts. */
    it("captions a partly recorded time at the door", async () => {
        await renderLoaded(stats({
            timeAtDoor: {dataSince: "2026-10-03T15:00:00", coverage: "PARTIAL", summary: summary({sampleCount: 12})},
        }));

        expect(screen.getByTestId("quality-door-coverage").textContent)
            .toBe("At the door — Counted from 3 Oct 2026, 15:00. Earlier days in this range have no data.");
    });

    /** Before recording began the door row says so; the derived figures beside it are still real. */
    it("says there is no time-at-the-door data before the deploy, and keeps the rest", async () => {
        await renderLoaded(stats({
            timeAtDoor: {dataSince: "2026-10-07T15:00:00", coverage: "NONE", summary: null},
        }));

        expect(rowCells("quality-wait-door").slice(1)).toEqual(["No data before 7 Oct 2026, 15:00"]);
        expect(rowCells("quality-wait-pass").slice(1)).toEqual(["99 of 104", "3.2", "9.0", "4.1"]);
        expect(screen.queryByTestId("quality-door-coverage")).toBeNull();
    });

    it("shows an error when the request fails", async () => {
        mockFetch.mockRejectedValue(new Error("HTTP 500"));

        render(<DeliveryQualityCard scope={SCOPE}/>);

        expect((await screen.findByTestId("delivery-quality-error")).textContent)
            .toBe("Could not load delivery quality for this range.");
    });

    it("fetches nothing until a range has been applied", () => {
        render(<DeliveryQualityCard scope={null}/>);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(document.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    });
});
