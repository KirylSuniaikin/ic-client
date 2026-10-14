import {jest, describe, it, expect, beforeEach} from "@jest/globals";
import React from "react";
import {render, screen, within} from "@testing-library/react";

import {CourierProductivityCard} from "./CourierProductivityCard";
import type {CourierProductivity, CourierProductivityRow} from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../../shared/api/management");

import {fetchCourierProductivity} from "../../../../../shared/api/management";

const mockFetch = jest.mocked(fetchCourierProductivity);

const SCOPE = {startDate: "2026-10-01", finishDate: "2026-10-06"};

function row(overrides: Partial<CourierProductivityRow> = {}): CourierProductivityRow {
    return {
        courierId: "c-ali",
        name: "ali",
        onShiftMinutes: 480,
        freeMinutes: 210.5,
        toKitchenMinutes: 60,
        atKitchenMinutes: 35.5,
        carryingMinutes: 174,
        kmDriven: 52.3,
        deliveredParts: 14,
        kmPerDelivery: 3.7,
        ...overrides,
    };
}

function stats(overrides: Partial<CourierProductivity> = {}): CourierProductivity {
    return {
        gpsDataSince: "2026-07-08",
        splitDataSince: "2026-09-01T15:00:00",
        splitCoverage: "FULL",
        couriers: [
            row(),
            row({courierId: "c-sami", name: "sami", onShiftMinutes: 120, freeMinutes: 90, toKitchenMinutes: 10,
                atKitchenMinutes: 5, carryingMinutes: 15, kmDriven: 6.2, deliveredParts: 2, kmPerDelivery: 3.1}),
        ],
        total: row({courierId: null, name: null, onShiftMinutes: 600, freeMinutes: 300.5, toKitchenMinutes: 70,
            atKitchenMinutes: 40.5, carryingMinutes: 189, kmDriven: 58.5, deliveredParts: 16, kmPerDelivery: 3.7}),
        ...overrides,
    };
}

async function renderLoaded(report: CourierProductivity): Promise<void> {
    mockFetch.mockResolvedValue(report);
    render(<CourierProductivityCard scope={SCOPE}/>);
    await screen.findByTestId("courier-productivity-scope");
}

function rowCells(testId: string): (string | null)[] {
    return within(screen.getByTestId(testId)).getAllByRole("cell").map((cell) => cell.textContent);
}

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("CourierProductivityCard", () => {
    /** Couriers have no branch, so the scope line names the fleet, not "all branches". */
    it("asks for the applied range and labels it as the whole fleet", async () => {
        await renderLoaded(stats());

        expect(mockFetch.mock.calls[0]).toEqual(["2026-10-01", "2026-10-06"]);
        expect(screen.getByTestId("courier-productivity-scope").textContent)
            .toBe("All couriers · Oct 1, 2026 — Oct 6, 2026");
    });

    it("splits each rider's shift and shows free time as a share of it", async () => {
        await renderLoaded(stats());

        expect(rowCells("courier-productivity-row-c-ali"))
            .toEqual(["ali", "8h 0m", "3h 31m(43.9%)", "1h 0m", "36m", "2h 54m", "52.3", "14", "3.7"]);
    });

    it("ends with the fleet total", async () => {
        await renderLoaded(stats());

        const rows = within(screen.getByTestId("courier-productivity-table")).getAllByRole("row");
        expect(rows[rows.length - 1].getAttribute("data-testid")).toBe("courier-productivity-total");
        expect(rowCells("courier-productivity-total").slice(0, 2)).toEqual(["All couriers", "10h 0m"]);
    });

    /** Km the GPS can no longer measure is a dash — a zero would read as a rider who never moved. */
    it("prints unmeasurable km as a dash and names an unknown rider", async () => {
        await renderLoaded(stats({
            couriers: [row({courierId: "c-x", name: null, kmDriven: null, kmPerDelivery: null})],
        }));

        const cells = rowCells("courier-productivity-row-c-x");
        expect(cells[0]).toBe("Unknown rider");
        expect(cells[6]).toBe("—");
        expect(cells[8]).toBe("—");
    });

    it("says when GPS older than the window's start is gone", async () => {
        await renderLoaded(stats({gpsDataSince: "2026-10-03"}));

        expect(screen.getByTestId("courier-productivity-gps-note").textContent)
            .toBe("GPS before 3 Oct 2026 is no longer kept, so km before it is not counted.");
    });

    it("says nothing about GPS when the whole window is still kept", async () => {
        await renderLoaded(stats());

        expect(screen.queryByTestId("courier-productivity-gps-note")).toBeNull();
        expect(screen.queryByTestId("courier-productivity-split-note")).toBeNull();
    });

    /** Before recording began, going to the kitchen is inside "free" — the card must say so. */
    it("explains a partly recorded to-kitchen split", async () => {
        await renderLoaded(stats({splitCoverage: "PARTIAL", splitDataSince: "2026-10-03T15:00:00"}));

        expect(screen.getByTestId("courier-productivity-split-note").textContent)
            .toBe("Going to the kitchen is recorded from 3 Oct 2026, 15:00; before that it is counted as free.");
    });

    it("explains a to-kitchen split recorded after the whole range", async () => {
        await renderLoaded(stats({splitCoverage: "NONE", splitDataSince: "2026-10-07T15:00:00"}));

        expect(screen.getByTestId("courier-productivity-split-note").textContent)
            .toContain("in this range it is all counted as free");
    });

    it("says no courier was on shift rather than drawing an empty table", async () => {
        await renderLoaded(stats({couriers: [], total: row({courierId: null, name: null, onShiftMinutes: 0,
            freeMinutes: 0, toKitchenMinutes: 0, atKitchenMinutes: 0, carryingMinutes: 0, kmDriven: null,
            deliveredParts: 0, kmPerDelivery: null})}));

        expect(screen.getByText("No courier was on shift in this range")).toBeTruthy();
        expect(screen.queryByTestId("courier-productivity-table")).toBeNull();
    });

    it("shows an error when the request fails", async () => {
        mockFetch.mockRejectedValue(new Error("HTTP 500"));

        render(<CourierProductivityCard scope={SCOPE}/>);

        expect((await screen.findByTestId("courier-productivity-error")).textContent)
            .toBe("Could not load courier productivity for this range.");
    });

    it("fetches nothing until a range has been applied", () => {
        render(<CourierProductivityCard scope={null}/>);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(document.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    });
});
