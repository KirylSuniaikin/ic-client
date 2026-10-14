import React from "react";
import {Box, Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Typography} from "@mui/material";
import {StatEmptyState, StatSkeleton} from "./performance/statPlaceholders";
import {formatSharePct} from "./performance/DeliveryAvailabilityCard";
import {BRAND_RED} from "../../../../shared/utils/theme";
import type {DeliveryEstimateAccuracy, DeliveryGapBucket, DeliveryLeg, DeliveryLegAccuracy} from "../types";

// The order the backend emits and the order they are read in: the customer's own wait last, after
// the two halves that explain it.
const LEG_LABELS: Record<DeliveryLeg, string> = {
    KITCHEN: "Kitchen",
    ROAD: "Road",
    TOTAL: "Total (what the customer waited)",
};

const LEG_MEANING: Record<DeliveryLeg, string> = {
    KITCHEN: "order placed → food ready · quoted from the branch's workload level",
    ROAD: "hand-over → drop-off · quoted by the routing API",
    TOTAL: "order placed → drop-off · quoted as the two halves added together",
};

// KITCHEN is de-duplicated to one sample per order by the backend, so it reads against the distinct
// orders in its own sample set (measured + unmeasurable). That set includes split orders not yet
// fully delivered or completed in a later window, which deliveredOrderCount excludes; using that
// count would let the numerator exceed the denominator. ROAD and TOTAL are per courier part.
function legDenominator(leg: DeliveryLegAccuracy, stats: DeliveryEstimateAccuracy): number {
    return leg.leg === "KITCHEN" ? leg.sampleCount + leg.unmeasurableCount : stats.deliveredOrders;
}

// A status palette, not a categorical one: these three are states (early / on time / late), each
// carries its own bucket label and count beside it, and none of the values is invented — success
// green, brand red and the secondary ink are all in DESIGN.md.
const TONE_COLORS = {
    early: "#8a807a",
    onTime: "#4CAF50",
    late: BRAND_RED,
} as const;

export type GapTone = keyof typeof TONE_COLORS;

/**
 * A gap in minutes, signed, or an em dash when there was no sample.
 *
 * The sign is the whole point — positive is late, negative is early — so it is always printed,
 * including the plus. A null NEVER becomes a zero: "we were bang on" and "we could not measure it"
 * are opposite statements that a bare 0 would render identically.
 */
export function formatGapMinutes(value: number | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    const rounded = value.toFixed(1);
    return value > 0 ? `+${rounded}` : rounded;
}

/** An unsigned minute figure (a quote or an actual), or an em dash when there was no sample. */
export function formatMinutes(value: number | null): string {
    if (value == null || Number.isNaN(value)) return "—";
    return value.toFixed(1);
}

function signed(minutes: number): string {
    return minutes > 0 ? `+${minutes}` : String(minutes);
}

/**
 * The label for one histogram bucket, half-open `[from, to)`.
 *
 * Open ends are rendered as open ends. A null edge means unbounded, and printing it as a number
 * (or, worse, as a 0) would hide the tail this report exists to expose.
 */
export function formatBucketLabel(bucket: DeliveryGapBucket): string {
    if (bucket.fromMinutes == null && bucket.toMinutes == null) return "any";
    if (bucket.fromMinutes == null) return `under ${signed(bucket.toMinutes as number)}`;
    if (bucket.toMinutes == null) return `${signed(bucket.fromMinutes)} and later`;
    return `${signed(bucket.fromMinutes)} to ${signed(bucket.toMinutes)}`;
}

/**
 * Which side of the on-time band a bucket sits on.
 *
 * Derived from the bucket's own edges against the tolerance the payload carries, never from a
 * hard-coded ±2: the backend echoes the band width back precisely so no client has to guess it,
 * and a client that guessed would colour the middle bucket wrong the day it changed.
 */
export function bucketTone(bucket: DeliveryGapBucket, toleranceMinutes: number): GapTone {
    if (bucket.toMinutes != null && bucket.toMinutes <= -toleranceMinutes) return "early";
    if (bucket.fromMinutes != null && bucket.fromMinutes >= toleranceMinutes) return "late";
    return "onTime";
}

/**
 * The unquoted span between the two legs — the food sitting on the pass waiting for a rider.
 *
 * TOTAL is measured end to end and is deliberately not KITCHEN + ROAD, so what is left over when
 * the two are subtracted from it is the wait nobody quotes. It is the number that says the
 * estimates can both be perfect and the customer still late.
 *
 * Returned only when all three legs were measured over the SAME number of orders. Across different
 * sample sets the subtraction is arithmetic on unrelated means and the answer would be fiction —
 * and a fictional number here is worse than none, because it is the one a manager would act on.
 */
export function passWaitMinutes(legs: DeliveryLegAccuracy[]): number | null {
    const kitchen = legs.find((leg) => leg.leg === "KITCHEN");
    const road = legs.find((leg) => leg.leg === "ROAD");
    const total = legs.find((leg) => leg.leg === "TOTAL");
    if (kitchen == null || road == null || total == null) return null;
    if (kitchen.gapMeanMinutes == null || road.gapMeanMinutes == null || total.gapMeanMinutes == null) return null;
    if (kitchen.sampleCount === 0) return null;
    if (kitchen.sampleCount !== road.sampleCount || road.sampleCount !== total.sampleCount) return null;
    return total.gapMeanMinutes - kitchen.gapMeanMinutes - road.gapMeanMinutes;
}

type Props = {
    stats: DeliveryEstimateAccuracy | null;
    /** The APPLIED date range these figures were fetched for — never the range in the picker. */
    range: string | null;
};

/**
 * What we promised against what happened — delivery-manual.html §06 item D.
 *
 * The card answers one question: are we lying to the customer about the time, by how much, and
 * which half is wrong. Four things it therefore refuses to do:
 *
 *  - It never shows a single blended accuracy figure. The kitchen quote is a workload step
 *    function and the road quote is a routing API; prep running eight minutes long against a drive
 *    running eight minutes short is a perfect total and two broken estimates, and only the split
 *    says which one to fix.
 *  - The median leads and the mean follows it. Where the two disagree the mean is being dragged by
 *    a tail and must not be tuned against — so both are on screen, in that order.
 *  - The distribution is drawn, not summarised. A gap that is ten minutes early half the time and
 *    ten late the other half averages to zero, and that bimodality is exactly what this exists to
 *    expose; the buckets are fixed-edge so two months stay comparable.
 *  - A leg with no samples shows em dashes, never zeros, and says how many of the window's orders
 *    it could measure. A leg measured on 12 of 400 orders is not evidence and must not look like
 *    it.
 *
 * The branch filter above does NOT narrow these figures: both this endpoint and the skip-reason
 * one read the whole chain, which is why the header says so out loud.
 */
export function DeliveryEstimateAccuracyCard({stats, range}: Props): JSX.Element {
    const tolerance = stats?.legs[0]?.toleranceMinutes ?? 0;
    const passWait = stats == null ? null : passWaitMinutes(stats.legs);
    // Every leg carries the same fixed edges, but the row list is built from whichever leg has one
    // rather than assuming: a leg with no samples still emits the buckets, so this only ever falls
    // back when the payload itself is empty.
    const buckets = stats?.legs.find((leg) => leg.distribution.length > 0)?.distribution ?? [];

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2}}>
            <CardContent>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6" sx={{mb: 0.5}}>🛵 <b>Estimate Accuracy</b></Typography>
                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                        quoted versus actual, in minutes — positive is late, negative is early
                    </Typography>
                    {/* The scope the numbers were FETCHED for. "All branches" is not a guess: this
                        endpoint is called without a branch filter on purpose, because the road
                        quote comes from one router and one speed constant shared by the chain. */}
                    {range !== null && stats !== null && (
                        <Typography
                            data-testid="estimate-accuracy-scope"
                            variant="caption"
                            sx={{display: "block", mt: 0.5, fontWeight: 600, color: "text.secondary"}}
                        >
                            All branches · {range}
                        </Typography>
                    )}
                </Box>

                {stats == null ? (
                    <StatSkeleton lines={4}/>
                ) : stats.deliveredOrders === 0 ? (
                    <StatEmptyState message="No delivery orders were completed in this range"/>
                ) : (
                    <>
                        <Box sx={{display: "flex", flexWrap: "wrap", gap: 4, mb: 2}}>
                            <Box data-testid="delivered-orders-headline">
                                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                    Delivered orders
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                    {stats.deliveredOrderCount}
                                </Typography>
                            </Box>
                            {/* deliveredOrders counts courier drop-offs (parts). When it equals the order
                                count a second figure would only repeat the first. */}
                            {stats.deliveredOrderCount !== stats.deliveredOrders && (
                                <Box data-testid="delivery-drop-offs-headline">
                                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                        Courier drop-offs
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                        {stats.deliveredOrders}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        one per courier part — Road and Total read against this; Kitchen counts each order once
                                    </Typography>
                                </Box>
                            )}
                            {stats.legs.map((leg) => (
                                <Box key={leg.leg} data-testid={`leg-headline-${leg.leg}`}>
                                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                        {LEG_LABELS[leg.leg]} · typical gap
                                    </Typography>
                                    {/* The median, first and largest: it is the typical order.
                                        The mean sits in the table below, where the two can be
                                        read against each other. */}
                                    <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                        {formatGapMinutes(leg.gapMedianMinutes)}
                                        {leg.gapMedianMinutes != null && (
                                            <Typography component="span" variant="body2" sx={{ml: 0.5}}>min</Typography>
                                        )}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        p90 {formatGapMinutes(leg.gapP90Minutes)}
                                        {" · "}
                                        {leg.sampleCount === 0
                                            ? "no measurable orders"
                                            : `${formatSharePct(leg.onTimeCount, leg.sampleCount)} on time`}
                                    </Typography>
                                </Box>
                            ))}
                            {/* Not a leg: no quote, so no gap, and it must never take a
                                leg-headline- / leg-row- testid or join passWaitMinutes. */}
                            <Box data-testid="order-total-headline">
                                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                    Whole order · placed → last drop-off
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                    {formatMinutes(stats.orderTotalTime.medianMinutes)}
                                    {stats.orderTotalTime.medianMinutes != null && (
                                        <Typography component="span" variant="body2" sx={{ml: 0.5}}>min</Typography>
                                    )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {stats.orderTotalTime.sampleCount === 0
                                        ? "no measurable orders"
                                        : `mean ${formatMinutes(stats.orderTotalTime.meanMinutes)} · p90 ${formatMinutes(stats.orderTotalTime.p90Minutes)} · ${stats.orderTotalTime.sampleCount} orders measured`}
                                </Typography>
                            </Box>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}>
                            Whole order is one figure per order with no quote, so it has no gap; a split order ends at
                            its last part.
                        </Typography>

                        <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}>
                            Total is measured end to end, not Kitchen + Road: the span between them — food waiting
                            on the pass for a rider — belongs to no estimate at all.
                            {passWait !== null && (
                                <>
                                    {" "}
                                    <b data-testid="pass-wait">
                                        On these orders that wait averaged {formatMinutes(passWait)} min.
                                    </b>
                                </>
                            )}
                        </Typography>

                        <Box sx={{overflowX: "auto"}}>
                            <Table size="small" sx={{mb: 3, minWidth: 760}} data-testid="estimate-accuracy-table">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{fontWeight: 600}}>Leg</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Measured on</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Quoted avg</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Actual avg</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Median gap</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">p90 gap</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Mean gap</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Earliest / latest</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">
                                            Early / on time / late (±{tolerance} min)
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {stats.legs.map((leg) => (
                                        <TableRow key={leg.leg} data-testid={`leg-row-${leg.leg}`}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {LEG_LABELS[leg.leg]}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {LEG_MEANING[leg.leg]}
                                                </Typography>
                                            </TableCell>
                                            {/* Both halves, always. A leg measured on 12 of 400
                                                orders reads as evidence unless the denominator is
                                                sitting next to it. */}
                                            <TableCell align="right">
                                                {leg.sampleCount} of {legDenominator(leg, stats)}
                                                {leg.unmeasurableCount > 0 && (
                                                    <Typography variant="caption" color="text.secondary"
                                                                sx={{display: "block"}}>
                                                        {leg.unmeasurableCount} unmeasurable
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="right">{formatMinutes(leg.quotedMeanMinutes)}</TableCell>
                                            <TableCell align="right">{formatMinutes(leg.actualMeanMinutes)}</TableCell>
                                            <TableCell align="right" sx={{fontWeight: 700}}>
                                                {formatGapMinutes(leg.gapMedianMinutes)}
                                            </TableCell>
                                            <TableCell align="right">{formatGapMinutes(leg.gapP90Minutes)}</TableCell>
                                            <TableCell align="right">{formatGapMinutes(leg.gapMeanMinutes)}</TableCell>
                                            <TableCell align="right">
                                                {formatGapMinutes(leg.gapMinMinutes)} / {formatGapMinutes(leg.gapMaxMinutes)}
                                            </TableCell>
                                            <TableCell align="right">
                                                {leg.earlyCount} / {leg.onTimeCount} / {leg.lateCount}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>

                        <Typography variant="subtitle1" sx={{mb: 0.5, fontWeight: "bold"}}>
                            Gap Distribution
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}>
                            share of each leg's measured orders per bucket. The buckets never move with the data, so
                            two ranges can be compared; the first and last are open-ended.
                        </Typography>

                        {buckets.length === 0 ? (
                            <StatEmptyState message="No gap distribution in this range"/>
                        ) : (
                            <Box sx={{overflowX: "auto"}}>
                                <Table size="small" sx={{minWidth: 620}} data-testid="gap-distribution-table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{fontWeight: 600}}>Gap (min)</TableCell>
                                            {stats.legs.map((leg) => (
                                                <TableCell key={leg.leg} sx={{fontWeight: 600}}>
                                                    {LEG_LABELS[leg.leg].split(" ")[0]}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {buckets.map((bucket, index) => {
                                            const tone = bucketTone(bucket, tolerance);
                                            return (
                                                <TableRow key={formatBucketLabel(bucket)}>
                                                    <TableCell sx={{whiteSpace: "nowrap"}}>
                                                        {formatBucketLabel(bucket)}
                                                        {tone === "onTime" && (
                                                            <Typography component="span" variant="caption"
                                                                        color="text.secondary" sx={{ml: 0.5}}>
                                                                (on time)
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    {stats.legs.map((leg) => {
                                                        const cell = leg.distribution[index];
                                                        const count = cell?.count ?? 0;
                                                        const share = leg.sampleCount > 0
                                                            ? (count / leg.sampleCount) * 100
                                                            : 0;
                                                        return (
                                                            <TableCell
                                                                key={leg.leg}
                                                                data-testid={`bucket-${leg.leg}-${index}`}
                                                                title={leg.sampleCount === 0
                                                                    ? "no measurable orders on this leg"
                                                                    : `${count} of ${leg.sampleCount} orders`}
                                                            >
                                                                <Box sx={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 1,
                                                                    minWidth: 120,
                                                                }}>
                                                                    {/* The bar is a redundant
                                                                        encoding: the count is
                                                                        printed beside it, so the
                                                                        colour never carries a
                                                                        meaning on its own. */}
                                                                    <Box sx={{
                                                                        flex: 1,
                                                                        height: 8,
                                                                        borderRadius: 1,
                                                                        backgroundColor: "#f1eae4",
                                                                        overflow: "hidden",
                                                                    }}>
                                                                        <Box sx={{
                                                                            width: `${Math.min(share, 100)}%`,
                                                                            height: "100%",
                                                                            borderRadius: 1,
                                                                            backgroundColor: TONE_COLORS[tone],
                                                                        }}/>
                                                                    </Box>
                                                                    <Typography variant="caption"
                                                                                sx={{minWidth: 28, textAlign: "right"}}>
                                                                        {count}
                                                                    </Typography>
                                                                </Box>
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
