import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { format } from "date-fns";

import { CourierPeriodStatsPanel } from "./CourierPeriodStatsPanel";
import { fetchCourierPeriodStats } from "../../../../shared/api/dispatcher";
import type { CourierPeriodStats } from "../types";

jest.mock("../../../../shared/api/dispatcher");

// The picker is a react-date-range calendar; this suite is about the numbers and the window they
// are fetched for, not about the calendar's own rendering.
jest.mock("../../statistics/components/performance/DateRangePickerPopover", () => ({
    DateRangePickerPopover: () => null,
}));

// jest.mocked, never a `jest.Mock` annotation — there is no @types/jest here.
const mockStats = jest.mocked(fetchCourierPeriodStats);

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const STATS: CourierPeriodStats = {
    courierId: "c1",
    from: "2026-08-30",
    to: "2026-08-30",
    averageDeliveryMinutes: 14.5,
    deliveredCount: 6,
    deliveredTotal: 42.5,
    hoursWorkedThisMonth: 31.25,
    declined: 2,
    missed: 1,
};

beforeEach(() => {
    // resetMocks is on, so an implementation set at module scope would already be gone.
    mockStats.mockReset();
    mockStats.mockResolvedValue(STATS);
});

describe("CourierPeriodStatsPanel", () => {
    /**
     * The panel opens on today, matching the endpoint's own default. If the two ever disagree the
     * dates printed beside the numbers would describe a different window from the one fetched.
     */
    it("opens on today and fetches exactly that window", async () => {
        const today = format(new Date(), "yyyy-MM-dd");

        render(<CourierPeriodStatsPanel courierId="c1" />);

        await waitFor(() => expect(mockStats).toHaveBeenCalledWith("c1", today, today));
    });

    /**
     * This is where the roster card's four counters went, and the pair that matters most is
     * declined vs no-answer: a rider who declines is making a choice, one who never answers may
     * have a dead phone. They must stay two numbers, never one "refused" total.
     */
    it("reports declined and no-answer as separate figures", async () => {
        render(<CourierPeriodStatsPanel courierId="c1" />);

        expect(await screen.findByText("Declined")).toBeTruthy();
        expect(screen.getByText("No answer")).toBeTruthy();
        expect(screen.getByText("2")).toBeTruthy();
        expect(screen.getByText("1")).toBeTruthy();
        expect(screen.queryByText("3")).toBeNull();
    });

    it("shows the period's delivery figures", async () => {
        render(<CourierPeriodStatsPanel courierId="c1" />);

        expect(await screen.findByText("14.5 min")).toBeTruthy();
        expect(screen.getByText("6")).toBeTruthy();
        expect(screen.getByText("BHD 42.50")).toBeTruthy();
        expect(screen.getByText("31.3")).toBeTruthy();
    });

    /**
     * The server sends null — not zero — when no delivery in the window carries a hand-over
     * stamp. Zero would read as an instant drive and drag any average built on it downwards.
     */
    it("renders an underivable average as a dash rather than zero", async () => {
        mockStats.mockResolvedValue({ ...STATS, averageDeliveryMinutes: null });

        render(<CourierPeriodStatsPanel courierId="c1" />);

        expect(await screen.findByText("—")).toBeTruthy();
        expect(screen.queryByText("0.0 min")).toBeNull();
    });

    it("refetches when the panel is pointed at a different courier", async () => {
        const { rerender } = render(<CourierPeriodStatsPanel courierId="c1" />);
        await waitFor(() => expect(mockStats).toHaveBeenCalledTimes(1));

        rerender(<CourierPeriodStatsPanel courierId="c2" />);

        await waitFor(() => expect(mockStats).toHaveBeenCalledTimes(2));
        expect(mockStats.mock.calls[1][0]).toBe("c2");
    });

    /**
     * A failed fetch must clear the numbers, not leave the previous window's figures sitting
     * under a date label they do not describe.
     */
    it("clears the figures when the fetch fails", async () => {
        mockStats.mockRejectedValue(new Error("Response: 500"));

        render(<CourierPeriodStatsPanel courierId="c1" />);

        expect(await screen.findByText("Response: 500")).toBeTruthy();
        expect(screen.queryByText("14.5 min")).toBeNull();
        expect(screen.getByText("BHD 0.00")).toBeTruthy();
    });

    /** M5 for the panel's own window: distance, and where the shift went. */
    it("adds the distance and shift-split tiles when the server sends them", async () => {
        const today = format(new Date(), "yyyy-MM-dd");
        mockStats.mockResolvedValue({
            ...STATS,
            productivity: {
                gpsDataSince: "2000-01-01",
                splitDataSince: "2026-10-06T15:00:00",
                splitCoverage: "FULL",
                row: {
                    courierId: "c1", name: "ali", onShiftMinutes: 480, freeMinutes: 210.5,
                    toKitchenMinutes: 60, atKitchenMinutes: 35.5, carryingMinutes: 174,
                    kmDriven: 52.3, deliveredParts: 14, kmPerDelivery: 3.7,
                },
            },
        });

        render(<CourierPeriodStatsPanel courierId="c1" />);

        const tiles = await screen.findByTestId("courier-productivity-tiles");
        await waitFor(() => expect(mockStats).toHaveBeenCalledWith("c1", today, today));
        // Each value is its label's next sibling, so a swapped pair cannot pass.
        const valueOf = (label: string): string | null | undefined =>
            within(tiles).getByText(label).nextElementSibling?.textContent;
        expect(valueOf("Km driven")).toBe("52.3");
        expect(valueOf("Km / delivery")).toBe("3.7");
        expect(valueOf("On shift")).toBe("8h 0m");
        expect(valueOf("Free")).toBe("3h 31m");
        expect(valueOf("To kitchen")).toBe("1h 0m");
        expect(valueOf("At kitchen")).toBe("36m");
        expect(valueOf("Carrying")).toBe("2h 54m");
    });

    /** Km the server could not measure is a dash, and the reason is printed, not a quiet zero. */
    it("prints unmeasured km as a dash and says why", async () => {
        mockStats.mockResolvedValue({
            ...STATS,
            productivity: {
                gpsDataSince: "2999-01-01",
                splitDataSince: "2999-01-01T00:00:00",
                splitCoverage: "NONE",
                row: {
                    courierId: "c1", name: "ali", onShiftMinutes: 60, freeMinutes: 60,
                    toKitchenMinutes: 0, atKitchenMinutes: 0, carryingMinutes: 0,
                    kmDriven: null, deliveredParts: 0, kmPerDelivery: null,
                },
            },
        });

        render(<CourierPeriodStatsPanel courierId="c1" />);

        const tiles = await screen.findByTestId("courier-productivity-tiles");
        expect(within(tiles).getByText("Km driven").nextElementSibling?.textContent).toBe("—");
        expect(within(tiles).getByText(/is no longer kept/)).toBeTruthy();
        expect(within(tiles).getByText(/in this range it is all counted as free/)).toBeTruthy();
    });

    /** A backend from before M5 sends no `productivity`; the panel must read exactly as before. */
    it("shows no productivity tiles, and does not crash, when the server sends none", async () => {
        render(<CourierPeriodStatsPanel courierId="c1" />);

        expect(await screen.findByText("14.5 min")).toBeTruthy();
        expect(screen.queryByTestId("courier-productivity-tiles")).toBeNull();
        expect(screen.queryByText("Km driven")).toBeNull();
    });
});

