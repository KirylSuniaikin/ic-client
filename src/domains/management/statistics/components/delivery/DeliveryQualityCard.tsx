import React from "react";
import {Box, Table, TableBody, TableCell, TableHead, TableRow, Typography} from "@mui/material";
import {StatEmptyState} from "../performance/statPlaceholders";
import {formatMinutes} from "../DeliveryEstimateAccuracyCard";
import {formatBd} from "../business/businessFormat";
import {useDeliveryScopedStats} from "../../hooks/useDeliveryScopedStats";
import {fetchDeliveryQualityStats} from "../../../../../shared/api/management";
import {
    CoverageCaption,
    DeliveryMetricsCard,
    Figure,
    formatShare,
    measuredOn,
    noDataBeforeText,
    summaryCells,
} from "./deliveryMetricsUi";
import type {DeliveryStatsScope} from "../../hooks/useStatistics";
import type {DeliveryOutcome, DeliveryQualityStats, DurationSummary} from "../../types";

type WaitRow = {
    key: string;
    label: string;
    meaning: string;
    /** Null when the figure was not being recorded in this range. */
    summary: DurationSummary | null;
};

function outcomeCaption(outcome: DeliveryOutcome): string {
    return `${formatShare(outcome.share)} of concluded · BHD ${formatBd(outcome.amountBhd)}`;
}

type Props = {
    /** The applied chain-wide range; null until the first refresh has come back. */
    scope: DeliveryStatsScope | null;
};

/**
 * Whether delivery kept its word, and where the minutes went (M2 + M4).
 *
 * Late is measured against the outer edge of the window the customer was shown — the promise
 * itself, not the estimate-accuracy card's mid-point — so it is the number a customer would
 * complain about. The three waits are the stretches no quote covers: food on the pass, a rider
 * standing at the kitchen, a rider at the door. Cancelled and returned count PAID delivery orders
 * only: an unpaid one that dies is abandonment, which lives on the lost-demand card.
 */
export function DeliveryQualityCard({scope}: Props): JSX.Element {
    const {stats, fetchedFor, loading, failed} = useDeliveryScopedStats<DeliveryQualityStats>(scope, fetchDeliveryQualityStats);

    return (
        <DeliveryMetricsCard
            title="Delivery Quality"
            subtitle="late against the promise, freshness, the waits between kitchen and door, and orders that never arrived"
            testId="delivery-quality"
            fetchedFor={fetchedFor}
            loading={loading}
            failed={failed}
            failedMessage="Could not load delivery quality for this range."
            hasStats={stats !== null}
        >
            {stats !== null && <DeliveryQualityBody stats={stats}/>}
        </DeliveryMetricsCard>
    );
}

function DeliveryQualityBody({stats}: { stats: DeliveryQualityStats }): JSX.Element {
    const {lateness, freshness, timeAtDoor} = stats;
    if (stats.concludedOrders === 0 && freshness.deliveredParts === 0) {
        return <StatEmptyState message="No delivery orders concluded in this range"/>;
    }

    const waits: WaitRow[] = [
        {
            key: "pass",
            label: "Food waiting on the pass",
            meaning: "Ready → handed to the rider",
            summary: stats.readyToHandover,
        },
        {
            key: "kitchen",
            label: "Rider waiting at the kitchen",
            meaning: "rider arrived → handed over",
            summary: stats.courierWaitAtKitchen,
        },
        {
            key: "door",
            label: "At the door",
            meaning: "first proof photo → marked Delivered",
            summary: timeAtDoor.coverage === "NONE" ? null : timeAtDoor.summary,
        },
    ];

    return (
        <>
            <Box sx={{display: "flex", flexWrap: "wrap", gap: 4, mb: 2}}>
                <Figure
                    testId="quality-late"
                    label="Late against the promise"
                    value={formatShare(lateness.lateShare)}
                    caption={lateness.ordersWithPromise === 0
                        ? "no orders with a promise on record"
                        : `${lateness.lateOrders} of ${lateness.ordersWithPromise} orders · `
                        + `mean ${formatMinutes(lateness.meanMinutesLate)} · p90 ${formatMinutes(lateness.p90MinutesLate)} min late`}
                />
                <Figure
                    testId="quality-fresh"
                    label={`Fresh · within ${freshness.budgetMinutes} min of Ready`}
                    value={formatShare(freshness.freshShare)}
                    caption={freshness.measuredParts === 0
                        ? "no drop-offs with a Ready time"
                        : `${freshness.freshParts} of ${freshness.measuredParts} drop-offs`}
                />
                <Figure
                    testId="quality-cancelled"
                    label="Cancelled after payment"
                    value={String(stats.cancellations.count)}
                    caption={outcomeCaption(stats.cancellations)}
                />
                <Figure
                    testId="quality-returned"
                    label="Returned undelivered"
                    value={String(stats.returns.count)}
                    caption={outcomeCaption(stats.returns)}
                />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}>
                Late is the last drop-off after the outer edge of the window the customer was shown, over{" "}
                {lateness.deliveredOrders} delivered orders. Cancelled and returned are paid orders out
                of {stats.concludedOrders} concluded — money to refund by hand.
                {freshness.unmeasurableParts > 0 &&
                    ` ${freshness.unmeasurableParts} drop-offs had no Ready time and are not in the fresh share.`}
            </Typography>

            <Box sx={{overflowX: "auto"}}>
                <Table size="small" sx={{mb: 1, minWidth: 620}} data-testid="quality-waits-table">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 600}}>Wait</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Measured on</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Median</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">p90</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Mean</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {waits.map((wait) => (
                            <TableRow key={wait.key} data-testid={`quality-wait-${wait.key}`}>
                                <TableCell>
                                    <Typography variant="body2" fontWeight={600}>{wait.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">{wait.meaning}</Typography>
                                </TableCell>
                                {wait.summary === null ? (
                                    <TableCell colSpan={4} align="right" sx={{color: "text.secondary"}}>
                                        {noDataBeforeText(timeAtDoor.dataSince)}
                                    </TableCell>
                                ) : (
                                    <>
                                        <TableCell align="right">
                                            {measuredOn(wait.summary.sampleCount, freshness.deliveredParts)}
                                        </TableCell>
                                        {summaryCells(wait.summary).map((value, index) => (
                                            <TableCell key={index} align="right" sx={{fontWeight: index === 0 ? 700 : 400}}>
                                                {value}
                                            </TableCell>
                                        ))}
                                    </>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                Minutes, per drop-off. No arrival moment is stored, so the proof photo — taken at the
                door before Delivered can be pressed — stands in for it.
            </Typography>
            {/* NONE is already said in the row itself; only a partial range needs a note here. */}
            {timeAtDoor.coverage === "PARTIAL" && (
                <CoverageCaption coverage="PARTIAL" dataSince={timeAtDoor.dataSince}
                                 testId="quality-door-coverage" subject="At the door"/>
            )}
        </>
    );
}
