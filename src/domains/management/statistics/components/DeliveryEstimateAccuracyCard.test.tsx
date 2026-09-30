import {describe, it, expect} from "@jest/globals";
import React from "react";
import {render, screen, within} from "@testing-library/react";
import {
    bucketTone,
    DeliveryEstimateAccuracyCard,
    formatBucketLabel,
    formatGapMinutes,
    formatMinutes,
    passWaitMinutes,
} from "./DeliveryEstimateAccuracyCard";
import type {DeliveryEstimateAccuracy, DeliveryGapBucket, DeliveryLegAccuracy} from "../types";

// The fixed edges the backend emits: -20, -10, -5, -2, 2, 5, 10, 20, with both ends open.
function distribution(counts: number[]): DeliveryGapBucket[] {
    const edges: Array<[number | null, number | null]> = [
        [null, -20], [-20, -10], [-10, -5], [-5, -2], [-2, 2], [2, 5], [5, 10], [10, 20], [20, null],
    ];
    return edges.map(([fromMinutes, toMinutes], i) => ({fromMinutes, toMinutes, count: counts[i]}));
}

/**
 * The scenario the whole feature exists for: the kitchen runs eight minutes long, the road runs
 * eight minutes short, and the total is very nearly perfect. Read as a single number it looks like
 * a well-tuned estimate; it is two broken ones.
 */
const KITCHEN: DeliveryLegAccuracy = {
    leg: "KITCHEN",
    sampleCount: 40,
    unmeasurableCount: 0,
    quotedMeanMinutes: 20,
    actualMeanMinutes: 28,
    gapMeanMinutes: 8,
    gapMedianMinutes: 7.5,
    gapP90Minutes: 14,
    gapMinMinutes: -3,
    gapMaxMinutes: 22,
    earlyCount: 2,
    onTimeCount: 6,
    lateCount: 32,
    toleranceMinutes: 2,
    distribution: distribution([0, 0, 0, 2, 6, 8, 12, 10, 2]),
};

const ROAD: DeliveryLegAccuracy = {
    leg: "ROAD",
    sampleCount: 40,
    unmeasurableCount: 0,
    quotedMeanMinutes: 15,
    actualMeanMinutes: 7,
    gapMeanMinutes: -8,
    gapMedianMinutes: -8.5,
    gapP90Minutes: -1,
    gapMinMinutes: -21,
    gapMaxMinutes: 4,
    earlyCount: 30,
    onTimeCount: 4,
    lateCount: 6,
    toleranceMinutes: 2,
    distribution: distribution([2, 10, 12, 6, 4, 4, 2, 0, 0]),
};

const TOTAL: DeliveryLegAccuracy = {
    leg: "TOTAL",
    sampleCount: 40,
    unmeasurableCount: 0,
    quotedMeanMinutes: 35,
    actualMeanMinutes: 36,
    gapMeanMinutes: 1,
    gapMedianMinutes: 0.5,
    gapP90Minutes: 6,
    gapMinMinutes: -9,
    gapMaxMinutes: 18,
    earlyCount: 8,
    onTimeCount: 24,
    lateCount: 8,
    toleranceMinutes: 2,
    distribution: distribution([0, 0, 4, 4, 24, 4, 2, 2, 0]),
};

const ORDER_TOTAL = {sampleCount: 30, medianMinutes: 41.5, meanMinutes: 43.2, p90Minutes: 58};
const STATS: DeliveryEstimateAccuracy = {
    deliveredOrders: 40,
    legs: [KITCHEN, ROAD, TOTAL],
    orderTotalTime: ORDER_TOTAL,
    deliveredOrderCount: 30,
};

// A leg nothing could be measured on. Every figure is null and the counts are zero — the shape the
// backend sends for a leg with no samples at all.
const UNMEASURED: DeliveryLegAccuracy = {
    leg: "ROAD",
    sampleCount: 0,
    unmeasurableCount: 40,
    quotedMeanMinutes: null,
    actualMeanMinutes: null,
    gapMeanMinutes: null,
    gapMedianMinutes: null,
    gapP90Minutes: null,
    gapMinMinutes: null,
    gapMaxMinutes: null,
    earlyCount: 0,
    onTimeCount: 0,
    lateCount: 0,
    toleranceMinutes: 2,
    distribution: distribution([0, 0, 0, 0, 0, 0, 0, 0, 0]),
};

describe("formatGapMinutes", () => {
    // The sign IS the reading. Without the plus, "8.0" beside "-8.0" is read as a magnitude.
    it("prints the plus on a late gap so the direction is never inferred", () => {
        expect(formatGapMinutes(8)).toBe("+8.0");
    });

    it("keeps the minus on an early gap", () => {
        expect(formatGapMinutes(-8.5)).toBe("-8.5");
    });

    // The rule the whole card is built on: null means "no samples", and 0 means "we were exact".
    it("renders a missing gap as a dash, never as a zero", () => {
        expect(formatGapMinutes(null)).toBe("—");
    });

    it("still renders a genuine zero as a zero", () => {
        expect(formatGapMinutes(0)).toBe("0.0");
    });
});

describe("formatMinutes", () => {
    it("renders a missing quote as a dash rather than an instant delivery", () => {
        expect(formatMinutes(null)).toBe("—");
    });

    it("renders a measured quote to one decimal", () => {
        expect(formatMinutes(20)).toBe("20.0");
    });
});

describe("formatBucketLabel", () => {
    // An open end printed as a number would hide the tail this report exists to expose.
    it("renders the first bucket as unbounded-early", () => {
        expect(formatBucketLabel({fromMinutes: null, toMinutes: -20, count: 0})).toBe("under -20");
    });

    it("renders the last bucket as unbounded-late", () => {
        expect(formatBucketLabel({fromMinutes: 20, toMinutes: null, count: 0})).toBe("+20 and later");
    });

    it("renders an interior bucket with both signs", () => {
        expect(formatBucketLabel({fromMinutes: -2, toMinutes: 2, count: 0})).toBe("-2 to +2");
    });
});

describe("bucketTone", () => {
    // The band comes from the payload, never from a hard-coded 2 — the backend echoes it back
    // precisely so a client cannot colour the middle bucket wrong when it changes.
    it("treats the bucket that spans the tolerance band as on time", () => {
        expect(bucketTone({fromMinutes: -2, toMinutes: 2, count: 0}, 2)).toBe("onTime");
    });

    it("treats a bucket ending at the early edge as early", () => {
        expect(bucketTone({fromMinutes: -5, toMinutes: -2, count: 0}, 2)).toBe("early");
    });

    it("treats a bucket starting at the late edge as late", () => {
        expect(bucketTone({fromMinutes: 2, toMinutes: 5, count: 0}, 2)).toBe("late");
    });

    it("follows a widened band rather than the ±2 the fixtures happen to use", () => {
        expect(bucketTone({fromMinutes: 2, toMinutes: 5, count: 0}, 10)).toBe("onTime");
    });
});

describe("passWaitMinutes", () => {
    /**
     * TOTAL is measured end to end and is not KITCHEN + ROAD; what is left over is the food
     * waiting on the pass for a rider. Here: +1 total, +8 kitchen, -8 road → 1 minute of wait.
     */
    it("derives the unquoted wait from the three gaps", () => {
        expect(passWaitMinutes([KITCHEN, ROAD, TOTAL])).toBeCloseTo(1, 5);
    });

    // Across different sample sets the subtraction is arithmetic on unrelated means, and a
    // fictional number here is the one a manager would act on.
    it("refuses to derive a wait when the legs were measured on different orders", () => {
        expect(passWaitMinutes([KITCHEN, {...ROAD, sampleCount: 31}, TOTAL])).toBeNull();
    });

    it("refuses to derive a wait when a leg has no samples at all", () => {
        expect(passWaitMinutes([{...KITCHEN, sampleCount: 0, gapMeanMinutes: null}, ROAD, TOTAL])).toBeNull();
    });
});

describe("DeliveryEstimateAccuracyCard", () => {
    /**
     * The reason the card exists. A single accuracy number for this window would read "+0.5, we
     * are fine"; the split says the kitchen is eight minutes long and the road eight minutes
     * short, which is two fixes, not none.
     */
    it("splits the gap by leg instead of reporting one blended figure", () => {
        render(<DeliveryEstimateAccuracyCard stats={STATS} range={null}/>);

        expect(within(screen.getByTestId("leg-headline-KITCHEN")).getByText("+7.5")).toBeTruthy();
        expect(within(screen.getByTestId("leg-headline-ROAD")).getByText("-8.5")).toBeTruthy();
        expect(within(screen.getByTestId("leg-headline-TOTAL")).getByText("+0.5")).toBeTruthy();
    });

    // The median is the typical order; the mean is what a tail drags. Both are on screen so the
    // reader can see when they disagree.
    it("shows the median, the p90 and the mean rather than a mean alone", () => {
        render(<DeliveryEstimateAccuracyCard stats={STATS} range={null}/>);

        const row = within(screen.getByTestId("leg-row-KITCHEN"));
        expect(row.getByText("+7.5")).toBeTruthy();  // median
        expect(row.getByText("+14.0")).toBeTruthy(); // p90
        expect(row.getByText("+8.0")).toBeTruthy();  // mean
    });

    /**
     * The distribution, not a summary of it. A leg that is ten minutes early half the time and ten
     * late the other half averages to zero — the buckets are the only place that shows.
     */
    it("draws every fixed bucket, including the empty ones and both open ends", () => {
        render(<DeliveryEstimateAccuracyCard stats={STATS} range={null}/>);

        expect(screen.getByText("under -20")).toBeTruthy();
        expect(screen.getByText("+20 and later")).toBeTruthy();
        // The kitchen never delivered early enough to reach the first bucket; the row is still
        // drawn, at zero, because an omitted bucket would read as a rendering fault.
        expect(screen.getByTestId("bucket-KITCHEN-0").textContent).toContain("0");
        expect(screen.getByTestId("bucket-ROAD-1").textContent).toContain("10");
    });

    /**
     * The trap this card is most likely to fall into: a leg with no samples rendering as a row of
     * confident zeros. "We were exactly on time" and "we could not measure it" are opposite
     * statements.
     */
    it("renders an unmeasurable leg as dashes and never as zeros", () => {
        render(
            <DeliveryEstimateAccuracyCard
                stats={{deliveredOrders: 40, deliveredOrderCount: 30, legs: [KITCHEN, UNMEASURED, TOTAL], orderTotalTime: ORDER_TOTAL}}
                range={null}
            />
        );

        const headline = within(screen.getByTestId("leg-headline-ROAD"));
        expect(headline.getByText("—")).toBeTruthy();
        expect(headline.queryByText("0.0")).toBeNull();
        expect(headline.getByText(/no measurable orders/)).toBeTruthy();
    });

    // A leg measured on 12 of 400 orders is not evidence, and the reader must see that without
    // asking for it.
    it("prints the denominator beside every leg's sample count", () => {
        render(
            <DeliveryEstimateAccuracyCard
                stats={{deliveredOrders: 40, deliveredOrderCount: 30, legs: [KITCHEN, {...ROAD, sampleCount: 12, unmeasurableCount: 28}, TOTAL], orderTotalTime: ORDER_TOTAL}}
                range={null}
            />
        );

        const row = within(screen.getByTestId("leg-row-ROAD"));
        expect(row.getByText(/12 of 40/)).toBeTruthy();
        expect(row.getByText(/28 unmeasurable/)).toBeTruthy();
    });

    // The span nobody quotes: it is why the estimates can both be perfect and the customer late.
    it("states the unquoted wait on the pass when the legs share a sample set", () => {
        render(<DeliveryEstimateAccuracyCard stats={STATS} range={null}/>);

        expect(screen.getByTestId("pass-wait").textContent).toContain("1.0");
    });

    it("says nothing about the wait on the pass when it cannot be derived", () => {
        render(
            <DeliveryEstimateAccuracyCard
                stats={{deliveredOrders: 40, deliveredOrderCount: 30, legs: [KITCHEN, UNMEASURED, TOTAL], orderTotalTime: ORDER_TOTAL}}
                range={null}
            />
        );

        expect(screen.queryByTestId("pass-wait")).toBeNull();
        // Asserted alongside a presence check: a null render would satisfy the absence on its own.
        expect(screen.getByTestId("estimate-accuracy-table")).toBeTruthy();
    });

    /**
     * The applied range, and "All branches" — these figures are fetched with no branch filter, so
     * naming the selected branch beside them would be a straight lie.
     */
    it("pins the range the figures were fetched for, chain-wide", () => {
        render(<DeliveryEstimateAccuracyCard stats={STATS} range="Aug 1, 2026 — Aug 30, 2026"/>);

        expect(screen.getByTestId("estimate-accuracy-scope").textContent)
            .toBe("All branches · Aug 1, 2026 — Aug 30, 2026");
    });

    it("shows no scope line at all while the figures have not arrived", () => {
        render(<DeliveryEstimateAccuracyCard stats={null} range="Aug 1, 2026 — Aug 30, 2026"/>);

        expect(screen.queryByTestId("estimate-accuracy-scope")).toBeNull();
        expect(screen.queryByTestId("estimate-accuracy-table")).toBeNull();
    });

    // "Nothing was delivered" and "still loading" must not render identically.
    it("says nothing was delivered rather than drawing a table of zeros", () => {
        render(
            <DeliveryEstimateAccuracyCard
                stats={{deliveredOrders: 0, deliveredOrderCount: 0, legs: [UNMEASURED], orderTotalTime: ORDER_TOTAL}}
                range="Aug 1, 2026"
            />
        );

        expect(screen.getByText("No delivery orders were completed in this range")).toBeTruthy();
        expect(screen.queryByTestId("estimate-accuracy-table")).toBeNull();
    });

    describe("whole-order total time", () => {
        it("renders the median, mean, p90 and the measured count", () => {
            render(<DeliveryEstimateAccuracyCard stats={STATS} range={null}/>);

            const block = within(screen.getByTestId("order-total-headline"));
            expect(block.getByText(/Whole order · placed → last drop-off/)).toBeTruthy();
            expect(block.getByText("41.5")).toBeTruthy();
            expect(block.getByText(/mean 43\.2 · p90 58\.0 · 30 orders measured/)).toBeTruthy();
        });

        it("renders dashes and 'no measurable orders' rather than zeros when nothing was measured", () => {
            render(
                <DeliveryEstimateAccuracyCard
                    stats={{
                        ...STATS,
                        orderTotalTime: {sampleCount: 0, medianMinutes: null, meanMinutes: null, p90Minutes: null},
                    }}
                    range={null}
                />
            );

            const block = within(screen.getByTestId("order-total-headline"));
            expect(block.getByText("—")).toBeTruthy();
            expect(block.getByText(/no measurable orders/)).toBeTruthy();
            expect(block.queryByText(/0\.0/)).toBeNull();
        });

        it("adds no fourth leg headline or row", () => {
            render(<DeliveryEstimateAccuracyCard stats={STATS} range={null}/>);

            expect(screen.getAllByTestId(/^leg-headline-/)).toHaveLength(3);
            expect(screen.getAllByTestId(/^leg-row-/)).toHaveLength(3);
        });

        it("keeps the pass-wait text when the order-total sample differs from the legs' counts", () => {
            render(
                <DeliveryEstimateAccuracyCard
                    stats={{...STATS, orderTotalTime: {...ORDER_TOTAL, sampleCount: 7}}}
                    range={null}
                />
            );

            expect(screen.getByTestId("pass-wait").textContent).toContain("1.0");
        });

        it("shows the existing empty state and no order-total block when nothing was delivered", () => {
            render(
                <DeliveryEstimateAccuracyCard
                    stats={{deliveredOrders: 0, deliveredOrderCount: 0, legs: [UNMEASURED], orderTotalTime: ORDER_TOTAL}}
                    range={null}
                />
            );

            expect(screen.getByText("No delivery orders were completed in this range")).toBeTruthy();
            expect(screen.queryByTestId("order-total-headline")).toBeNull();
        });
    });

    describe("delivered orders headline", () => {
        const SPLIT_COUNTS = {
            ...STATS,
            deliveredOrders: 40,
            deliveredOrderCount: 25,
            orderTotalTime: {...ORDER_TOTAL, sampleCount: 25},
        };

        it("shows one headline and no drop-offs box when parts and orders are equal", () => {
            render(
                <DeliveryEstimateAccuracyCard
                    stats={{...STATS, deliveredOrders: 40, deliveredOrderCount: 40}}
                    range={null}
                />
            );

            expect(within(screen.getByTestId("delivered-orders-headline")).getByText("40")).toBeTruthy();
            expect(screen.queryByTestId("delivery-drop-offs-headline")).toBeNull();
            expect(screen.getAllByText("Delivered orders")).toHaveLength(1);
            expect(screen.queryByText("Courier drop-offs")).toBeNull();
        });

        it("shows the order count and the drop-off count with its caption when they differ", () => {
            render(<DeliveryEstimateAccuracyCard stats={SPLIT_COUNTS} range={null}/>);

            const orders = within(screen.getByTestId("delivered-orders-headline"));
            expect(orders.getByText("Delivered orders")).toBeTruthy();
            expect(orders.getByText("25")).toBeTruthy();
            const drops = within(screen.getByTestId("delivery-drop-offs-headline"));
            expect(drops.getByText("Courier drop-offs")).toBeTruthy();
            expect(drops.getByText("40")).toBeTruthy();
            expect(drops.getByText("one per courier part — the leg rows below read against this")).toBeTruthy();
        });

        it("keeps the leg rows reading against the per-part denominator", () => {
            render(
                <DeliveryEstimateAccuracyCard
                    stats={{...SPLIT_COUNTS, legs: [KITCHEN, {...ROAD, sampleCount: 12, unmeasurableCount: 28}, TOTAL]}}
                    range={null}
                />
            );

            expect(within(screen.getByTestId("leg-row-ROAD")).getByText(/12 of 40/)).toBeTruthy();
            expect(screen.getAllByTestId(/^leg-headline-/)).toHaveLength(3);
            expect(screen.getAllByTestId(/^leg-row-/)).toHaveLength(3);
        });

        it("renders both headlines and not the empty state when parts were delivered but no order completed", () => {
            render(
                <DeliveryEstimateAccuracyCard
                    stats={{...STATS, deliveredOrders: 5, deliveredOrderCount: 0}}
                    range={null}
                />
            );

            expect(within(screen.getByTestId("delivered-orders-headline")).getByText("0")).toBeTruthy();
            expect(within(screen.getByTestId("delivery-drop-offs-headline")).getByText("5")).toBeTruthy();
            expect(screen.queryByText("No delivery orders were completed in this range")).toBeNull();
        });

        it("keeps the empty state when no part was delivered", () => {
            render(
                <DeliveryEstimateAccuracyCard
                    stats={{...STATS, deliveredOrders: 0, deliveredOrderCount: 0}}
                    range={null}
                />
            );

            expect(screen.getByText("No delivery orders were completed in this range")).toBeTruthy();
            expect(screen.queryByTestId("delivered-orders-headline")).toBeNull();
        });
    });
});
