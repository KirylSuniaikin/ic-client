import {jest, describe, it, expect} from "@jest/globals";
import React from "react";
import {render, screen} from "@testing-library/react";
import {DeliveryTab} from "./DeliveryTab";
import type {
    DeliveryAvailabilityStats,
    DeliveryEstimateAccuracy,
    DeliveryHourBucket,
    DeliverySkipReasonStats,
} from "../../types";

// @mui/x-data-grid needs a TextEncoder polyfill this test environment does not provide, so the
// heatmap is a probe here; its own maths is covered by utils/deliveryHourGrid.test.ts.
jest.mock("../DeliveredByHourTable", () => ({
    DeliveredByHourTable: ({buckets}: {buckets: DeliveryHourBucket[]}) => (
        <div data-testid="delivered-by-hour">{buckets.length}</div>
    ),
}));

// The zones card fetches for itself and draws a Google map; both are covered by
// DeliveryZoneStatsCard.test.tsx. Here it is a probe on what the tab hands it.
jest.mock("../DeliveryZoneStatsCard", () => ({
    DeliveryZoneStatsCard: ({scope}: {scope: {startDate: string; finishDate: string} | null}) => (
        <div data-testid="zone-stats-probe">{scope === null ? "none" : `${scope.startDate}..${scope.finishDate}`}</div>
    ),
}));

// The four metric cards (M1–M5) fetch for themselves and have their own suites; here each is a
// probe that prints the range the tab handed it, so placement and scope can be asserted. The
// `mock` prefix is what lets the hoisted factories reach the helper.
function mockScopeText(scope: {startDate: string; finishDate: string} | null): string {
    return scope === null ? "none" : `${scope.startDate}..${scope.finishDate}`;
}
jest.mock("../delivery/LostDemandCard", () => ({
    LostDemandCard: ({scope}: {scope: {startDate: string; finishDate: string} | null}) => (
        <div data-testid="metric-probe-lost-demand">{mockScopeText(scope)}</div>
    ),
}));
jest.mock("../delivery/DeliveryQualityCard", () => ({
    DeliveryQualityCard: ({scope}: {scope: {startDate: string; finishDate: string} | null}) => (
        <div data-testid="metric-probe-quality">{mockScopeText(scope)}</div>
    ),
}));
jest.mock("../delivery/TimeToCourierCard", () => ({
    TimeToCourierCard: ({scope}: {scope: {startDate: string; finishDate: string} | null}) => (
        <div data-testid="metric-probe-time-to-courier">{mockScopeText(scope)}</div>
    ),
}));
jest.mock("../delivery/CourierProductivityCard", () => ({
    CourierProductivityCard: ({scope}: {scope: {startDate: string; finishDate: string} | null}) => (
        <div data-testid="metric-probe-productivity">{mockScopeText(scope)}</div>
    ),
}));

const AVAILABILITY: DeliveryAvailabilityStats = {
    observedSeconds: 3600,
    unavailableSeconds: 600,
    byReason: [
        {reason: "NO_COURIER", seconds: 600, occurrences: 2},
        {reason: "DELIVERY_DISABLED", seconds: 0, occurrences: 0},
        {reason: "NO_BRANCH", seconds: 0, occurrences: 0},
    ],
    byHour: [{dayOfWeek: 5, hour: 19, noCourierSeconds: 600, observedSeconds: 3600}],
};

const HOURLY: DeliveryHourBucket[] = [{dayOfWeek: 5, hour: 19, total: 120, count: 6}];

const ACCURACY: DeliveryEstimateAccuracy = {
    deliveredOrders: 10,
    deliveredOrderCount: 10,
    legs: [{
        leg: "KITCHEN",
        sampleCount: 10,
        unmeasurableCount: 0,
        quotedMeanMinutes: 20,
        actualMeanMinutes: 26,
        gapMeanMinutes: 6,
        gapMedianMinutes: 5.5,
        gapP90Minutes: 11,
        gapMinMinutes: -1,
        gapMaxMinutes: 14,
        earlyCount: 0,
        onTimeCount: 2,
        lateCount: 8,
        toleranceMinutes: 2,
        distribution: [{fromMinutes: null, toMinutes: -20, count: 0}, {fromMinutes: 20, toMinutes: null, count: 1}],
    }],
    orderTotalTime: {sampleCount: 10, medianMinutes: 40, meanMinutes: 41, p90Minutes: 55},
};

const SKIPS: DeliverySkipReasonStats = {
    totalSkips: 5,
    ordersAffected: 3,
    couriersAffected: 2,
    byReason: [{reason: "BUSY_UNTIL", skips: 5, ordersAffected: 3, couriersAffected: 2}],
};

// The four cards are independent; a case that only cares about one passes nothing for the rest.
const NO_CHAIN_STATS = {estimateAccuracy: null, skipReasons: null, chainRange: null, chainScope: null};

describe("DeliveryTab", () => {
    /**
     * The tab exists to put the two halves of the same question side by side: when delivery WAS
     * bought, and when it could not be. Either one alone answers "do we need another rider" only
     * by guesswork.
     */
    it("shows the delivered heatmap and the unavailability timeline together", () => {
        render(<DeliveryTab hourly={HOURLY} availability={AVAILABILITY} availabilityScope={null} {...NO_CHAIN_STATS}/>);

        expect(screen.getByTestId("delivered-by-hour").textContent).toBe("1");
        expect(screen.getByTestId("no-courier-headline")).toBeTruthy();
        expect(screen.getByText("No Courier By Hour")).toBeTruthy();
    });

    /**
     * "Nothing was delivered" and "still loading" must not render identically — that is the whole
     * reason StatEmptyState exists on this screen.
     */
    it("says nothing was delivered rather than drawing an empty grid", () => {
        render(<DeliveryTab hourly={[]} availability={AVAILABILITY} availabilityScope={null} {...NO_CHAIN_STATS}/>);

        expect(screen.getByText("Nothing was delivered in this range")).toBeTruthy();
        expect(screen.queryByTestId("delivered-by-hour")).toBeNull();
    });

    /**
     * The two fetches fail independently on purpose, so a dead availability endpoint must still
     * leave the delivered grid readable.
     */
    it("still renders the delivered grid when the availability figures are missing", () => {
        render(<DeliveryTab hourly={HOURLY} availability={null} availabilityScope={null} {...NO_CHAIN_STATS}/>);

        expect(screen.getByTestId("delivered-by-hour").textContent).toBe("1");
    });

    // The card is what pins the scope; the tab's only job is not to swallow it on the way through.
    it("forwards the scope the figures were fetched for to the availability card", () => {
        render(
            <DeliveryTab
                hourly={HOURLY}
                availability={AVAILABILITY}
                availabilityScope={{branches: "All branches", range: "Aug 1, 2026 — Aug 30, 2026"}}
                {...NO_CHAIN_STATS}
            />
        );

        expect(screen.getByTestId("availability-scope").textContent)
            .toBe("All branches · Aug 1, 2026 — Aug 30, 2026");
    });

    /**
     * The two feedback loops delivery-manual.html §06 lists as open (D and E) live on this tab, on
     * the same range as the grids above them. Without them the tab shows when delivery sold and
     * when it was off, and nothing about whether the times we quote are true.
     */
    it("shows the estimate-accuracy and skip-reason cards beside the two grids", () => {
        render(
            <DeliveryTab
                hourly={HOURLY}
                availability={AVAILABILITY}
                availabilityScope={null}
                estimateAccuracy={ACCURACY}
                skipReasons={SKIPS}
                chainRange={null}
                chainScope={null}
            />
        );

        expect(screen.getByTestId("estimate-accuracy-table")).toBeTruthy();
        expect(screen.getByTestId("skip-reason-table")).toBeTruthy();
    });

    /**
     * The chain-wide range is labelled WITHOUT a branch: both endpoints behind these two cards are
     * read unscoped, so a branch name beside their figures would describe a narrower question than
     * the one that was asked.
     */
    it("labels the chain-wide cards with the fetched range and no branch", () => {
        render(
            <DeliveryTab
                hourly={HOURLY}
                availability={AVAILABILITY}
                availabilityScope={{branches: "Seef", range: "Aug 1, 2026 — Aug 30, 2026"}}
                estimateAccuracy={ACCURACY}
                skipReasons={SKIPS}
                chainRange="Aug 1, 2026 — Aug 30, 2026"
                chainScope={{startDate: "2026-08-01", finishDate: "2026-08-30"}}
            />
        );

        expect(screen.getByTestId("estimate-accuracy-scope").textContent)
            .toBe("All branches · Aug 1, 2026 — Aug 30, 2026");
        expect(screen.getByTestId("skip-reasons-scope").textContent)
            .toBe("All branches · Aug 1, 2026 — Aug 30, 2026");
        // The branch-scoped card beside them still names its branch: the two scopes are different
        // questions and must not be collapsed into one label.
        expect(screen.getByTestId("availability-scope").textContent)
            .toBe("Seef · Aug 1, 2026 — Aug 30, 2026");
    });

    // Each delivery fetch fails on its own, so a dead estimate-accuracy endpoint must leave the
    // skip reasons readable rather than blanking the half of the tab they share.
    it("keeps the skip-reason card when the estimate-accuracy figures are missing", () => {
        render(
            <DeliveryTab
                hourly={HOURLY}
                availability={AVAILABILITY}
                availabilityScope={null}
                estimateAccuracy={null}
                skipReasons={SKIPS}
                chainRange="Aug 1, 2026"
                chainScope={{startDate: "2026-08-01", finishDate: "2026-08-01"}}
            />
        );

        expect(screen.queryByTestId("estimate-accuracy-table")).toBeNull();
        expect(screen.getByTestId("skip-reason-table")).toBeTruthy();
    });

    /**
     * The zones map counts the same delivered orders as the estimate-accuracy card, so it has to be
     * read over the same window: the APPLIED chain-wide range, which is all the tab hands it. It is
     * given no branch selection on purpose — the branch filter above does not narrow the card it is
     * reconciled against either.
     */
    it("gives the zones card the applied chain-wide range and no branch selection", () => {
        render(
            <DeliveryTab
                hourly={HOURLY}
                availability={AVAILABILITY}
                availabilityScope={{branches: "Seef", range: "Aug 1, 2026 — Aug 30, 2026"}}
                estimateAccuracy={ACCURACY}
                skipReasons={SKIPS}
                chainRange="Aug 1, 2026 — Aug 30, 2026"
                chainScope={{startDate: "2026-08-01", finishDate: "2026-08-30"}}
            />
        );

        expect(screen.getByTestId("zone-stats-probe").textContent).toBe("2026-08-01..2026-08-30");
    });

    // Before the first refresh lands there is no applied range, and the card must not invent one.
    it("gives the zones card no range before one has been applied", () => {
        render(<DeliveryTab hourly={HOURLY} availability={AVAILABILITY} availabilityScope={null} {...NO_CHAIN_STATS}/>);

        expect(screen.getByTestId("zone-stats-probe").textContent).toBe("none");
    });

    /**
     * Lost demand sits beside availability (both answer "when could they not buy"), quality after
     * estimate accuracy (the promise, then whether it was kept), and the two courier cards last.
     */
    it("places the four metric cards where the tab reads them, all on the chain-wide range", () => {
        const {container} = render(
            <DeliveryTab
                hourly={HOURLY}
                availability={AVAILABILITY}
                availabilityScope={{branches: "Seef", range: "Oct 1, 2026 — Oct 6, 2026"}}
                estimateAccuracy={ACCURACY}
                skipReasons={SKIPS}
                chainRange="Oct 1, 2026 — Oct 6, 2026"
                chainScope={{startDate: "2026-10-01", finishDate: "2026-10-06"}}
            />
        );

        const order = Array.from(container.querySelectorAll(
            "[data-testid='availability-scope'], [data-testid^='metric-probe-'], [data-testid='zone-stats-probe'], " +
            "[data-testid='estimate-accuracy-scope'], [data-testid='skip-reasons-scope']"
        )).map((node) => node.getAttribute("data-testid"));
        expect(order).toEqual([
            "availability-scope",
            "metric-probe-lost-demand",
            "zone-stats-probe",
            "estimate-accuracy-scope",
            "metric-probe-quality",
            "skip-reasons-scope",
            "metric-probe-time-to-courier",
            "metric-probe-productivity",
        ]);
        for (const id of ["lost-demand", "quality", "time-to-courier", "productivity"]) {
            expect(screen.getByTestId(`metric-probe-${id}`).textContent).toBe("2026-10-01..2026-10-06");
        }
    });

    it("gives the metric cards no range before one has been applied", () => {
        render(<DeliveryTab hourly={HOURLY} availability={AVAILABILITY} availabilityScope={null} {...NO_CHAIN_STATS}/>);

        for (const id of ["lost-demand", "quality", "time-to-courier", "productivity"]) {
            expect(screen.getByTestId(`metric-probe-${id}`).textContent).toBe("none");
        }
    });
});

