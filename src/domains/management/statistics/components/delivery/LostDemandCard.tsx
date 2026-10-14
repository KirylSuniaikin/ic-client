import React, {useMemo} from "react";
import {Box, Table, TableBody, TableCell, TableHead, TableRow, Typography} from "@mui/material";
import {format, parseISO} from "date-fns";
import {StatEmptyState} from "../performance/statPlaceholders";
import {formatBd} from "../business/businessFormat";
import {DAYS_OF_WEEK, heatmapColor} from "../../utils/deliveryHourGrid";
import {useDeliveryScopedStats} from "../../hooks/useDeliveryScopedStats";
import {fetchLostDemandStats} from "../../../../../shared/api/management";
import {
    CoverageCaption,
    DeliveryMetricsCard,
    Figure,
    FigureNotRecorded,
    formatCount,
    NoDataBefore,
    noDataBeforeText,
} from "./deliveryMetricsUi";
import {DEMAND_PLATFORM_LABELS, DEMAND_STAGE_LABELS, LOST_DEMAND_REASON_LABELS} from "./lostDemandLabels";
import {labelOf} from "../../../../../shared/utils/labelOf";
import type {DeliveryStatsScope} from "../../hooks/useStatistics";
import type {LostDemandHourCell, LostDemandKeeta, LostDemandRefusals, LostDemandStats} from "../../types";

/** One row of a breakdown table: what was refused, and how many of those went to Keeta. */
type BreakdownRow = {
    key: string;
    label: string;
    /** Null when the column's section was not recorded; undefined when the row does not apply to it. */
    refused: number | null | undefined;
    keeta: number | null | undefined;
};

function countFor<T extends { count: number }>(list: T[] | undefined, match: (item: T) => boolean): number | undefined {
    return list?.find(match)?.count;
}

/** What a breakdown cell prints: a count, a dash for "not recorded", or "n/a" for a row the column cannot have. */
function breakdownCell(value: number | null | undefined): string {
    if (value === undefined) return "n/a";
    return formatCount(value);
}

function reasonRows(refusals: LostDemandRefusals | null, keeta: LostDemandKeeta | null): BreakdownRow[] {
    // The six reasons always, in the backend's enum order, so a zero reads as a real zero.
    const reasons = refusals?.byReason.map((bucket) => bucket.reason)
        ?? keeta?.byReason.filter((bucket) => bucket.reason !== "UNKNOWN").map((bucket) => bucket.reason)
        ?? [];
    const rows: BreakdownRow[] = reasons.map((reason) => ({
        key: reason,
        label: labelOf(LOST_DEMAND_REASON_LABELS, reason),
        refused: refusals === null ? null : countFor(refusals.byReason, (bucket) => bucket.reason === reason) ?? 0,
        keeta: keeta === null ? null : countFor(keeta.byReason, (bucket) => bucket.reason === reason) ?? 0,
    }));
    // A Keeta event sent without a reason has no refusal twin; it gets a row only when it happened.
    const unknown = countFor(keeta?.byReason, (bucket) => bucket.reason === "UNKNOWN") ?? 0;
    if (unknown > 0) {
        rows.push({key: "UNKNOWN", label: LOST_DEMAND_REASON_LABELS.UNKNOWN, refused: undefined, keeta: unknown});
    }
    return rows;
}

function stageRows(refusals: LostDemandRefusals | null, keeta: LostDemandKeeta | null): BreakdownRow[] {
    const stages = refusals?.byStage.map((bucket) => bucket.stage) ?? keeta?.byStage.map((bucket) => bucket.stage) ?? [];
    return stages.map((stage) => ({
        key: stage,
        label: labelOf(DEMAND_STAGE_LABELS, stage),
        refused: refusals === null ? null : countFor(refusals.byStage, (bucket) => bucket.stage === stage) ?? 0,
        // There is no Keeta card at the payment step, so CHECKOUT is "n/a" there, not a zero.
        keeta: keeta === null ? null : countFor(keeta.byStage, (bucket) => bucket.stage === stage),
    }));
}

function platformRows(refusals: LostDemandRefusals | null, keeta: LostDemandKeeta | null): BreakdownRow[] {
    const platforms = refusals?.byPlatform.map((bucket) => bucket.platform)
        ?? keeta?.byPlatform.map((bucket) => bucket.platform) ?? [];
    return platforms.map((platform) => ({
        key: platform,
        label: labelOf(DEMAND_PLATFORM_LABELS, platform),
        refused: refusals === null ? null : countFor(refusals.byPlatform, (bucket) => bucket.platform === platform) ?? 0,
        keeta: keeta === null ? null : countFor(keeta.byPlatform, (bucket) => bucket.platform === platform) ?? 0,
    }));
}

function formatDay(isoDate: string): string {
    // parseISO reads a bare date as LOCAL midnight, so the printed day is the day the server meant.
    return format(parseISO(isoDate), "EEE d MMM");
}

type Props = {
    /** The applied chain-wide range; null until the first refresh has come back. */
    scope: DeliveryStatsScope | null;
};

/**
 * Customers who wanted delivery and did not get it (M3): refused by the availability gate, sent
 * to Keeta instead, or gone at the payment step.
 *
 * It sits beside the availability card on purpose. That card says how long delivery was off;
 * this one says how many people found it off — the hour a branch was without a courier costs
 * nothing if nobody tried to order in it, and everything if fifty did.
 *
 * Refusals are de-duplicated per browsing session and ~100 m spot, so they are estimates, and
 * there is no exact rate: successful checks are not stored. Paid delivery orders sit beside them
 * for scale, not as a denominator. Refusals and Keeta choices only exist from the deploy that
 * began recording them; a day before that is a dash, never a zero.
 */
export function LostDemandCard({scope}: Props): JSX.Element {
    const {stats, fetchedFor, loading, failed} = useDeliveryScopedStats<LostDemandStats>(scope, fetchLostDemandStats);

    return (
        <DeliveryMetricsCard
            title="Lost Demand"
            subtitle="customers who wanted delivery and did not get it — refused, sent to Keeta, or gone at payment"
            testId="lost-demand"
            fetchedFor={fetchedFor}
            loading={loading}
            failed={failed}
            failedMessage="Could not load lost demand for this range."
            hasStats={stats !== null}
        >
            {stats !== null && <LostDemandBody stats={stats}/>}
        </DeliveryMetricsCard>
    );
}

function LostDemandBody({stats}: { stats: LostDemandStats }): JSX.Element {
    const {refusals, keeta, abandoned} = stats;

    const nobodyTurnedAway = refusals !== null && keeta !== null
        && refusals.total === 0 && keeta.total === 0 && abandoned.orders === 0;

    if (nobodyTurnedAway) {
        return (
            <>
                <CoverageCaption coverage={stats.refusalsCoverage} dataSince={stats.refusalsDataSince}
                                 testId="lost-demand-refusals-coverage" subject="Refusals"/>
                <StatEmptyState message="Nobody was turned away in this range"/>
            </>
        );
    }

    return (
        <>
            <Box sx={{display: "flex", flexWrap: "wrap", gap: 4, mb: 2}}>
                {refusals === null ? (
                    <FigureNotRecorded label="Refused delivery" dataSince={stats.refusalsDataSince}
                                       testId="lost-demand-refusals"/>
                ) : (
                    <Figure
                        testId="lost-demand-refusals"
                        label="Refused delivery"
                        value={String(refusals.total)}
                        caption={`≈ ${refusals.estimatedAttempts} customers (estimated)`}
                    />
                )}
                {keeta === null ? (
                    <FigureNotRecorded label="Chose Keeta instead" dataSince={stats.keetaDataSince}
                                       testId="lost-demand-keeta"/>
                ) : (
                    <Figure
                        testId="lost-demand-keeta"
                        label="Chose Keeta instead"
                        value={String(keeta.total)}
                        caption="pressed the Keeta button"
                    />
                )}
                <Figure
                    testId="lost-demand-abandoned"
                    label="Gone at payment"
                    value={String(abandoned.lost)}
                    caption={`BHD ${formatBd(abandoned.lostValueBhd)} · ${abandoned.recovered} of ${abandoned.orders} came back and paid`}
                />
                <Figure
                    testId="lost-demand-paid"
                    label="Paid delivery orders"
                    value={String(stats.paidDeliveryOrders)}
                    caption="for scale — not a rate"
                />
            </Box>

            <CoverageCaption coverage={stats.refusalsCoverage} dataSince={stats.refusalsDataSince}
                             testId="lost-demand-refusals-coverage" subject="Refusals"/>
            <CoverageCaption coverage={stats.keetaCoverage} dataSince={stats.keetaDataSince}
                             testId="lost-demand-keeta-coverage" subject="Keeta choices"/>

            <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 2}}>
                A customer retrying the same address within 30 minutes counts once, so refusals are estimates.
                Gone at payment is an unpaid delivery order with no paid order from the same phone within two
                hours; {abandoned.byStatus.map((bucket) => `${bucket.count} ${bucket.status}`).join(", ")} in all.
            </Typography>

            {(refusals !== null || keeta !== null) && (
                <Box sx={{display: "flex", flexWrap: "wrap", gap: 3, mb: 3}}>
                    <BreakdownTable title="Why" rows={reasonRows(refusals, keeta)} testId="lost-demand-by-reason"/>
                    <BreakdownTable title="Where in the flow" rows={stageRows(refusals, keeta)}
                                    testId="lost-demand-by-stage"/>
                    <BreakdownTable title="Platform" rows={platformRows(refusals, keeta)}
                                    testId="lost-demand-by-platform"/>
                </Box>
            )}

            <Typography variant="subtitle1" sx={{mb: 1, fontWeight: "bold"}}>By Day</Typography>
            <Box sx={{overflowX: "auto", maxHeight: 360, overflowY: "auto", mb: 3}}>
                <Table size="small" stickyHeader sx={{minWidth: 560}} data-testid="lost-demand-by-day">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 600}}>Day</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Refused</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">≈ Customers</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Chose Keeta</TableCell>
                            <TableCell sx={{fontWeight: 600}} align="right">Gone at payment</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stats.byDay.map((day) => (
                            <TableRow key={day.date} data-testid={`lost-demand-day-${day.date}`}>
                                <TableCell sx={{whiteSpace: "nowrap"}}>{formatDay(day.date)}</TableCell>
                                <TableCell align="right" title={day.refusals === null
                                    ? noDataBeforeText(stats.refusalsDataSince) : undefined}>
                                    {formatCount(day.refusals)}
                                </TableCell>
                                <TableCell align="right" title={day.estimatedAttempts === null
                                    ? noDataBeforeText(stats.refusalsDataSince) : undefined}>
                                    {formatCount(day.estimatedAttempts)}
                                </TableCell>
                                <TableCell align="right" title={day.keetaChosen === null
                                    ? noDataBeforeText(stats.keetaDataSince) : undefined}>
                                    {formatCount(day.keetaChosen)}
                                </TableCell>
                                <TableCell align="right">{day.abandonedLost}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>

            <Typography variant="subtitle1" sx={{mb: 1, fontWeight: "bold"}}>Refusals By Hour</Typography>
            {refusals === null ? (
                <NoDataBefore dataSince={stats.refusalsDataSince} testId="lost-demand-by-hour-no-data"/>
            ) : stats.byHour.length === 0 ? (
                <StatEmptyState message="No refusals in this range"/>
            ) : (
                <RefusalHourGrid cells={stats.byHour}/>
            )}
        </>
    );
}

function BreakdownTable({title, rows, testId}: { title: string; rows: BreakdownRow[]; testId: string }): JSX.Element {
    return (
        <Box sx={{flex: "1 1 260px", maxWidth: 380, overflowX: "auto"}}>
            <Table size="small" data-testid={testId}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{fontWeight: 600}}>{title}</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Refused</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Chose Keeta</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.key} data-testid={`${testId}-${row.key}`}>
                            <TableCell>{row.label}</TableCell>
                            <TableCell align="right">{breakdownCell(row.refused)}</TableCell>
                            <TableCell align="right">{breakdownCell(row.keeta)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

/**
 * Refusals per weekday and hour — the same axes as the delivered and no-courier grids above, so
 * the three can be read against each other: an hour full of refusals that also shows no courier
 * time is the hour to staff.
 */
function RefusalHourGrid({cells}: { cells: LostDemandHourCell[] }): JSX.Element {
    const grid = useMemo(() => {
        const byCell = new Map<string, LostDemandHourCell>();
        let max = 0;
        for (const cell of cells) {
            byCell.set(`${cell.dayOfWeek}-${cell.hour}`, cell);
            max = Math.max(max, cell.refusals);
        }
        // Only hours that had a refusal: the grid is sparse, and a row of blanks is not information.
        const hours = Array.from(new Set(cells.map((cell) => cell.hour))).sort((a, b) => a - b);
        return {byCell, max, hours};
    }, [cells]);

    return (
        <Box sx={{overflowX: "auto"}}>
            <Table size="small" sx={{minWidth: 620}} data-testid="lost-demand-by-hour">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{fontWeight: 600}}>Hour</TableCell>
                        {DAYS_OF_WEEK.map((day) => (
                            <TableCell key={day} align="center" sx={{fontWeight: 600}}>{day.slice(0, 3)}</TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {grid.hours.map((hour) => (
                        <TableRow key={hour}>
                            <TableCell>{String(hour).padStart(2, "0")}:00</TableCell>
                            {DAYS_OF_WEEK.map((day, index) => {
                                const cell = grid.byCell.get(`${index + 1}-${hour}`);
                                return (
                                    <TableCell
                                        key={day}
                                        align="center"
                                        data-testid={`lost-demand-hour-${index + 1}-${hour}`}
                                        title={cell === undefined
                                            ? "no refusals"
                                            : `${cell.refusals} refused · ≈ ${cell.estimatedAttempts} customers`}
                                        sx={{
                                            backgroundColor: heatmapColor(cell?.refusals ?? 0, grid.max),
                                            fontWeight: cell === undefined ? "normal" : "bold",
                                            border: "1px solid #eee",
                                        }}
                                    >
                                        {cell === undefined ? "" : cell.refusals}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}
