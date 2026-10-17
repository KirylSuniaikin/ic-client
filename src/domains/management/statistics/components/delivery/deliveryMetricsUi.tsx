import React from "react";
import {Box, Card, CardContent, CircularProgress, Typography} from "@mui/material";
import {format, parseISO} from "date-fns";
import {StatSkeleton} from "../performance/statPlaceholders";
import {formatStatRange} from "../performance/statsFormat";
import {formatMinutes} from "../DeliveryEstimateAccuracyCard";
import {formatBahrainDateTime} from "../../../../../shared/utils/timeUtils";
import type {DeliveryStatsScope} from "../../hooks/useStatistics";
import type {DurationSummary, MetricCoverage} from "../../types";

/*
 * Chrome shared by the four delivery-metric cards (time to a courier, quality, lost demand,
 * courier productivity). It copies the estimate-accuracy card's header and figure layout rather
 * than inventing one, so the new cards read as members of the tab they join.
 */

/** "6 Oct 2026, 15:00" — the moment a metric started being recorded. */
export function formatDataSince(dataSince: string): string {
    return formatBahrainDateTime(dataSince) ?? dataSince;
}

/** A bare `yyyy-MM-dd` as "8 Jul 2026", read as a LOCAL date so it cannot slip a day. */
export function formatIsoDate(isoDate: string): string {
    return format(parseISO(isoDate), "d MMM yyyy");
}

export function noDataBeforeText(dataSince: string): string {
    return `No data before ${formatDataSince(dataSince)}`;
}

export function partialCoverageText(dataSince: string): string {
    return `Counted from ${formatDataSince(dataSince)}. Earlier days in this range have no data.`;
}

/** A 0..1 share as "20.0%", or an em dash when there was nothing to divide by. */
export function formatShare(share: number | null): string {
    if (share == null || Number.isNaN(share)) return "—";
    return `${(share * 100).toFixed(1)}%`;
}

/** Minutes with their unit, or an em dash — never "0 min" for an empty sample. */
export function formatMinutesWithUnit(value: number | null): string {
    return value == null || Number.isNaN(value) ? "—" : `${formatMinutes(value)} min`;
}

/** A count that may not have been recorded: an em dash for null, never a zero. */
export function formatCount(value: number | null): string {
    return value == null ? "—" : String(value);
}

/** "N of M" with the denominator always beside the figure, so a thin sample looks thin. */
export function measuredOn(sampleCount: number | null, of: number): string {
    return `${formatCount(sampleCount)} of ${of}`;
}

/**
 * The note a captured figure carries about when recording began. FULL says nothing: the whole
 * range was recorded, and a caption saying so would be noise on every reading.
 */
export function CoverageCaption({coverage, dataSince, testId, subject}: {
    coverage: MetricCoverage;
    dataSince: string;
    testId: string;
    /** Names the figure the note is about, when the card carries more than one. */
    subject?: string;
}): JSX.Element | null {
    if (coverage === "FULL") return null;
    const note = coverage === "NONE" ? noDataBeforeText(dataSince) : partialCoverageText(dataSince);
    return (
        <Typography data-testid={testId} variant="caption" color="text.secondary"
                    sx={{display: "block", mb: 1, fontStyle: "italic"}}>
            {subject === undefined ? note : `${subject} — ${note}`}
        </Typography>
    );
}

/**
 * Stands in for a figure that was not being recorded yet. Never a zero: "nobody was refused" and
 * "we were not counting refusals" must not look the same.
 */
export function NoDataBefore({dataSince, testId}: { dataSince: string; testId: string }): JSX.Element {
    return (
        <Box data-testid={testId} sx={{py: 3, textAlign: "center", color: "text.secondary"}}>
            <Typography variant="body2">{noDataBeforeText(dataSince)}</Typography>
        </Box>
    );
}

type FigureProps = {
    label: string;
    value: string;
    /** Printed small after the value, and only when the value is a real figure. */
    unit?: string;
    caption?: React.ReactNode;
    testId: string;
};

/** A headline figure, laid out like the estimate-accuracy card's. */
export function Figure({label, value, unit, caption, testId}: FigureProps): JSX.Element {
    return (
        <Box data-testid={testId}>
            <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>{label}</Typography>
            <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                {value}
                {unit !== undefined && value !== "—" && (
                    <Typography component="span" variant="body2" sx={{ml: 0.5}}>{unit}</Typography>
                )}
            </Typography>
            {caption !== undefined && (
                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>{caption}</Typography>
            )}
        </Box>
    );
}

/** A captured headline figure that was not being recorded yet: its label, and when it began. */
export function FigureNotRecorded({label, dataSince, testId}: {
    label: string;
    dataSince: string;
    testId: string;
}): JSX.Element {
    return (
        <Box data-testid={testId}>
            <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>{label}</Typography>
            <Typography variant="body2" sx={{fontWeight: 600, color: "text.secondary", maxWidth: 200}}>
                {noDataBeforeText(dataSince)}
            </Typography>
        </Box>
    );
}

/** Median, p90 and mean of one summary, in the order a manager should read them. */
export function summaryCells(summary: DurationSummary): [string, string, string] {
    return [
        formatMinutes(summary.medianMinutes),
        formatMinutes(summary.p90Minutes),
        formatMinutes(summary.meanMinutes),
    ];
}

type ShellProps = {
    title: string;
    subtitle: string;
    /** Prefix for the card's test ids: `${testId}-scope`, `${testId}-error`. */
    testId: string;
    /** What the scope line names besides the dates. These reports are never branch-filtered. */
    scopeLabel?: string;
    fetchedFor: DeliveryStatsScope | null;
    loading: boolean;
    failed: boolean;
    failedMessage: string;
    hasStats: boolean;
    children: React.ReactNode;
};

/**
 * The card around a delivery metric: title, the range the figures were FETCHED for (never the one
 * sitting in the picker), and the loading / failed states, so each card only draws its figures.
 */
export function DeliveryMetricsCard({
    title,
    subtitle,
    testId,
    scopeLabel = "All branches",
    fetchedFor,
    loading,
    failed,
    failedMessage,
    hasStats,
    children,
}: ShellProps): JSX.Element {
    return (
        <Card data-testid={testId} sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2}}>
            <CardContent>
                <Box sx={{mb: 2}}>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                        <Typography variant="h6" sx={{mb: 0.5}}>🛵 <b>{title}</b></Typography>
                        {/* A new range keeps the previous figures up rather than blanking the card. */}
                        {loading && hasStats && (
                            <CircularProgress size={16} sx={{color: "#8f887c"}} data-testid={`${testId}-refreshing`}/>
                        )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                        {subtitle}
                    </Typography>
                    {fetchedFor !== null && hasStats && !failed && (
                        <Typography
                            data-testid={`${testId}-scope`}
                            variant="caption"
                            sx={{display: "block", mt: 0.5, fontWeight: 600, color: "text.secondary"}}
                        >
                            {scopeLabel} · {formatStatRange(fetchedFor.startDate, fetchedFor.finishDate)}
                        </Typography>
                    )}
                </Box>

                {failed ? (
                    <Typography data-testid={`${testId}-error`} variant="body2" color="error" sx={{py: 2}}>
                        {failedMessage}
                    </Typography>
                ) : !hasStats ? (
                    <StatSkeleton lines={4}/>
                ) : (
                    children
                )}
            </CardContent>
        </Card>
    );
}
