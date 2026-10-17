import React from 'react';
import { Box, Typography } from '@mui/material';
import { formatBahrainClock, minutesSinceBahrain } from '../../../../shared/utils/timeUtils';
import type { CourierBoardRow, NoOfferReason } from '../types';
import { noOfferReasonLabel } from '../utils/noOfferReasonLabels';
import { CourierStatusChip, EmptyState, FADED, Metric, MUTED, ROW_SX } from './dispatcherStyles';

/**
 * The assignment engine's own verdict on one order, rider by rider: who it ranked, when each
 * frees up, and above all why no offer went out to the rest.
 *
 * It used to be a third panel on the board, sitting beside the live deliveries and reading as a
 * second roster — and it says nothing at all until an order is picked, because every column on it
 * (`rank`, `score`, `freeAt`, `noOfferReason`) is annotated *for one order*. So it lives inside
 * the dialog that order opens now, where the question it answers is the question being asked.
 *
 * None of it is recomputed here. A second opinion that disagreed with the engine would be worse
 * than no column at all, because the manager would act on it.
 */

/**
 * `BUSY_UNTIL` is the one reason that is useless without its time — "busy" tells a manager
 * nothing, "busy until 14:32" tells them whether to wait or to phone someone else. The fallback
 * exists because the backend enum can grow ahead of this client.
 */
function noOfferReasonText(reason: NoOfferReason, freeAt: string | null): string {
    const base = noOfferReasonLabel(reason);
    if (reason !== 'BUSY_UNTIL') return base;
    const until = formatBahrainClock(freeAt);
    return until === null ? base : `${base} until ${until}`;
}

/**
 * A dash, never a zero. The backend returns null when a timing could not be derived, and "0 min"
 * would read as an instant handover — a silently wrong operational number.
 */
function clockOrDash(timestamp: string | null): string {
    return formatBahrainClock(timestamp) ?? '—';
}

/**
 * A courier with no fix is *nowhere* — never "near everything" — and a fix past the server's own
 * cutoff is not a position either. Both are rendered as explicitly unusable rather than as a
 * plausible-looking timestamp, because the whole point of the line is to stop a manager
 * dispatching on a location that does not exist.
 */
function PositionFreshness({ row }: { row: CourierBoardRow }): JSX.Element {
    if (row.positionFixedAt === null) {
        return (
            <Typography variant="caption" sx={{ color: FADED, fontStyle: 'italic' }}>
                No position fix
            </Typography>
        );
    }
    const ageMinutes = minutesSinceBahrain(row.positionFixedAt);
    const isStale = ageMinutes > row.positionStaleAfterMinutes;
    const clock = clockOrDash(row.positionFixedAt);
    return (
        <Typography variant="caption" sx={{ color: isStale ? FADED : MUTED, fontStyle: isStale ? 'italic' : 'normal' }}>
            {isStale
                ? `Position ${clock} — stale`
                : `Position ${clock} (${ageMinutes} min ago)`}
        </Typography>
    );
}

export interface CourierAvailabilityListProps {
    rows: CourierBoardRow[];
    /** Suppresses the empty state while the annotated fetch is still in flight. */
    loading: boolean;
}

export function CourierAvailabilityList({ rows, loading }: CourierAvailabilityListProps): JSX.Element {
    return (
        <>
            {rows.length === 0 && !loading && (
                <EmptyState>No couriers on the roster.</EmptyState>
            )}
            {rows.map((row) => (
                <Box
                    key={row.courierId}
                    data-testid={`courier-row-${row.courierId}`}
                    sx={{ ...ROW_SX, flexDirection: 'column', alignItems: 'stretch', gap: 0.75 }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>
                            {row.name ?? row.courierId}
                        </Typography>
                        {/* Shown 1-based for reading. The wire value is the engine's zero-based
                            ordinal within the eligible set — never courier_queue.position, which
                            is a sparse key that drifts unboundedly and is a sort key, not a
                            magnitude. */}
                        {row.rank !== null && (
                            <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                #{row.rank + 1} · score {row.score === null ? '—' : row.score.toFixed(1)}
                            </Typography>
                        )}
                        <CourierStatusChip status={row.status} />
                    </Box>

                    {/* Null, not "" — a rider who predates the phone column has to read
                        differently from one saved with a blank number. */}
                    <Typography
                        variant="caption"
                        sx={{ color: row.phone === null ? FADED : MUTED, fontStyle: row.phone === null ? 'italic' : 'normal' }}
                    >
                        {row.phone ?? 'No phone on file'}
                    </Typography>

                    {/* The single most valuable line: why this order is still sitting here.
                        Straight from the engine, never re-derived. */}
                    {row.noOfferReason !== null && (
                        <Box sx={{ backgroundColor: '#fff6e6', borderRadius: 999, px: 1.25, py: 0.25, alignSelf: 'flex-start' }}>
                            <Typography variant="caption" sx={{ color: '#8a5a00', fontWeight: 700 }}>
                                {noOfferReasonText(row.noOfferReason, row.freeAt)}
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                        <Metric label="Free at" value={clockOrDash(row.freeAt)} />
                        <Metric label="In hand" value={String(row.ordersInHand)} />
                        {/* Declined and missed never merge into one "refused" figure: a rider who
                            declines is making a choice, one who goes silent may have a dead
                            phone. */}
                        <Metric label="Declined" value={String(row.declinedCount)} />
                        <Metric label="Missed" value={String(row.missedCount)} />
                        <Metric label="On shift since" value={clockOrDash(row.onShiftSince)} />
                    </Box>

                    <PositionFreshness row={row} />
                </Box>
            ))}
        </>
    );
}
