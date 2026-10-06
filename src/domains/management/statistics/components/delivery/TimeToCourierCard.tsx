import React from "react";
import {Box, Table, TableBody, TableCell, TableHead, TableRow, Typography} from "@mui/material";
import {StatEmptyState} from "../performance/statPlaceholders";
import {formatSharePct} from "../performance/DeliveryAvailabilityCard";
import {formatMinutes} from "../DeliveryEstimateAccuracyCard";
import {useDeliveryScopedStats} from "../../hooks/useDeliveryScopedStats";
import {fetchTimeToCourierStats} from "../../../../../shared/api/management";
import {
    CoverageCaption,
    DeliveryMetricsCard,
    Figure,
    formatCount,
    measuredOn,
    NoDataBefore,
    summaryCells,
} from "./deliveryMetricsUi";
import type {DeliveryStatsScope} from "../../hooks/useStatistics";
import type {TimeToCourierStats, WaitSummary} from "../../types";

type WaitKey = "readyToAssigned" | "firstOfferToAssigned";

const WAIT_LABELS: Record<WaitKey, string> = {
    readyToAssigned: "Ready → assigned",
    firstOfferToAssigned: "First offer → assigned",
};

const WAIT_MEANING: Record<WaitKey, string> = {
    readyToAssigned: "food Ready → the rider who delivered it took it; assigned before Ready counts as no wait",
    firstOfferToAssigned: "the engine's first offer → the assignment that stuck",
};

const WAIT_KEYS: readonly WaitKey[] = ["readyToAssigned", "firstOfferToAssigned"];

/** "9 (11.5%)": a count over a threshold never travels without the sample it came from. */
function overCount(count: number, summary: WaitSummary): string {
    return summary.sampleCount === 0 ? "—" : `${count} (${formatSharePct(count, summary.sampleCount)})`;
}

type Props = {
    /** The applied chain-wide range; null until the first refresh has come back. */
    scope: DeliveryStatsScope | null;
};

/**
 * How long a delivered order waited for a rider (M1) — the staffing question the estimate-accuracy
 * card cannot answer, because the time between Ready and an assignment belongs to no quote.
 *
 * The median leads, the p90 and the over-5 / over-10 counts follow: a typical wait of one minute
 * and a tail of orders that sat for twelve are different problems, and the tail is the one the
 * customer remembers. These times only exist from the deploy that began recording them, so a
 * range before it says so instead of showing zeros.
 */
export function TimeToCourierCard({scope}: Props): JSX.Element {
    const {stats, fetchedFor, loading, failed} = useDeliveryScopedStats<TimeToCourierStats>(scope, fetchTimeToCourierStats);

    return (
        <DeliveryMetricsCard
            title="Time To A Courier"
            subtitle="how long delivered orders waited for a rider to take them"
            testId="time-to-courier"
            fetchedFor={fetchedFor}
            loading={loading}
            failed={failed}
            failedMessage="Could not load the time to a courier for this range."
            hasStats={stats !== null}
        >
            {stats !== null && <TimeToCourierBody stats={stats}/>}
        </DeliveryMetricsCard>
    );
}

function TimeToCourierBody({stats}: { stats: TimeToCourierStats }): JSX.Element {
    if (stats.coverage === "NONE" || stats.readyToAssigned === null || stats.firstOfferToAssigned === null) {
        return (
            <>
                <NoDataBefore dataSince={stats.dataSince} testId="time-to-courier-no-data"/>
                {stats.deliveredParts > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{display: "block", textAlign: "center"}}>
                        {stats.deliveredParts} drop-offs in this range were delivered before assignment times
                        were recorded.
                    </Typography>
                )}
            </>
        );
    }
    if (stats.deliveredParts === 0) {
        return <StatEmptyState message="No delivery orders were completed in this range"/>;
    }

    const waits: Record<WaitKey, WaitSummary> = {
        readyToAssigned: stats.readyToAssigned,
        firstOfferToAssigned: stats.firstOfferToAssigned,
    };

    return (
        <>
            <CoverageCaption coverage={stats.coverage} dataSince={stats.dataSince} testId="time-to-courier-coverage"/>

            <Box sx={{display: "flex", flexWrap: "wrap", gap: 4, mb: 2}}>
                {WAIT_KEYS.map((key) => {
                    const wait = waits[key];
                    return (
                        <Figure
                            key={key}
                            testId={`ttc-headline-${key}`}
                            label={`${WAIT_LABELS[key]} · typical`}
                            value={formatMinutes(wait.medianMinutes)}
                            unit="min"
                            caption={wait.sampleCount === 0
                                ? "no measurable drop-offs"
                                : `p90 ${formatMinutes(wait.p90Minutes)} · ${wait.over5Minutes} over 5 min · ${wait.over10Minutes} over 10 min`}
                        />
                    );
                })}
                <Figure
                    testId="ttc-measured"
                    label="Measured on"
                    value={measuredOn(stats.measuredParts, stats.deliveredParts)}
                    caption="delivered drop-offs with an assignment time"
                />
            </Box>

            <Box sx={{overflowX: "auto"}}>
                <Table size="small" sx={{mb: 2, minWidth: 720}} data-testid="time-to-courier-table">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 600}}>Wait</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Measured on</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Median</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">p90</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Mean</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Over 5 min</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Over 10 min</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {WAIT_KEYS.map((key) => {
                            const wait = waits[key];
                            const [median, p90, mean] = summaryCells(wait);
                            return (
                                <TableRow key={key} data-testid={`ttc-row-${key}`}>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{WAIT_LABELS[key]}</Typography>
                                        <Typography variant="caption" color="text.secondary">{WAIT_MEANING[key]}</Typography>
                                    </TableCell>
                                    <TableCell align="right">{measuredOn(wait.sampleCount, stats.deliveredParts)}</TableCell>
                                    <TableCell align="right" sx={{fontWeight: 700}}>{median}</TableCell>
                                    <TableCell align="right">{p90}</TableCell>
                                    <TableCell align="right">{mean}</TableCell>
                                    <TableCell align="right">{overCount(wait.over5Minutes, wait)}</TableCell>
                                    <TableCell align="right">{overCount(wait.over10Minutes, wait)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Box>

            <Typography data-testid="ttc-footnote" variant="caption" color="text.secondary" sx={{display: "block"}}>
                {formatCount(stats.assignedBeforeReady)} assigned before the food was Ready (counted as no wait)
                {" · "}
                {formatCount(stats.assignedWithoutOffer)} assigned without an offer, e.g. by hand before the engine offered
                them. Minutes; a split order counts once per part.
            </Typography>
        </>
    );
}
