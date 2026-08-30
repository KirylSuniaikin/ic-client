import {jest, describe, it, expect} from "@jest/globals";
import React from "react";
import {render, screen} from "@testing-library/react";
import {DeliveryTab} from "./DeliveryTab";
import type {DeliveryAvailabilityStats, DeliveryHourBucket} from "../../types";

// @mui/x-data-grid needs a TextEncoder polyfill this test environment does not provide, so the
// heatmap is a probe here; its own maths is covered by utils/deliveryHourGrid.test.ts.
jest.mock("../DeliveredByHourTable", () => ({
    DeliveredByHourTable: ({buckets}: {buckets: DeliveryHourBucket[]}) => (
        <div data-testid="delivered-by-hour">{buckets.length}</div>
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

describe("DeliveryTab", () => {
    /**
     * The tab exists to put the two halves of the same question side by side: when delivery WAS
     * bought, and when it could not be. Either one alone answers "do we need another rider" only
     * by guesswork.
     */
    it("shows the delivered heatmap and the unavailability timeline together", () => {
        render(<DeliveryTab hourly={HOURLY} availability={AVAILABILITY} availabilityScope={null}/>);

        expect(screen.getByTestId("delivered-by-hour").textContent).toBe("1");
        expect(screen.getByTestId("no-courier-headline")).toBeTruthy();
        expect(screen.getByText("No Courier By Hour")).toBeTruthy();
    });

    /**
     * "Nothing was delivered" and "still loading" must not render identically — that is the whole
     * reason StatEmptyState exists on this screen.
     */
    it("says nothing was delivered rather than drawing an empty grid", () => {
        render(<DeliveryTab hourly={[]} availability={AVAILABILITY} availabilityScope={null}/>);

        expect(screen.getByText("Nothing was delivered in this range")).toBeTruthy();
        expect(screen.queryByTestId("delivered-by-hour")).toBeNull();
    });

    /**
     * The two fetches fail independently on purpose, so a dead availability endpoint must still
     * leave the delivered grid readable.
     */
    it("still renders the delivered grid when the availability figures are missing", () => {
        render(<DeliveryTab hourly={HOURLY} availability={null} availabilityScope={null}/>);

        expect(screen.getByTestId("delivered-by-hour").textContent).toBe("1");
    });

    // The card is what pins the scope; the tab's only job is not to swallow it on the way through.
    it("forwards the scope the figures were fetched for to the availability card", () => {
        render(
            <DeliveryTab
                hourly={HOURLY}
                availability={AVAILABILITY}
                availabilityScope={{branches: "All branches", range: "Aug 1, 2026 — Aug 30, 2026"}}
            />
        );

        expect(screen.getByTestId("availability-scope").textContent)
            .toBe("All branches · Aug 1, 2026 — Aug 30, 2026");
    });
});
