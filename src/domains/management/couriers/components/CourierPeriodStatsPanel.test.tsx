import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
});
