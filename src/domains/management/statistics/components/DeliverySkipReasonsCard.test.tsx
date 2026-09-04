import {describe, it, expect} from "@jest/globals";
import React from "react";
import {render, screen, within} from "@testing-library/react";
import {DeliverySkipReasonsCard, formatSkipsPerOrder, sortByOrdersAffected} from "./DeliverySkipReasonsCard";
import type {DeliverySkipReasonBucket, DeliverySkipReasonStats} from "../types";

/**
 * Enum order, as the backend always sends it — every reason, including the ones at zero.
 *
 * The numbers encode the distinction the card exists for: TOO_FAR has the most SKIPS (30) but cost
 * only 2 orders, while BUSY_UNTIL has fewer skips (18) and cost 12 orders. A skip-count ranking
 * would point at the coverage map; the orders ranking points at hiring a rider.
 */
const BY_REASON: DeliverySkipReasonBucket[] = [
    {reason: "DECLINED", skips: 4, ordersAffected: 3, couriersAffected: 2},
    {reason: "NO_ANSWER", skips: 6, ordersAffected: 5, couriersAffected: 3},
    {reason: "OFFLINE", skips: 0, ordersAffected: 0, couriersAffected: 0},
    {reason: "BLACKLISTED", skips: 0, ordersAffected: 0, couriersAffected: 0},
    {reason: "PINGING_OTHER_ORDER", skips: 2, ordersAffected: 2, couriersAffected: 1},
    {reason: "NO_RESOLVABLE_FREE_AT", skips: 1, ordersAffected: 1, couriersAffected: 1},
    {reason: "POSITION_STALE", skips: 9, ordersAffected: 4, couriersAffected: 2},
    {reason: "TOO_FAR", skips: 30, ordersAffected: 2, couriersAffected: 5},
    {reason: "BUSY_UNTIL", skips: 18, ordersAffected: 12, couriersAffected: 6},
];

const STATS: DeliverySkipReasonStats = {
    totalSkips: 70,
    // Deliberately smaller than the sum of the rows' ordersAffected (29): one order passed over
    // for two reasons is in both rows and is still one order.
    ordersAffected: 20,
    couriersAffected: 7,
    byReason: BY_REASON,
};

describe("formatSkipsPerOrder", () => {
    // Twenty skips against one order and twenty against twenty are the same skip count and
    // different problems; this ratio is what separates them.
    it("prices the skips against the orders they cost", () => {
        expect(formatSkipsPerOrder(20, 1)).toBe("20.0");
        expect(formatSkipsPerOrder(20, 20)).toBe("1.0");
    });

    // Undefined is not zero, and "0.0" would say the opposite of what happened.
    it("returns a dash rather than a zero ratio when no order was affected", () => {
        expect(formatSkipsPerOrder(0, 0)).toBe("—");
    });
});

describe("sortByOrdersAffected", () => {
    it("ranks by the orders a reason cost, not by how often it fired", () => {
        const sorted = sortByOrdersAffected(BY_REASON);

        expect(sorted[0].reason).toBe("BUSY_UNTIL");
        // TOO_FAR has by far the most skips and is nowhere near the top.
        expect(sorted[0].skips).toBeLessThan(30);
    });

    // A reason that has stopped happening is evidence; dropping the row would hide it.
    it("keeps every reason, including the ones that never fired", () => {
        expect(sortByOrdersAffected(BY_REASON)).toHaveLength(BY_REASON.length);
        expect(sortByOrdersAffected(BY_REASON).map(b => b.reason)).toContain("OFFLINE");
    });

    it("breaks a tie on orders with the skip count", () => {
        const tied: DeliverySkipReasonBucket[] = [
            {reason: "TOO_FAR", skips: 3, ordersAffected: 5, couriersAffected: 1},
            {reason: "BUSY_UNTIL", skips: 9, ordersAffected: 5, couriersAffected: 1},
        ];

        expect(sortByOrdersAffected(tied)[0].reason).toBe("BUSY_UNTIL");
    });
});

describe("DeliverySkipReasonsCard", () => {
    /**
     * Both counts, never one. The card's whole claim is that skips alone cannot tell a stalled
     * ticket from a systemic constraint.
     */
    it("shows the orders a reason cost beside its skip count", () => {
        render(<DeliverySkipReasonsCard stats={STATS} range={null}/>);

        const row = within(screen.getByTestId("skip-row-TOO_FAR"));
        expect(row.getByText("30")).toBeTruthy(); // skips
        expect(row.getByText("2")).toBeTruthy();  // orders it actually cost
        expect(row.getByText("15.0")).toBeTruthy(); // skips per affected order
    });

    // The answer to "which reason cost us the most orders" must be the first row, not the loudest.
    it("puts the reason that cost the most orders at the top and badges it", () => {
        render(<DeliverySkipReasonsCard stats={STATS} range={null}/>);

        const rows = screen.getByTestId("skip-reason-table").querySelectorAll("tbody tr");
        expect(rows[0].getAttribute("data-testid")).toBe("skip-row-BUSY_UNTIL");
        expect(within(screen.getByTestId("skip-row-BUSY_UNTIL")).getByText("most orders")).toBeTruthy();
    });

    // Three reasons price out as three different purchases; the card names them rather than
    // leaving a manager to translate an enum into a decision.
    it("names the purchase each priced reason points to", () => {
        render(<DeliverySkipReasonsCard stats={STATS} range={null}/>);

        expect(within(screen.getByTestId("skip-row-BUSY_UNTIL")).getByText("Hire a rider")).toBeTruthy();
        expect(within(screen.getByTestId("skip-row-TOO_FAR")).getByText("The coverage map is wrong")).toBeTruthy();
        expect(within(screen.getByTestId("skip-row-POSITION_STALE")).getByText("Fix the phones")).toBeTruthy();
    });

    // A real zero is information: it says the problem stopped.
    it("lists a reason that never fired rather than omitting it", () => {
        render(<DeliverySkipReasonsCard stats={STATS} range={null}/>);

        const row = within(screen.getByTestId("skip-row-OFFLINE"));
        expect(row.getByText("Off shift")).toBeTruthy();
        expect(row.getAllByText("0").length).toBeGreaterThan(0);
    });

    // Read as a sum, 29 row-orders against 20 real ones looks like a bug; the caption is what
    // stops the totals being added up.
    it("says out loud that the totals are not the sum of the rows", () => {
        render(<DeliverySkipReasonsCard stats={STATS} range={null}/>);

        expect(screen.getByTestId("skip-orders-headline").textContent).toContain("20");
        expect(screen.getByText(/not the sum of the rows/)).toBeTruthy();
    });

    it("pins the range the figures were fetched for, chain-wide", () => {
        render(<DeliverySkipReasonsCard stats={STATS} range="Aug 1, 2026 — Aug 30, 2026"/>);

        expect(screen.getByTestId("skip-reasons-scope").textContent)
            .toBe("All branches · Aug 1, 2026 — Aug 30, 2026");
    });

    it("shows no scope line while the figures have not arrived", () => {
        render(<DeliverySkipReasonsCard stats={null} range="Aug 1, 2026 — Aug 30, 2026"/>);

        expect(screen.queryByTestId("skip-reasons-scope")).toBeNull();
        expect(screen.queryByTestId("skip-reason-table")).toBeNull();
    });

    /**
     * A badge is an accusation, and it must come from the data rather than from the sort landing
     * somewhere. This payload disagrees with itself — it reports skips while every reason cost
     * zero orders — which is exactly when a top row means nothing and a "most orders" badge would
     * name a culprit the numbers do not support.
     */
    it("names no culprit when no reason cost a single order", () => {
        render(
            <DeliverySkipReasonsCard
                stats={{
                    totalSkips: 5,
                    ordersAffected: 0,
                    couriersAffected: 1,
                    byReason: BY_REASON.map(b => ({...b, ordersAffected: 0})),
                }}
                range={null}
            />
        );

        expect(screen.queryByText("most orders")).toBeNull();
        // Asserted beside a presence check: the absence alone would be satisfied by a blank card.
        expect(screen.getByTestId("skip-reason-table")).toBeTruthy();
    });

    // "Nobody was passed over" and "still loading" must not render identically.
    it("says no rider was passed over rather than drawing a table of zeros", () => {
        render(
            <DeliverySkipReasonsCard
                stats={{totalSkips: 0, ordersAffected: 0, couriersAffected: 0, byReason: BY_REASON}}
                range="Aug 1, 2026"
            />
        );

        expect(screen.getByText("No rider was passed over in this range")).toBeTruthy();
        expect(screen.queryByTestId("skip-reason-table")).toBeNull();
    });
});
