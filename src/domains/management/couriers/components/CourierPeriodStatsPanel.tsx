import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import { endOfDay, format, startOfDay } from 'date-fns';
import { fetchCourierPeriodStats } from '../../../../shared/api/dispatcher';
import { logger } from '../../../../shared/utils/logger';
import { DateRangePickerPopover } from '../../statistics/components/performance/DateRangePickerPopover';
import { formatStatDate } from '../../statistics/components/performance/statsFormat';
import type { DateRangeState } from '../../statistics/types';
import {
    formatKm,
    formatShiftMinutes,
    gpsNote,
    splitCoverageNote,
} from '../../statistics/components/delivery/productivityFormat';
import type { CourierPeriodStats } from '../types';
import { BRAND_RED, PANEL_CARD_SX, PanelNotice, SECTION_TITLE_SX } from './dispatcherStyles';

/**
 * One rider's numbers over a chosen window, above their order list.
 *
 * This is where the roster card's four lifetime counters went. They answered nothing there:
 * "taken" and "done" are equal by construction whenever every accepted order is delivered, so the
 * pair read as noise, and a lifetime refusal count says nothing about last week. Bounded by a
 * period, the same counters become facts a manager can act on — which is the whole point of the
 * move, not a relocation for tidiness.
 *
 * Opens on TODAY, matching the server's own default for the endpoint, so the panel and the API
 * agree before anyone touches the picker.
 */

/** The picker's single `selection` range, which is all this panel ever holds. */
function todayRange(): DateRangeState[] {
    const now = new Date();
    return [{ startDate: startOfDay(now), endDate: endOfDay(now), key: 'selection' }];
}

type Props = {
    courierId: string;
};

export function CourierPeriodStatsPanel({ courierId }: Props): JSX.Element {
    const [range, setRange] = useState<DateRangeState[]>(todayRange);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [stats, setStats] = useState<CourierPeriodStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Derived from the range rather than held in state: two sources for the same dates is how the
    // reading on screen and the window it was fetched for drift apart.
    const from = format(range[0].startDate, 'yyyy-MM-dd');
    const to = format(range[0].endDate, 'yyyy-MM-dd');

    const load = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            setStats(await fetchCourierPeriodStats(courierId, from, to));
        } catch (err) {
            logger.error('Courier period stats request failed:', err);
            setError(err instanceof Error ? err.message : String(err));
            // Cleared, not kept: leaving the previous window's numbers under a new date label
            // would present them as an answer for a period they do not describe.
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, [courierId, from, to]);

    useEffect(() => { void load(); }, [load]);

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ ...SECTION_TITLE_SX, mb: 0, flex: 1, minWidth: 0 }}>
                    Performance
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CalendarTodayRoundedIcon sx={{ fontSize: 16 }} />}
                    onClick={(event) => setAnchorEl(event.currentTarget)}
                    sx={{
                        borderRadius: 999, textTransform: 'none', fontWeight: 600, px: 1.75,
                        color: 'text.primary', backgroundColor: '#fff', borderColor: '#e0e0e0',
                        '&:hover': { borderColor: BRAND_RED, backgroundColor: '#fff' },
                    }}
                >
                    {formatStatDate(range[0].startDate)} — {formatStatDate(range[0].endDate)}
                </Button>
                <DateRangePickerPopover
                    mode="range"
                    id="courier-stats-range-popover"
                    open={anchorEl !== null}
                    anchorEl={anchorEl}
                    onClose={() => setAnchorEl(null)}
                    range={range}
                    onRangeChange={setRange}
                    applyLabel="🔁 Refresh"
                    onApply={() => setAnchorEl(null)}
                />
            </Box>

            {error !== null && <PanelNotice tone="error">{error}</PanelNotice>}

            <Box sx={{ ...PANEL_CARD_SX, px: 2, py: 2 }}>
                {loading && stats === null ? (
                    <CircularProgress size={20} sx={{ color: BRAND_RED }} />
                ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        <Stat
                            label="Average delivery"
                            /* Null, never "0 min": the server sends null when no delivery in the
                               window carries a hand-over stamp, and zero would read as instant. */
                            value={stats?.averageDeliveryMinutes == null
                                ? '—'
                                : `${stats.averageDeliveryMinutes.toFixed(1)} min`}
                        />
                        <Stat label="Delivered" value={String(stats?.deliveredCount ?? 0)} />
                        {/* What the rider carried, not what they earned — there is no commission
                            model in this system, and labelling it "earned" would invent one. */}
                        <Stat
                            label="Order value carried"
                            value={`BHD ${(stats?.deliveredTotal ?? 0).toFixed(2)}`}
                        />
                        {/* This month, not the selected window: the window defaults to today, and
                            "hours worked today" is not what anyone means by a rider's workload. */}
                        <Stat
                            label="Hours this month"
                            value={(stats?.hoursWorkedThisMonth ?? 0).toFixed(1)}
                        />
                        {/* Never summed into one "refused" figure: a rider who declines is making
                            a choice, one who never answers may have a dead phone. */}
                        <Stat label="Declined" value={String(stats?.declined ?? 0)} />
                        <Stat label="No answer" value={String(stats?.missed ?? 0)} />
                    </Box>
                )}
                {/* Optional on the wire: a backend from before it existed sends none, and the rest
                    of the panel must still read. For the panel's own window, unlike "Hours this month". */}
                {stats?.productivity !== undefined && (
                    <ProductivityTiles productivity={stats.productivity} windowStart={from} />
                )}
            </Box>
        </Box>
    );
}

function ProductivityTiles({ productivity, windowStart }: {
    productivity: NonNullable<CourierPeriodStats['productivity']>;
    windowStart: string;
}): JSX.Element {
    const { row } = productivity;
    const notes = [
        splitCoverageNote(productivity.splitCoverage, productivity.splitDataSince),
        gpsNote(productivity.gpsDataSince, windowStart),
    ].filter((note): note is string => note !== null);

    return (
        <Box data-testid="courier-productivity-tiles" sx={{ mt: 2, pt: 2, borderTop: '1px solid #f6f1ec' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Stat label="Km driven" value={formatKm(row.kmDriven)} />
                <Stat label="Km / delivery" value={formatKm(row.kmPerDelivery)} />
                <Stat label="On shift" value={formatShiftMinutes(row.onShiftMinutes)} />
                <Stat label="Free" value={formatShiftMinutes(row.freeMinutes)} />
                <Stat label="To kitchen" value={formatShiftMinutes(row.toKitchenMinutes)} />
                <Stat label="At kitchen" value={formatShiftMinutes(row.atKitchenMinutes)} />
                <Stat label="Carrying" value={formatShiftMinutes(row.carryingMinutes)} />
            </Box>
            {notes.map((note) => (
                <Typography key={note} variant="caption" sx={{ color: '#8a807a', display: 'block', mt: 1 }}>
                    {note}
                </Typography>
            ))}
        </Box>
    );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <Box>
            <Typography variant="caption" sx={{ color: '#8a807a', display: 'block' }}>{label}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#3b352c', lineHeight: 1.2 }}>
                {value}
            </Typography>
        </Box>
    );
}
