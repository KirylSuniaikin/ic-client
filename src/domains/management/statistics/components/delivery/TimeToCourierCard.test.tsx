import {jest, describe, it, expect, beforeEach} from "@jest/globals";
import React from "react";
import {render, screen, within} from "@testing-library/react";

import {TimeToCourierCard} from "./TimeToCourierCard";
import type {TimeToCourierStats, WaitSummary} from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../../shared/api/management");

import {fetchTimeToCourierStats} from "../../../../../shared/api/management";

const mockFetch = jest.mocked(fetchTimeToCourierStats);

const SCOPE = {startDate: "2026-10-01", finishDate: "2026-10-06"};

function wait(overrides: Partial<WaitSummary> = {}): WaitSummary {
    return {
        sampleCount: 78,
        meanMinutes: 1.3,
        medianMinutes: 0.4,
        p90Minutes: 6.2,
        over5Minutes: 9,
        over10Minutes: 3,
        ...overrides,
    };
}

function stats(overrides: Partial<TimeToCourierStats> = {}): TimeToCourierStats {
    return {
        dataSince: "2026-09-01T15:00:00",
        coverage: "FULL",
        deliveredParts: 120,
        measuredParts: 80,
        readyToAssigned: wait(),
        firstOfferToAssigned: wait({sampleCount: 70, meanMinutes: 2.1, medianMinutes: 1.5, p90Minutes: 4.4,
            over5Minutes: 4, over10Minutes: 0}),
        assignedBeforeReady: 55,
        assignedWithoutOffer: 10,
        ...overrides,
    };
}

async function renderLoaded(report: TimeToCourierStats): Promise<void> {
    mockFetch.mockResolvedValue(report);
    render(<TimeToCourierCard scope={SCOPE}/>);
    await screen.findByTestId("time-to-courier-scope");
}

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("TimeToCourierCard", () => {
    it("asks for the applied range, chain-wide", async () => {
        await renderLoaded(stats());

        // Exactly two arguments: a third would be a branch filter, and this card sits among the
        // chain-wide ones it must reconcile with.
        expect(mockFetch.mock.calls[0]).toEqual(["2026-10-01", "2026-10-06"]);
        expect(screen.getByTestId("time-to-courier-scope").textContent).toBe("All branches · Oct 1, 2026 — Oct 6, 2026");
    });

    it("leads with the typical wait, then the tail", async () => {
        await renderLoaded(stats());

        const ready = screen.getByTestId("ttc-headline-readyToAssigned");
        expect(ready.textContent).toContain("0.4");
        expect(ready.textContent).toContain("p90 6.2 · 9 over 5 min · 3 over 10 min");
        expect(screen.getByTestId("ttc-measured").textContent).toContain("80 of 120");
    });

    it("tables both waits with the share of each over 5 and 10 minutes", async () => {
        await renderLoaded(stats());

        const row = screen.getByTestId("ttc-row-readyToAssigned");
        const cells = within(row).getAllByRole("cell").map((cell) => cell.textContent);
        expect(cells.slice(1)).toEqual(["78 of 120", "0.4", "6.2", "1.3", "9 (11.5%)", "3 (3.8%)"]);
        expect(within(screen.getByTestId("ttc-row-firstOfferToAssigned")).getAllByRole("cell")[1].textContent)
            .toBe("70 of 120");
        expect(screen.getByTestId("ttc-footnote").textContent).toContain("55 assigned before the food was Ready");
        expect(screen.getByTestId("ttc-footnote").textContent).toContain("10 assigned without an offer");
    });

    /** An empty sample prints dashes: "no wait" and "not measured" must not look alike. */
    it("prints dashes, not zeros, for a wait with no samples", async () => {
        await renderLoaded(stats({
            firstOfferToAssigned: wait({sampleCount: 0, meanMinutes: null, medianMinutes: null, p90Minutes: null,
                over5Minutes: 0, over10Minutes: 0}),
        }));

        const cells = within(screen.getByTestId("ttc-row-firstOfferToAssigned")).getAllByRole("cell")
            .map((cell) => cell.textContent);
        expect(cells.slice(2)).toEqual(["—", "—", "—", "—", "—"]);
        expect(screen.getByTestId("ttc-headline-firstOfferToAssigned").textContent).toContain("no measurable drop-offs");
    });

    it("says nothing was delivered rather than drawing an empty table", async () => {
        await renderLoaded(stats({deliveredParts: 0, measuredParts: 0, readyToAssigned: wait({sampleCount: 0}),
            firstOfferToAssigned: wait({sampleCount: 0})}));

        expect(screen.getByText("No delivery orders were completed in this range")).toBeTruthy();
        expect(screen.queryByTestId("time-to-courier-table")).toBeNull();
    });

    /** A range that started before recording shows its figures, and says from when they count. */
    it("captions a partly recorded range with the moment recording began", async () => {
        await renderLoaded(stats({coverage: "PARTIAL", dataSince: "2026-10-03T15:00:00"}));

        expect(screen.getByTestId("time-to-courier-coverage").textContent)
            .toBe("Counted from 3 Oct 2026, 15:00. Earlier days in this range have no data.");
        expect(screen.getByTestId("time-to-courier-table")).toBeTruthy();
    });

    /** Before recording began there is nothing to show — and certainly not a row of zeros. */
    it("says there is no data before the deploy instead of showing figures", async () => {
        await renderLoaded(stats({
            coverage: "NONE", dataSince: "2026-10-07T15:00:00", measuredParts: null,
            readyToAssigned: null, firstOfferToAssigned: null, assignedBeforeReady: null, assignedWithoutOffer: null,
        }));

        expect(screen.getByTestId("time-to-courier-no-data").textContent).toBe("No data before 7 Oct 2026, 15:00");
        expect(screen.queryByTestId("time-to-courier-table")).toBeNull();
        expect(screen.queryByTestId("ttc-headline-readyToAssigned")).toBeNull();
        expect(screen.queryByText("0")).toBeNull();
        expect(screen.getByText(/120 drop-offs in this range were delivered before/)).toBeTruthy();
    });

    it("shows an error rather than a skeleton when the request fails", async () => {
        mockFetch.mockRejectedValue(new Error("HTTP 500"));

        render(<TimeToCourierCard scope={SCOPE}/>);

        expect((await screen.findByTestId("time-to-courier-error")).textContent)
            .toBe("Could not load the time to a courier for this range.");
        expect(screen.queryByTestId("time-to-courier-scope")).toBeNull();
    });

    it("fetches nothing and shows the skeleton until a range has been applied", () => {
        render(<TimeToCourierCard scope={null}/>);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(document.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    });
});
