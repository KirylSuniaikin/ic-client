import React, {useCallback, useMemo, useState} from "react";
import {
    Box,
    Card,
    CardContent,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import {StatEmptyState, StatSkeleton} from "./performance/statPlaceholders";
import {formatSharePct} from "./performance/DeliveryAvailabilityCard";
import {formatStatRange} from "./performance/statsFormat";
import {formatMinutes} from "./DeliveryEstimateAccuracyCard";
import {formatBd} from "./business/businessFormat";
import {CELL_FILL_OPACITY, DeliveryZoneStatsMap} from "./DeliveryZoneStatsMap";
import {useDeliveryZoneStats} from "../hooks/useDeliveryZoneStats";
import {useDeliveryScopedStats} from "../hooks/useDeliveryScopedStats";
import {
    cellFillColor,
    lateCount,
    lostDemandDomain,
    lostDemandFillColor,
    metricDomain,
    MIN_LATE_SAMPLE,
    NO_DATA_COLOR,
    rampColor,
    rampPosition,
} from "../utils/deliveryZoneScale";
import {CoverageCaption, formatCount, noDataBeforeText} from "./delivery/deliveryMetricsUi";
import {LOST_DEMAND_REASON_LABELS} from "./delivery/lostDemandLabels";
import {labelOf} from "../../../../shared/utils/labelOf";
import {GOOGLE_MAPS_API_KEY} from "../../../branch/utils/mapsConfig";
import {fetchLostDemandZoneStats} from "../../../../shared/api/management";
import {BRAND_RED} from "../../../../shared/utils/theme";
import type {SxProps, Theme} from "@mui/material";
import type {DeliveryZoneMetric, MetricDomain} from "../utils/deliveryZoneScale";
import type {DeliveryStatsScope} from "../hooks/useStatistics";
import type {DeliveryZoneCell, DeliveryZoneCellMeters, LostDemandZoneCell, LostDemandZoneStats} from "../types";

const CELL_SIZES: readonly DeliveryZoneCellMeters[] = [250, 500, 1000];
const DEFAULT_CELL_METERS: DeliveryZoneCellMeters = 500;

/**
 * The three delivered-order metrics, plus where customers were turned away. "lostDemand" is a
 * different list of cells (mostly where nothing was delivered), so it lives here rather than in
 * DeliveryZoneMetric, whose helpers only make sense for delivered cells.
 */
type ZoneCardMetric = DeliveryZoneMetric | "lostDemand";

const METRICS: readonly ZoneCardMetric[] = ["orders", "avgTime", "late", "lostDemand"];

/**
 * Without a Maps key there is no colour scale to switch, so the delivered metrics collapse into one
 * table and only the choice between the two lists of cells remains.
 */
const NO_MAP_METRICS: readonly ZoneCardMetric[] = ["orders", "lostDemand"];

const METRIC_LABELS: Record<ZoneCardMetric, string> = {
    orders: "Orders",
    avgTime: "Avg time",
    late: "Late %",
    lostDemand: "Turned away",
};

const NO_MAP_METRIC_LABELS: Record<ZoneCardMetric, string> = {...METRIC_LABELS, orders: "Delivered"};

/**
 * What a grey cell means, per metric. Orders has none: every cell on the map has at least one —
 * and neither has Turned away, whose every cell turned at least one customer away.
 */
const NO_DATA_LABELS: Record<ZoneCardMetric, string | null> = {
    orders: null,
    avgTime: "no measured time",
    late: `fewer than ${MIN_LATE_SAMPLE} orders with a promise`,
    lostDemand: null,
};

// A stable empty list, so the memos below do not recompute on every render before data lands.
const NO_CELLS: DeliveryZoneCell[] = [];
const NO_LOST_CELLS: LostDemandZoneCell[] = [];

// Same pill group as the Statistics tab strip and MenuCostCardsCard, so the controls read as one
// family rather than as a second control system.
const PILL_GROUP_SX: SxProps<Theme> = {
    columnGap: 1,
    "& .MuiToggleButtonGroup-grouped": {
        border: "1px solid #e0e0e0",
        borderRadius: 999,
        margin: 0,
        "&:not(:first-of-type)": {marginLeft: 0, borderLeft: "1px solid #e0e0e0"},
    },
    "& .MuiToggleButton-root": {textTransform: "none", px: 2},
    "& .MuiToggleButton-root.Mui-selected": {
        backgroundColor: BRAND_RED,
        color: "#fff",
        borderColor: BRAND_RED,
        "&:hover": {backgroundColor: "#d23c3d", borderColor: "#d23c3d"},
    },
};

function formatCellSize(meters: DeliveryZoneCellMeters): string {
    return meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
}

/** A minute figure with its unit, or an em dash — never "0 min" for a cell with no sample. */
function formatMinutesLabel(value: number | null): string {
    return value == null || Number.isNaN(value) ? "—" : `${formatMinutes(value)} min`;
}

/** "22.2% (2 of 9)": the share never travels without the sample it was measured on. */
function formatLateLabel(cell: DeliveryZoneCell): string {
    const late = lateCount(cell);
    if (late === null) return "—";
    return `${formatSharePct(late, cell.lateSampleSize)} (${late} of ${cell.lateSampleSize})`;
}

function formatMetricValue(value: number, metric: ZoneCardMetric): string {
    switch (metric) {
        case "orders":
        case "lostDemand":
            return String(value);
        case "avgTime":
            return formatMinutesLabel(value);
        case "late":
            return `${(value * 100).toFixed(1)}%`;
    }
}

function formatPlacedSummary(orders: number, cells: number, cellMeters: DeliveryZoneCellMeters): string {
    const orderWord = orders === 1 ? "delivered order" : "delivered orders";
    const cellWord = cells === 1 ? "cell" : "cells";
    return `${orders} ${orderWord} across ${cells} ${cellWord} of ${formatCellSize(cellMeters)}`;
}

function formatTurnedAwaySummary(customers: number, cells: number, cellMeters: DeliveryZoneCellMeters): string {
    const cellWord = cells === 1 ? "cell" : "cells";
    return `${customers} turned away across ${cells} ${cellWord} of ${formatCellSize(cellMeters)}`;
}

/**
 * A cell's refusals, or an em dash when the range is wholly before recording began: the server
 * then sends 0 for every cell, and that 0 means "not recorded", not "nobody was refused here".
 */
function formatCellRefusals(cell: LostDemandZoneCell, refusalsRecorded: boolean): string {
    return formatCount(refusalsRecorded ? cell.refusals : null);
}

/** "Too far 4 · No courier 1": a cell's refusals by reason, the non-zero ones the server sends. */
function formatReasonBreakdown(cell: LostDemandZoneCell): string {
    return cell.refusalsByReason
        .map((bucket) => `${labelOf(LOST_DEMAND_REASON_LABELS, bucket.reason)} ${bucket.count}`)
        .join(" · ");
}

function formatUnlocatedFootnote(count: number): string {
    return count === 1
        ? "1 delivered order has no coordinates and is not shown"
        : `${count} delivered orders have no coordinates and are not shown`;
}

type Props = {
    /**
     * The APPLIED range the chain-wide delivery cards were fetched for — the same one the
     * estimate-accuracy card is labelled with. Null until the first refresh has come back.
     */
    scope: DeliveryStatsScope | null;
};

/**
 * Where delivered orders went, and how each area did — a map of hexagons coloured by orders,
 * average total time, or late share.
 *
 * Three rules it keeps:
 *
 *  - It counts the same delivered in-house orders as the estimate-accuracy card beside it, over the
 *    same applied range and the same scope (the whole chain), so the two can be reconciled.
 *  - In Late %, a share measured on fewer than MIN_LATE_SAMPLE promised orders is grey, not a shade
 *    of the scale: 50% late from two orders would otherwise be the darkest cell on the map and the
 *    first one anybody looks at. Only Late % has that floor — Orders and Avg time colour every cell
 *    that has a value, however few orders it holds.
 *  - Orders the map cannot place are counted out loud under it, never silently dropped: a map that
 *    loses a tenth of the window without saying so is read as the whole of it.
 */
export function DeliveryZoneStatsCard({scope}: Props): JSX.Element {
    const [cellMeters, setCellMeters] = useState<DeliveryZoneCellMeters>(DEFAULT_CELL_METERS);
    const [metric, setMetric] = useState<ZoneCardMetric>("orders");
    const [selected, setSelected] = useState<DeliveryZoneCell | null>(null);
    const {stats, fetchedFor, loading, failed} = useDeliveryZoneStats(scope, cellMeters);

    const lostMode = metric === "lostDemand";
    // Keyed on the cell size, so a size click refetches; only fetched while Turned away is the
    // view, so the tab does not pay for a map nobody is looking at.
    const fetchLostZones = useCallback(
        (startDate: string, finishDate: string): Promise<LostDemandZoneStats> =>
            fetchLostDemandZoneStats(startDate, finishDate, cellMeters),
        [cellMeters]
    );
    const lost = useDeliveryScopedStats<LostDemandZoneStats>(lostMode ? scope : null, fetchLostZones);

    const deliveredMetric: DeliveryZoneMetric = metric === "lostDemand" ? "orders" : metric;
    const cells = stats?.cells ?? NO_CELLS;
    const domain = useMemo(() => metricDomain(cells, deliveredMetric), [cells, deliveredMetric]);
    const fills = useMemo(
        () => new Map(cells.map((cell) => [cell.id, cellFillColor(cell, deliveredMetric, domain)])),
        [cells, deliveredMetric, domain]
    );
    // By identity, not by id: "0:0" exists at every cell size and names a different area at each,
    // so a selection only survives while the response it came from is the one on screen.
    const selectedCell = selected !== null && cells.includes(selected) ? selected : null;

    const hasNoDataCell = cells.some((cell) => fills.get(cell.id) === NO_DATA_COLOR);
    const fitKey = fetchedFor === null ? "" : `${fetchedFor.startDate}:${fetchedFor.finishDate}`;
    const mapMode = Boolean(GOOGLE_MAPS_API_KEY);
    const visibleMetrics = mapMode ? METRICS : NO_MAP_METRICS;
    const metricLabels = mapMode ? METRIC_LABELS : NO_MAP_METRIC_LABELS;
    // Without a map the delivered metrics are one table, so any of them selects the "Delivered" pill.
    const pillValue: ZoneCardMetric = mapMode || lostMode ? metric : "orders";

    const shownFor = lostMode ? lost.fetchedFor : fetchedFor;
    const shownHasStats = lostMode ? lost.stats !== null : stats !== null;
    const shownLoading = lostMode ? lost.loading : loading;

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2}}>
            <CardContent>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6" sx={{mb: 0.5}}>🛵 <b>Delivery Zones</b></Typography>
                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                        {lostMode
                            ? "customers turned away, by where they wanted delivery, on the same hexagon grid"
                            : "delivered orders by drop-off area, on a fixed hexagon grid"}
                        {mapMode ? " — tap a cell for its numbers" : ""}
                    </Typography>
                    {shownFor !== null && shownHasStats && (
                        <Typography
                            data-testid="zone-stats-scope"
                            variant="caption"
                            sx={{display: "block", mt: 0.5, fontWeight: 600, color: "text.secondary"}}
                        >
                            All branches · {formatStatRange(shownFor.startDate, shownFor.finishDate)}
                        </Typography>
                    )}
                </Box>

                <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 2}}>
                    {/* The colour scale only exists on the map; the no-key table prints every
                        delivered metric side by side instead, so there it is Delivered or Turned away. */}
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={pillValue}
                        onChange={(_, value: ZoneCardMetric | null) => value !== null && setMetric(value)}
                        aria-label={mapMode ? "Colour cells by" : "Show"}
                        sx={PILL_GROUP_SX}
                    >
                        {visibleMetrics.map((key) => (
                            <ToggleButton key={key} value={key}>{metricLabels[key]}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={cellMeters}
                        onChange={(_, value: DeliveryZoneCellMeters | null) => value !== null && setCellMeters(value)}
                        aria-label="Cell size"
                        sx={PILL_GROUP_SX}
                    >
                        {CELL_SIZES.map((size) => (
                            <ToggleButton key={size} value={size}>{formatCellSize(size)}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    {/* A refetch keeps the previous map on screen rather than blanking it, so the
                        viewport a manager zoomed into survives a cell-size switch. */}
                    {shownLoading && shownHasStats && (
                        <CircularProgress size={16} sx={{color: "#8f887c"}} data-testid="zone-stats-refreshing"/>
                    )}
                </Box>

                {lostMode ? (
                    lost.failed ? (
                        <Typography data-testid="lost-zones-error" variant="body2" color="error" sx={{py: 2}}>
                            Could not load where customers were turned away for this range.
                        </Typography>
                    ) : lost.stats === null ? (
                        <StatSkeleton lines={4}/>
                    ) : (
                        <LostDemandZoneView
                            stats={lost.stats}
                            mapMode={mapMode}
                            fitKey={lost.fetchedFor === null
                                ? "lost"
                                : `lost:${lost.fetchedFor.startDate}:${lost.fetchedFor.finishDate}`}
                        />
                    )
                ) : failed ? (
                    <Typography data-testid="zone-stats-error" variant="body2" color="error" sx={{py: 2}}>
                        Could not load the delivery zones for this range.
                    </Typography>
                ) : stats === null ? (
                    <StatSkeleton lines={4}/>
                ) : stats.cells.length === 0 ? (
                    <StatEmptyState message="No delivered orders to place on the map in this range"/>
                ) : (
                    <>
                        <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}
                                    data-testid="zone-stats-summary">
                            {formatPlacedSummary(stats.totalOrders, stats.cells.length, stats.cellMeters)}
                        </Typography>

                        {mapMode ? (
                            <>
                                <DeliveryZoneStatsMap<DeliveryZoneCell>
                                    cells={stats.cells}
                                    fills={fills}
                                    selectedId={selectedCell?.id ?? null}
                                    onSelect={setSelected}
                                    fitKey={fitKey}
                                />
                                <ZoneLegend
                                    metric={deliveredMetric}
                                    domain={domain}
                                    showNoData={hasNoDataCell}
                                />
                                {selectedCell === null ? (
                                    <Typography variant="caption" color="text.secondary"
                                                sx={{display: "block", mt: 1}}>
                                        Tap a cell to see its orders, revenue and timings.
                                    </Typography>
                                ) : (
                                    <ZoneDetails cell={selectedCell} cellMeters={stats.cellMeters}/>
                                )}
                            </>
                        ) : (
                            <ZoneTable cells={stats.cells}/>
                        )}
                    </>
                )}

                {!lostMode && !failed && stats !== null && stats.unlocatedOrders > 0 && (
                    <Typography data-testid="zone-stats-unlocated" variant="caption" color="text.secondary"
                                sx={{display: "block", mt: 1.5}}>
                        {formatUnlocatedFootnote(stats.unlocatedOrders)}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}

type LegendProps = {
    metric: ZoneCardMetric;
    domain: MetricDomain | null;
    showNoData: boolean;
};

function ZoneLegend({metric, domain, showNoData}: LegendProps): JSX.Element {
    const noDataLabel = NO_DATA_LABELS[metric];

    return (
        <Box sx={{display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 3, rowGap: 1, mt: 1, px: 0.5}}
             data-testid="zone-legend">
            {domain === null ? (
                <Typography variant="caption" sx={{color: "#8a807a", fontWeight: 600}}>
                    No cell has enough data to colour by {METRIC_LABELS[metric].toLowerCase()}
                </Typography>
            ) : domain.min === domain.max ? (
                // No spread, so no scale to draw: every coloured cell is the one mid-ramp shade, and
                // a light-to-dark bar beside it would place that shade halfway up a scale that does
                // not exist — a chain where no area was late would read as half late.
                <Box sx={{display: "flex", alignItems: "center", gap: 0.75}}>
                    <Box data-testid="zone-legend-swatch" sx={{
                        width: 10,
                        height: 10,
                        borderRadius: 0.5,
                        opacity: CELL_FILL_OPACITY,
                        backgroundColor: rampColor(rampPosition(domain.min, domain)),
                    }}/>
                    <Typography variant="caption" sx={{color: "#8a807a", fontWeight: 600}}
                                data-testid="zone-legend-single">
                        {formatMetricValue(domain.min, metric)} in every {showNoData ? "coloured " : ""}cell
                    </Typography>
                </Box>
            ) : (
                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                    <Typography variant="caption" sx={{color: "#8a807a", fontWeight: 600}}
                                data-testid="zone-legend-min">
                        {formatMetricValue(domain.min, metric)}
                    </Typography>
                    {/* Painted at the cells' own opacity, so the bar matches what is on the map
                        rather than a stronger version of it. */}
                    <Box data-testid="zone-legend-bar" sx={{
                        width: 160,
                        height: 10,
                        borderRadius: 1,
                        opacity: CELL_FILL_OPACITY,
                        background: `linear-gradient(to right, ${rampColor(0)}, ${rampColor(0.5)}, ${rampColor(1)})`,
                    }}/>
                    <Typography variant="caption" sx={{color: "#8a807a", fontWeight: 600}}
                                data-testid="zone-legend-max">
                        {formatMetricValue(domain.max, metric)}
                    </Typography>
                </Box>
            )}
            {showNoData && noDataLabel !== null && (
                <Box sx={{display: "flex", alignItems: "center", gap: 0.75}}>
                    <Box sx={{width: 10, height: 10, borderRadius: 0.5, backgroundColor: NO_DATA_COLOR,
                              opacity: CELL_FILL_OPACITY}}/>
                    <Typography variant="caption" sx={{color: "#8a807a", fontWeight: 600}}>
                        {noDataLabel}
                    </Typography>
                </Box>
            )}
        </Box>
    );
}

function DetailRow({label, value, testId}: { label: string; value: string; testId: string }): JSX.Element {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>{label}</Typography>
            <Typography variant="body1" fontWeight="bold" data-testid={testId}>{value}</Typography>
        </Box>
    );
}

function ZoneDetails({cell, cellMeters}: { cell: DeliveryZoneCell; cellMeters: DeliveryZoneCellMeters }): JSX.Element {
    return (
        <Box data-testid="zone-details" sx={{mt: 2, p: 2, borderRadius: 4, border: "1px solid #f1eae4"}}>
            <Typography variant="subtitle2" fontWeight={700}>
                Selected cell · {formatCellSize(cellMeters)} hexagon
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1.5}}>
                centre {cell.center.latitude.toFixed(4)}, {cell.center.longitude.toFixed(4)}
            </Typography>
            <Box sx={{display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 1.5}}>
                <DetailRow label="Orders" value={String(cell.orders)} testId="zone-detail-orders"/>
                <DetailRow label="Revenue" value={`BHD ${formatBd(cell.revenue)}`} testId="zone-detail-revenue"/>
                <DetailRow label="Avg total time" value={formatMinutesLabel(cell.avgTotalMinutes)}
                           testId="zone-detail-avg-total"/>
                <DetailRow label="p90 total time" value={formatMinutesLabel(cell.p90TotalMinutes)}
                           testId="zone-detail-p90-total"/>
                <DetailRow label="Avg road time" value={formatMinutesLabel(cell.avgRoadMinutes)}
                           testId="zone-detail-avg-road"/>
                <DetailRow label="Late" value={formatLateLabel(cell)} testId="zone-detail-late"/>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{display: "block", mt: 1.5}}>
                Total is order placed → delivered; road is left the kitchen → delivered. Late counts only
                orders with a promise on record.
            </Typography>
        </Box>
    );
}

/** The no-key fallback: the same cells as a list, busiest first. */
function ZoneTable({cells}: { cells: DeliveryZoneCell[] }): JSX.Element {
    const rows = useMemo(() => [...cells].sort((a, b) => b.orders - a.orders), [cells]);

    return (
        <Box sx={{overflowX: "auto"}}>
            <Table size="small" sx={{minWidth: 640}} data-testid="zone-stats-table">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{fontWeight: 600}}>Cell centre</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Orders</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Revenue</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Avg / p90 total</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Avg road</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Late</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((cell) => (
                        <TableRow key={cell.id} data-testid={`zone-row-${cell.id}`}>
                            <TableCell sx={{whiteSpace: "nowrap"}}>
                                {cell.center.latitude.toFixed(4)}, {cell.center.longitude.toFixed(4)}
                            </TableCell>
                            <TableCell align="right">{cell.orders}</TableCell>
                            <TableCell align="right">BHD {formatBd(cell.revenue)}</TableCell>
                            <TableCell align="right">
                                {formatMinutesLabel(cell.avgTotalMinutes)} / {formatMinutesLabel(cell.p90TotalMinutes)}
                            </TableCell>
                            <TableCell align="right">{formatMinutesLabel(cell.avgRoadMinutes)}</TableCell>
                            <TableCell align="right">{formatLateLabel(cell)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

type LostDemandZoneViewProps = {
    stats: LostDemandZoneStats;
    mapMode: boolean;
    /** Re-frames the map per range: these cells sit somewhere else entirely than the delivered ones. */
    fitKey: string;
};

/**
 * Where customers were turned away: refusals by the pin they were refused at, and orders gone at
 * payment by their delivery pin. Its own cells, not a field on the delivered ones — refusals mostly
 * happen where nothing was delivered, and those are the cells this view exists to show.
 */
function LostDemandZoneView({stats, mapMode, fitKey}: LostDemandZoneViewProps): JSX.Element {
    const [selected, setSelected] = useState<LostDemandZoneCell | null>(null);
    const cells = stats.cells.length === 0 ? NO_LOST_CELLS : stats.cells;
    const domain = useMemo(() => lostDemandDomain(cells), [cells]);
    const fills = useMemo(
        () => new Map(cells.map((cell) => [cell.id, lostDemandFillColor(cell, domain)])),
        [cells, domain]
    );
    // By identity, for the same reason as the delivered view: an id names a different area per size.
    const selectedCell = selected !== null && cells.includes(selected) ? selected : null;
    const placed = cells.reduce((sum, cell) => sum + cell.total, 0);
    const refusalsRecorded = stats.refusalsCoverage !== "NONE";

    return (
        <>
            {stats.refusalsCoverage === "NONE" ? (
                <Typography data-testid="lost-zones-coverage" variant="caption" color="text.secondary"
                            sx={{display: "block", mb: 1, fontStyle: "italic"}}>
                    Refusals — {noDataBeforeText(stats.refusalsDataSince)}. Only orders gone at payment are on the map.
                </Typography>
            ) : (
                <CoverageCaption coverage={stats.refusalsCoverage} dataSince={stats.refusalsDataSince}
                                 testId="lost-zones-coverage" subject="Refusals"/>
            )}

            {cells.length === 0 ? (
                <StatEmptyState message="Nobody was turned away at a pinned address in this range"/>
            ) : (
                <>
                    <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}
                                data-testid="lost-zones-summary">
                        {formatTurnedAwaySummary(placed, cells.length, stats.cellMeters)}
                    </Typography>

                    {mapMode && (
                        <>
                            <DeliveryZoneStatsMap<LostDemandZoneCell>
                                cells={cells}
                                fills={fills}
                                selectedId={selectedCell?.id ?? null}
                                onSelect={setSelected}
                                fitKey={fitKey}
                            />
                            <ZoneLegend metric="lostDemand" domain={domain} showNoData={false}/>
                            {selectedCell !== null && (
                                <LostDemandDetails cell={selectedCell} cellMeters={stats.cellMeters}
                                                   refusalsRecorded={refusalsRecorded}/>
                            )}
                        </>
                    )}

                    <LostDemandZoneTable cells={cells} refusalsRecorded={refusalsRecorded}/>
                </>
            )}

            {stats.unlocatedRefusals > 0 && (
                <Typography data-testid="lost-zones-unlocated-refusals" variant="caption" color="text.secondary"
                            sx={{display: "block", mt: 1.5}}>
                    {stats.unlocatedRefusals === 1
                        ? "1 refusal came from the cart, before an address existed, and has no place on the map"
                        : `${stats.unlocatedRefusals} refusals came from the cart, before an address existed, and have no place on the map`}
                </Typography>
            )}
            {stats.unlocatedAbandoned > 0 && (
                <Typography data-testid="lost-zones-unlocated-abandoned" variant="caption" color="text.secondary"
                            sx={{display: "block", mt: 0.5}}>
                    {stats.unlocatedAbandoned === 1
                        ? "1 order gone at payment had no pin and is not shown"
                        : `${stats.unlocatedAbandoned} orders gone at payment had no pin and are not shown`}
                </Typography>
            )}
        </>
    );
}

function LostDemandDetails({cell, cellMeters, refusalsRecorded}: {
    cell: LostDemandZoneCell;
    cellMeters: DeliveryZoneCellMeters;
    refusalsRecorded: boolean;
}): JSX.Element {
    return (
        <Box data-testid="lost-zone-details" sx={{mt: 2, p: 2, borderRadius: 4, border: "1px solid #f1eae4"}}>
            <Typography variant="subtitle2" fontWeight={700}>
                Selected cell · {formatCellSize(cellMeters)} hexagon
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1.5}}>
                centre {cell.center.latitude.toFixed(4)}, {cell.center.longitude.toFixed(4)}
            </Typography>
            <Box sx={{display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 1.5}}>
                <DetailRow label="Turned away" value={String(cell.total)} testId="lost-zone-detail-total"/>
                <DetailRow label="Refused" value={formatCellRefusals(cell, refusalsRecorded)}
                           testId="lost-zone-detail-refusals"/>
                <DetailRow label="Gone at payment" value={String(cell.abandonedLost)}
                           testId="lost-zone-detail-abandoned"/>
            </Box>
            {refusalsRecorded && cell.refusalsByReason.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{display: "block", mt: 1.5}}>
                    {formatReasonBreakdown(cell)}
                </Typography>
            )}
        </Box>
    );
}

/** Every turned-away cell, busiest first — the order the server sends them in. */
function LostDemandZoneTable({cells, refusalsRecorded}: {
    cells: LostDemandZoneCell[];
    refusalsRecorded: boolean;
}): JSX.Element {
    return (
        <Box sx={{overflowX: "auto", mt: 2}}>
            <Table size="small" sx={{minWidth: 640}} data-testid="lost-zones-table">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{fontWeight: 600}}>Cell centre</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Turned away</TableCell>
                        <TableCell sx={{fontWeight: 600}}>Refused, by reason</TableCell>
                        <TableCell sx={{fontWeight: 600}} align="right">Gone at payment</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {cells.map((cell) => (
                        <TableRow key={cell.id} data-testid={`lost-zone-row-${cell.id}`}>
                            <TableCell sx={{whiteSpace: "nowrap"}}>
                                {cell.center.latitude.toFixed(4)}, {cell.center.longitude.toFixed(4)}
                            </TableCell>
                            <TableCell align="right" sx={{fontWeight: 700}}>{cell.total}</TableCell>
                            <TableCell>
                                {formatCellRefusals(cell, refusalsRecorded)}
                                {refusalsRecorded && cell.refusalsByReason.length > 0 && (
                                    <Typography component="span" variant="caption" color="text.secondary"
                                                sx={{ml: 1}}>
                                        {formatReasonBreakdown(cell)}
                                    </Typography>
                                )}
                            </TableCell>
                            <TableCell align="right">{cell.abandonedLost}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}
