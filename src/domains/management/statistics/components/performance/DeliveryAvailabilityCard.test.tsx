import {describe, it, expect} from "@jest/globals";
import React from "react";
import {render, screen, within} from "@testing-library/react";
import {DeliveryAvailabilityCard, formatOutageDuration, formatSharePct} from "./DeliveryAvailabilityCard";
import type {DeliveryAvailabilityStats} from "../../types";

const stats: DeliveryAvailabilityStats = {
    observedSeconds: 36000,   // 10h open
    unavailableSeconds: 5400, // 1h30 unavailable in total
    byReason: [
        {reason: "NO_COURIER", seconds: 1800, occurrences: 3},
        {reason: "DELIVERY_DISABLED", seconds: 3600, occurrences: 1},
        {reason: "NO_BRANCH", seconds: 0, occurrences: 0},
    ],
    byHour: [
        {dayOfWeek: 5, hour: 19, noCourierSeconds: 1200, observedSeconds: 3600},
        {dayOfWeek: 5, hour: 20, noCourierSeconds: 600, observedSeconds: 3600},
        {dayOfWeek: 1, hour: 19, noCourierSeconds: 0, observedSeconds: 3600},
    ],
};

describe("formatOutageDuration", () => {
    it("renders whole minutes under an hour", () => {
        expect(formatOutageDuration(1800)).toBe("30m");
    });

    it("renders hours and minutes past an hour", () => {
        expect(formatOutageDuration(5400)).toBe("1h 30m");
    });

    it("renders a dash-free zero rather than an empty string", () => {
        expect(formatOutageDuration(0)).toBe("0m");
    });
});

describe("formatSharePct", () => {
    it("returns a dash when nothing was observed, never a divide-by-zero percentage", () => {
        expect(formatSharePct(0, 0)).toBe("—");
    });

    it("expresses the part as a percentage of observed open time", () => {
        expect(formatSharePct(1800, 36000)).toBe("5.0%");
    });
});

describe("DeliveryAvailabilityCard", () => {
    it("headlines the no-courier time on its own, not a blended unavailable total", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        // 30m is NO_COURIER alone. The blended 1h30 unavailable total is never shown as a
        // headline figure anywhere on the card.
        const headline = screen.getByTestId("no-courier-headline");
        expect(within(headline).getByText("30m")).toBeTruthy();
        expect(within(headline).getByText(/5\.0% of open time/)).toBeTruthy();
        expect(screen.queryByText("1h 30m")).toBeNull();
    });

    it("lists every outage reason separately, including one that never occurred", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        const table = screen.getByTestId("outage-reason-table");
        expect(within(table).getByText("No courier")).toBeTruthy();
        expect(within(table).getByText("Switched off")).toBeTruthy();
        expect(within(table).getByText("No branch coordinates")).toBeTruthy();
    });

    /**
     * OUTSIDE_RADIUS / OUTSIDE_ZONE are properties of a customer's PIN, not of a branch's open
     * hours — nothing samples them, so a row for either would be a number nobody could source.
     *
     * The previous version of this asserted the absence of the words "radius" and "zone", which
     * the component has no code path to emit: it passed whatever was rendered, and would only
     * ever have failed on unrelated copy happening to contain those words. What it should pin is
     * the reason set the table actually draws, which is what a new unsampleable reason would
     * change.
     */
    it("never offers a reason the sampler cannot observe", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        const table = screen.getByTestId("outage-reason-table");
        const reasons = within(table).getAllByRole("row")
            .slice(1) // drop the header row
            .map((row) => row.querySelectorAll("td")[0]?.textContent ?? "");

        expect(reasons).toEqual(["No courier", "Switched off", "No branch coordinates"]);
    });

    it("reports how many separate episodes a reason had, not only its total time", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        const table = screen.getByTestId("outage-reason-table");
        const row = within(table).getByText("No courier").closest("tr");
        expect(row).not.toBeNull();
        expect(within(row as HTMLElement).getByText("3")).toBeTruthy();
    });

    it("shows when the shortage happened, hour by hour", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        expect(screen.getByText("19:00")).toBeTruthy();
        expect(screen.getByText("20:00")).toBeTruthy();
        expect(screen.getByText("20m")).toBeTruthy();
        expect(screen.getByText("10m")).toBeTruthy();
    });

    it("distinguishes an unmeasured cell from a measured cell with no shortage", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        // Monday 19:00 was observed and fine; Monday 20:00 was never observed at all.
        // The second must read as a dash, so "we were shut" cannot look like "we were fine".
        expect(screen.getAllByTitle("not open / not measured").length).toBeGreaterThan(0);
        expect(screen.getByTitle("0m of 1h 0m open")).toBeTruthy();
    });

    it("shows an empty state rather than a wall of zeros when nothing was recorded", () => {
        render(<DeliveryAvailabilityCard stats={{
            observedSeconds: 0, unavailableSeconds: 0, byReason: [], byHour: [],
        }} scope={null}/>);

        expect(screen.getByText("No delivery availability recorded in this range")).toBeTruthy();
    });

    it("renders a skeleton while the stats are still loading", () => {
        const {container} = render(<DeliveryAvailabilityCard stats={null} scope={null}/>);

        expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    });
});

/**
 * Admin item 3. The owner watched the same total drop from 5h to 4h10m, and no code path shortens
 * or reclassifies a recorded period — extension is forward-only and every state change inserts a
 * new row. The likeliest explanation is this card: its headline reports ONE bucket while its title
 * says "Delivery Unavailable" and its subtitle read like a total. So the number is labelled for
 * what it is, the other buckets stand beside it, and the scope is pinned so two readings can
 * actually be compared.
 *
 * None of that blends the buckets, and these tests are what stops a later change doing so.
 */
describe("DeliveryAvailabilityCard — what the headline is a headline OF", () => {
    const SCOPE = {branches: "Manama", range: "Aug 1, 2026 — Aug 30, 2026"};

    it("shows every other reason beside the headline, as its own labelled figure", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        const switchedOff = screen.getByTestId("outage-figure-DELIVERY_DISABLED");
        expect(within(switchedOff).getByText("Switched off")).toBeTruthy();
        expect(within(switchedOff).getByText("1h 0m")).toBeTruthy();

        const noBranch = screen.getByTestId("outage-figure-NO_BRANCH");
        expect(within(noBranch).getByText("No branch coordinates")).toBeTruthy();
        expect(within(noBranch).getByText("0m")).toBeTruthy();
    });

    /**
     * The enum's own comment forbids the merge: NO_COURIER is the staffing number and
     * DELIVERY_DISABLED is a manager's own switch, so a blended total would make a deliberate
     * shutdown read as a courier shortage. 30m + 1h0m must never appear as 1h 30m.
     */
    it("still never prints a blended unavailable total, only the buckets", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        expect(screen.queryByText("1h 30m")).toBeNull();
        expect(within(screen.getByTestId("no-courier-headline")).getByText("30m")).toBeTruthy();
    });

    it("never puts a second reason inside the no-courier headline", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        const headline = screen.getByTestId("no-courier-headline");
        expect(within(headline).queryByText("Switched off")).toBeNull();
        expect(within(headline).queryByText("1h 0m")).toBeNull();
    });

    it("pins the branches and the date range the figures were fetched for", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={SCOPE}/>);

        expect(screen.getByTestId("availability-scope").textContent)
            .toBe("Manama · Aug 1, 2026 — Aug 30, 2026");
    });

    // The no-provider fallback branch carries an empty name, and "· Aug 1" with nothing before it
    // reads as a rendering bug rather than as an unnamed branch.
    it("drops the separator when the branch has no name to show", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={{branches: "", range: "Aug 1, 2026"}}/>);

        expect(screen.getByTestId("availability-scope").textContent).toBe("Aug 1, 2026");
    });

    it("shows no scope line at all before the first fetch has landed", () => {
        render(<DeliveryAvailabilityCard stats={stats} scope={null}/>);

        expect(screen.queryByTestId("availability-scope")).toBeNull();
    });
});
