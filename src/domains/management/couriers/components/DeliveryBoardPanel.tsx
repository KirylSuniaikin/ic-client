import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { fetchBoardCouriers, fetchDeliveryCards } from '../../../../shared/api/dispatcher';
import { logger } from '../../../../shared/utils/logger';
import { formatBahrainClock, minutesSinceBahrain } from '../../../../shared/utils/timeUtils';
import { useDeliveryBoardEvents } from '../hooks/useDeliveryBoardEvents';
import type { CourierBoardRow, DeliveryCard, NoOfferReason } from '../types';
import { noOfferReasonLabel } from '../utils/noOfferReasonLabels';
import {
    BRAND_RED as brandRed, CLICKABLE_ROW_SX, CourierStatusChip, EmptyState, PANEL_CARD_SX,
    PANEL_MIN_HEIGHT, PanelNotice, ROW_SX, SECTION_TITLE_SX,
} from './dispatcherStyles';

/**
 * The dispatcher board (DELIVERY_TODO.md "Dispatcher board"): two **linked** panels over the two
 * `/management/delivery/board/**` endpoints, which had no client at all until now.
 *
 * Left, the live deliveries — carrying no item list on purpose. This is a logistics view: it
 * answers "which delivery is about to be late, and who do I phone about it", which is why both
 * phone numbers are on the card and none of the food is.
 *
 * Right, every courier in the city. Selecting a card re-fetches this panel *for that order*, so
 * each row carries the assignment engine's own verdict — its ranking, when the rider frees up,
 * and above all why no offer went out. None of that is recomputed here: a second opinion that
 * disagreed with the engine would be worse than no column at all, because the manager would act
 * on it.
 */

/** Muted body text, and the greyer tone reserved for "this value is not usable". */
const MUTED = '#8a807a';
const FADED = '#b0a79f';

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

function minutesOrDash(minutes: number | null): string {
    return minutes === null ? '—' : `${minutes} min`;
}

/** A labelled figure. The value is its own text node so "—" stays legible on its own. */
function Metric({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: MUTED }}>{label}</Typography>
            <Typography variant="caption" sx={{ color: '#3b352c', fontWeight: 700 }}>{value}</Typography>
        </Box>
    );
}

/**
 * A courier with no fix is *nowhere* — never "near everything" — and a fix past the server's own
 * cutoff is not a position either. Both are rendered as explicitly unusable rather than as a
 * plausible-looking timestamp, because the whole point of the column is to stop a manager
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

export function DeliveryBoardPanel(): JSX.Element {
    const [cards, setCards] = useState<DeliveryCard[]>([]);
    const [rows, setRows] = useState<CourierBoardRow[]>([]);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Cards first, then couriers — not in parallel — because the second call's annotation depends
     * on whether the selected card is still live. An order concludes and leaves the card list
     * while the board is open; leaving its ranking on screen would answer a question nobody is
     * asking any more.
     */
    const reload = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const loadedCards = await fetchDeliveryCards();
            const isStillLive = selectedOrderId !== null
                && loadedCards.some((card) => card.orderId === selectedOrderId);
            const annotateFor = isStillLive ? selectedOrderId : null;
            const loadedRows = await fetchBoardCouriers(annotateFor);
            setCards(loadedCards);
            setRows(loadedRows);
            if (selectedOrderId !== null && !isStillLive) setSelectedOrderId(null);
        } catch (err) {
            logger.error('Delivery board request failed:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [selectedOrderId]);

    // Selecting a card changes `reload`'s identity, which is what re-annotates the courier panel.
    useEffect(() => { void reload(); }, [reload]);

    // The board is the screen a manager stares at while a delivery is stuck, so it cannot be a
    // snapshot. Refetches rather than patching from the frame — half-applied events leave a list
    // that is partly live and partly stale.
    useDeliveryBoardEvents(reload);

    const selectedCard = cards.find((card) => card.orderId === selectedOrderId) ?? null;

    return (
        <Box sx={{ mb: 4 }}>
            {error !== null && <PanelNotice tone="error">{error}</PanelNotice>}
            {loading && <CircularProgress size={22} sx={{ mb: 2, color: brandRed }} />}

            {/* Stretched, not flex-start: the two panels are read against each other — "why is
                this order still sitting here" on the left, "who could take it" on the right — and
                two cards of different heights beside a shared gap read as two unrelated widgets.
                Stretching the COLUMN is not enough on its own, because the card is a child of it,
                so each column is itself a flex column whose card takes the remaining height. */}
            <Box
                data-testid="delivery-board-columns"
                sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}
            >
                <Box sx={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>Live deliveries</Typography>
                    {/* The floor goes on BOTH cards, not on "the shorter one": which of the two is
                        shorter flips with the hour, and a floor on the wrong one is no floor. */}
                    <Box data-testid="live-deliveries-card" sx={{ ...PANEL_CARD_SX, flex: 1, minHeight: PANEL_MIN_HEIGHT }}>
                        {cards.length === 0 && !loading && (
                            <EmptyState>Nothing is out for delivery right now.</EmptyState>
                        )}
                        {/* Rendered in the order the server sent them: it has already sorted on
                            riskMinutes, most at risk first. A chronological list buries the one
                            order that needs attention, and re-sorting here would be a second
                            opinion on a figure the server computed. */}
                        {cards.map((card) => {
                            const isSelected = card.orderId === selectedOrderId;
                            return (
                                <Box
                                    key={card.orderId}
                                    data-testid={`delivery-card-${card.orderId}`}
                                    onClick={() => setSelectedOrderId(isSelected ? null : card.orderId)}
                                    sx={{
                                        ...CLICKABLE_ROW_SX,
                                        flexDirection: 'column',
                                        alignItems: 'stretch',
                                        gap: 0.5,
                                        // The hover tint from CLICKABLE_ROW_SX would otherwise wipe
                                        // the selection out from under the cursor — and the tint is
                                        // the only thing tying the two panels together on screen.
                                        ...(isSelected
                                            ? {
                                                backgroundColor: 'rgba(228,75,76,0.06)',
                                                '&:hover': { backgroundColor: 'rgba(228,75,76,0.10)' },
                                            }
                                            : {}),
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                            #{card.orderNo ?? card.orderId}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: MUTED, flex: 1, minWidth: 0 }}>
                                            {card.status}
                                        </Typography>
                                        {/* The reason the list is in this order, so it is the one
                                            number on the card that gets emphasis. */}
                                        <Typography variant="caption" sx={{ color: MUTED }}>risk</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: brandRed, whiteSpace: 'nowrap' }}>
                                            {minutesOrDash(card.riskMinutes)}
                                        </Typography>
                                    </Box>

                                    <Typography variant="body2" sx={{ color: MUTED }}>
                                        {card.branchName ?? '—'} · {card.addressLine ?? 'No address on file'}
                                    </Typography>

                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                                        <Metric label="Ready" value={clockOrDash(card.readyAt)} />
                                        <Metric label="Handover" value={clockOrDash(card.estimatedHandoverAt)} />
                                        <Metric label="At the door" value={clockOrDash(card.estimatedDeliveredAt)} />
                                    </Box>

                                    {/* Both numbers, because the manager's next action on a stuck
                                        delivery is almost always a phone call — and an absent one
                                        says so in words rather than showing a blank. */}
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                                        <Metric label="Customer" value={card.customerPhone ?? 'no number on file'} />
                                        <Metric label="Courier" value={card.courierPhone ?? 'not assigned'} />
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="subtitle1" sx={{ ...SECTION_TITLE_SX, mb: 0.5 }}>
                        {selectedCard === null
                            ? 'Courier availability'
                            : `Couriers for #${selectedCard.orderNo ?? selectedCard.orderId}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: MUTED, display: 'block', mb: 1.5 }}>
                        {selectedCard === null
                            ? 'Pick a delivery to see the order the engine would offer it in.'
                            : "The engine's own ranking, and why the rest got no offer."}
                    </Typography>
                    <Box data-testid="courier-availability-card" sx={{ ...PANEL_CARD_SX, flex: 1, minHeight: PANEL_MIN_HEIGHT }}>
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
                                    {/* Shown 1-based for reading. The wire value is the engine's
                                        zero-based ordinal within the eligible set — never
                                        courier_queue.position, which is a sparse key that drifts
                                        unboundedly and is a sort key, not a magnitude. */}
                                    {row.rank !== null && (
                                        <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            #{row.rank + 1} · score {row.score === null ? '—' : row.score.toFixed(1)}
                                        </Typography>
                                    )}
                                    <CourierStatusChip status={row.status} />
                                </Box>

                                {/* Null, not "" — a rider who predates the phone column has to
                                    read differently from one saved with a blank number. */}
                                <Typography
                                    variant="caption"
                                    sx={{ color: row.phone === null ? FADED : MUTED, fontStyle: row.phone === null ? 'italic' : 'normal' }}
                                >
                                    {row.phone ?? 'No phone on file'}
                                </Typography>

                                {/* The single most valuable column: why this order is still sitting
                                    here. Straight from the engine, never re-derived. */}
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
                                    {/* Declined and missed never merge into one "refused" figure:
                                        a rider who declines is making a choice, one who goes
                                        silent may have a dead phone. */}
                                    <Metric label="Declined" value={String(row.declinedCount)} />
                                    <Metric label="Missed" value={String(row.missedCount)} />
                                    <Metric label="On shift since" value={clockOrDash(row.onShiftSince)} />
                                </Box>

                                <PositionFreshness row={row} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
