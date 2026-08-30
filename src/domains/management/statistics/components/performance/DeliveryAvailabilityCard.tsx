import React, {useMemo} from "react";
import {Box, Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Typography} from "@mui/material";
import {StatEmptyState, StatSkeleton} from "./statPlaceholders";
import type {
    DeliveryAvailabilityHourBucket,
    DeliveryAvailabilityStats,
    DeliveryOutageReason,
} from "../../types";

// Monday-first, matching RevenueByHourTable's column order and the ISO dayOfWeek
// the backend sends (1 = Monday .. 7 = Sunday).
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Never a single blended "unavailable" label: only the first of these answers
// "hire another rider", and the other two must stay visibly separate from it.
const REASON_LABELS: Record<DeliveryOutageReason, string> = {
    NO_COURIER: "No courier",
    DELIVERY_DISABLED: "Switched off",
    NO_BRANCH: "No branch coordinates",
};

// "2h 14m" / "14m" / "0m". Whole minutes: the sampler ticks once a minute, so
// anything finer would be false precision.
export function formatOutageDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function formatSharePct(part: number, whole: number): string {
    if (whole <= 0) return "—";
    return `${((part / whole) * 100).toFixed(1)}%`;
}

// Same lightness ramp as RevenueByHourTable's revenue heatmap, so the two grids on
// this tab read as one vocabulary rather than two colour schemes.
function heatColor(seconds: number, maxSeconds: number): string {
    if (seconds <= 0) return "#FFFFFF";
    const normalized = maxSeconds > 0 ? seconds / maxSeconds : 0;
    return `hsl(10, 80%, ${95 - normalized * 50}%)`;
}

/**
 * Which branches and which dates the figures below were fetched for.
 *
 * Pinned in the header because the card's whole use is comparing one reading with another: the
 * owner watched the same headline move between two visits, and without the scope on screen there
 * was no way to tell a changed number from a changed question. Null until the first fetch lands.
 */
export type AvailabilityScope = { branches: string; range: string };

type Props = {
    stats: DeliveryAvailabilityStats | null;
    scope: AvailabilityScope | null;
};

/**
 * How much OPEN time delivery could not be ordered, and why. A staffing instrument, not a
 * general health dashboard — everything here exists to answer "do we need another rider".
 *
 * Four deliberate presentation choices:
 *  - "No courier" is the headline and is stated on its own, in minutes and as a share of open
 *    time. A blended unavailable total would let a branch switched off for a refurbishment look
 *    exactly like a courier shortage.
 *  - The other reasons stand BESIDE it as their own labelled figures rather than only inside the
 *    table below. The card is titled "Delivery Unavailable" while its headline is one bucket of
 *    several, and that gap is the likeliest explanation for a headline the owner watched move
 *    between two readings: nothing in the pipeline shortens or reclassifies a recorded period —
 *    extension is forward-only and every state change inserts a new row — so what changed was
 *    most probably which question the number was answering. These secondary figures carry a
 *    duration only; their share and episode counts stay in the table, unrepeated.
 *  - The scope is pinned in the header. Two readings can only be compared if both say which
 *    branches and which dates they cover.
 *  - Every outage reason is listed even at zero, so an absent problem is visibly absent rather
 *    than merely missing from the response.
 *  - The weekday/hour grid is the "when". The same total spread thinly across a week and
 *    concentrated in the Friday dinner rush are different hiring decisions, and only the grid
 *    tells them apart.
 */
export function DeliveryAvailabilityCard({stats, scope}: Props): JSX.Element {
    const grid = useMemo(() => {
        const byCell = new Map<string, DeliveryAvailabilityHourBucket>();
        let maxSeconds = 0;
        (stats?.byHour ?? []).forEach((bucket) => {
            byCell.set(`${bucket.dayOfWeek}-${bucket.hour}`, bucket);
            maxSeconds = Math.max(maxSeconds, bucket.noCourierSeconds);
        });
        // Only hours anything was observed in — an hour the branch is never open in would
        // otherwise render as a reassuring row of zeros.
        const hours = Array.from(new Set((stats?.byHour ?? []).map((b) => b.hour))).sort((a, b) => a - b);
        return {byCell, maxSeconds, hours};
    }, [stats]);

    const noCourier = stats?.byReason.find((bucket) => bucket.reason === "NO_COURIER");
    // Never summed with the headline, and never with each other — the enum's own comment forbids
    // it. A manager's deliberate shutdown and a courier shortage are different decisions, and one
    // blended figure would make the first look like the second.
    const otherReasons = (stats?.byReason ?? []).filter((bucket) => bucket.reason !== "NO_COURIER");

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2}}>
            <CardContent>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6" sx={{mb: 0.5}}>🛵 <b>Delivery Unavailable</b></Typography>
                    {/* "by reason", because the title names a category while the headline below
                        reports a single bucket of it — read as a total, that gap is the likeliest
                        explanation for a figure that appeared to move between two readings. */}
                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                        open time customers could not order delivery, by reason
                    </Typography>
                    {/* The scope the figures were FETCHED for, never the range currently sitting
                        in the picker: those differ until the manager presses Refresh, and a label
                        describing the picker rather than the numbers beside it is worse than no
                        label at all. */}
                    {scope !== null && (
                        <Typography
                            data-testid="availability-scope"
                            variant="caption"
                            sx={{display: "block", mt: 0.5, fontWeight: 600, color: "text.secondary"}}
                        >
                            {scope.branches === "" ? scope.range : `${scope.branches} · ${scope.range}`}
                        </Typography>
                    )}
                </Box>

                {stats == null ? (
                    <StatSkeleton lines={3}/>
                ) : stats.observedSeconds === 0 ? (
                    <StatEmptyState message="No delivery availability recorded in this range"/>
                ) : (
                    <>
                        <Box sx={{display: "flex", flexWrap: "wrap", gap: 4, mb: 1}}>
                            <Box data-testid="no-courier-headline">
                                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                    No courier
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                    {formatOutageDuration(noCourier?.seconds ?? 0)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {formatSharePct(noCourier?.seconds ?? 0, stats.observedSeconds)} of open time
                                    {" · "}{noCourier?.occurrences ?? 0} time(s)
                                </Typography>
                            </Box>
                            {/* Beside the headline, visibly smaller, and duration only: they are
                                the context that stops "Delivery Unavailable" being read off the
                                No-courier number alone. Share and episodes are in the table below
                                and are not repeated here. */}
                            {otherReasons.map((bucket) => (
                                <Box key={bucket.reason} data-testid={`outage-figure-${bucket.reason}`}>
                                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                        {REASON_LABELS[bucket.reason]}
                                    </Typography>
                                    <Typography variant="h6" sx={{lineHeight: 1.2, color: "text.secondary"}}>
                                        {formatOutageDuration(bucket.seconds)}
                                    </Typography>
                                </Box>
                            ))}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                    Open time measured
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                    {formatOutageDuration(stats.observedSeconds)}
                                </Typography>
                            </Box>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}>
                            Only "No courier" is a staffing number — the others are listed separately on purpose.
                        </Typography>

                        <Table size="small" sx={{mb: 3, maxWidth: 520}} data-testid="outage-reason-table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{fontWeight: 600}}>Reason</TableCell>
                                    <TableCell sx={{fontWeight: 600}} align="right">Time</TableCell>
                                    <TableCell sx={{fontWeight: 600}} align="right">Share of open</TableCell>
                                    <TableCell sx={{fontWeight: 600}} align="right">Episodes</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {stats.byReason.map((bucket) => (
                                    <TableRow key={bucket.reason}>
                                        <TableCell>{REASON_LABELS[bucket.reason]}</TableCell>
                                        <TableCell align="right">{formatOutageDuration(bucket.seconds)}</TableCell>
                                        <TableCell align="right">
                                            {formatSharePct(bucket.seconds, stats.observedSeconds)}
                                        </TableCell>
                                        <TableCell align="right">{bucket.occurrences}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <Typography variant="subtitle1" sx={{mb: 1, fontWeight: "bold"}}>
                            No Courier By Hour
                        </Typography>
                        {grid.hours.length === 0 ? (
                            <StatEmptyState message="No hourly detail in this range"/>
                        ) : (
                            <Box sx={{overflowX: "auto"}}>
                                <Table size="small" sx={{minWidth: 620}}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{fontWeight: 600}}>Hour</TableCell>
                                            {DAYS_OF_WEEK.map((day) => (
                                                <TableCell key={day} align="center" sx={{fontWeight: 600}}>
                                                    {day.slice(0, 3)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {grid.hours.map((hour) => (
                                            <TableRow key={hour}>
                                                <TableCell>{String(hour).padStart(2, "0")}:00</TableCell>
                                                {DAYS_OF_WEEK.map((day, index) => {
                                                    const cell = grid.byCell.get(`${index + 1}-${hour}`);
                                                    const seconds = cell?.noCourierSeconds ?? 0;
                                                    return (
                                                        <TableCell
                                                            key={day}
                                                            align="center"
                                                            title={cell
                                                                ? `${formatOutageDuration(seconds)} of ${formatOutageDuration(cell.observedSeconds)} open`
                                                                : "not open / not measured"}
                                                            sx={{
                                                                backgroundColor: heatColor(seconds, grid.maxSeconds),
                                                                color: seconds > 0 ? "#000" : "#bbb",
                                                                fontWeight: seconds > 0 ? "bold" : "normal",
                                                                border: "1px solid #eee",
                                                            }}
                                                        >
                                                            {/* An unobserved cell is a dash, never a 0 -- "we were shut"
                                                                and "we were open and fine" must not look identical. */}
                                                            {cell == null ? "–" : seconds > 0 ? formatOutageDuration(seconds) : ""}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
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
