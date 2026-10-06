import React from "react";
import {Box, Table, TableBody, TableCell, TableHead, TableRow, Typography} from "@mui/material";
import {StatEmptyState} from "../performance/statPlaceholders";
import {formatSharePct} from "../performance/DeliveryAvailabilityCard";
import {useDeliveryScopedStats} from "../../hooks/useDeliveryScopedStats";
import {fetchCourierProductivity} from "../../../../../shared/api/management";
import {DeliveryMetricsCard} from "./deliveryMetricsUi";
import {formatKm, formatShiftMinutes, gpsNote, splitCoverageNote} from "./productivityFormat";
import type {DeliveryStatsScope} from "../../hooks/useStatistics";
import type {CourierProductivity, CourierProductivityRow} from "../../types";

type Props = {
    /** The applied range; null until the first refresh has come back. */
    scope: DeliveryStatsScope | null;
};

/**
 * Where each rider's shift went, and how far they drove (M5).
 *
 * Free time is shown as a share of time on shift because that is the staffing question: a rider
 * free 70% of the shift is a rider too many at that hour, whatever the deliveries count says.
 * Km comes from the GPS trail with jitter and jumps filtered out, so it is a lower bound on road
 * distance, and the card says so.
 */
export function CourierProductivityCard({scope}: Props): JSX.Element {
    const {stats, fetchedFor, loading, failed} = useDeliveryScopedStats<CourierProductivity>(scope, fetchCourierProductivity);

    return (
        <DeliveryMetricsCard
            title="Courier Productivity"
            subtitle="time on shift by what each rider was doing, and distance driven from GPS"
            testId="courier-productivity"
            scopeLabel="All couriers"
            fetchedFor={fetchedFor}
            loading={loading}
            failed={failed}
            failedMessage="Could not load courier productivity for this range."
            hasStats={stats !== null}
        >
            {stats !== null && fetchedFor !== null && (
                <CourierProductivityBody stats={stats} windowStart={fetchedFor.startDate}/>
            )}
        </DeliveryMetricsCard>
    );
}

function CourierProductivityBody({stats, windowStart}: {
    stats: CourierProductivity;
    windowStart: string;
}): JSX.Element {
    if (stats.couriers.length === 0) {
        return <StatEmptyState message="No courier was on shift in this range"/>;
    }

    const splitNote = splitCoverageNote(stats.splitCoverage, stats.splitDataSince);
    const gps = gpsNote(stats.gpsDataSince, windowStart);

    return (
        <>
            {(splitNote !== null || gps !== null) && (
                <Box sx={{mb: 1}}>
                    {splitNote !== null && (
                        <Typography data-testid="courier-productivity-split-note" variant="caption"
                                    color="text.secondary" sx={{display: "block", fontStyle: "italic"}}>
                            {splitNote}
                        </Typography>
                    )}
                    {gps !== null && (
                        <Typography data-testid="courier-productivity-gps-note" variant="caption"
                                    color="text.secondary" sx={{display: "block", fontStyle: "italic"}}>
                            {gps}
                        </Typography>
                    )}
                </Box>
            )}

            <Box sx={{overflowX: "auto"}}>
                <Table size="small" sx={{mb: 1, minWidth: 900}} data-testid="courier-productivity-table">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 600}}>Courier</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">On shift</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Free</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">To kitchen</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">At kitchen</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Carrying</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Km</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Deliveries</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Km / delivery</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stats.couriers.map((row, index) => (
                            <ProductivityRow key={row.courierId ?? `row-${index}`} row={row}
                                             testId={`courier-productivity-row-${row.courierId ?? index}`}/>
                        ))}
                        <ProductivityRow row={stats.total} total testId="courier-productivity-total"/>
                    </TableBody>
                </Table>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                Each moment of a shift counts once, as the busiest thing the rider was doing: carrying beats
                at the kitchen beats going to it. Km is straight lines between GPS fixes with jitter under 20 m
                and jumps over 120 km/h left out — a lower bound on road distance.
            </Typography>
        </>
    );
}

function ProductivityRow({row, total = false, testId}: {
    row: CourierProductivityRow;
    total?: boolean;
    testId: string;
}): JSX.Element {
    const cellSx = total ? {fontWeight: 700, borderTop: "2px solid #f1eae4"} : undefined;
    return (
        <TableRow data-testid={testId}>
            <TableCell sx={cellSx}>{total ? "All couriers" : row.name ?? "Unknown rider"}</TableCell>
            <TableCell align="right" sx={cellSx}>{formatShiftMinutes(row.onShiftMinutes)}</TableCell>
            <TableCell align="right" sx={cellSx}>
                {formatShiftMinutes(row.freeMinutes)}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 0.5}}>
                    ({formatSharePct(row.freeMinutes, row.onShiftMinutes)})
                </Typography>
            </TableCell>
            <TableCell align="right" sx={cellSx}>{formatShiftMinutes(row.toKitchenMinutes)}</TableCell>
            <TableCell align="right" sx={cellSx}>{formatShiftMinutes(row.atKitchenMinutes)}</TableCell>
            <TableCell align="right" sx={cellSx}>{formatShiftMinutes(row.carryingMinutes)}</TableCell>
            <TableCell align="right" sx={cellSx}>{formatKm(row.kmDriven)}</TableCell>
            <TableCell align="right" sx={cellSx}>{row.deliveredParts}</TableCell>
            <TableCell align="right" sx={cellSx}>{formatKm(row.kmPerDelivery)}</TableCell>
        </TableRow>
    );
}
