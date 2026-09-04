import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { fetchBoardCouriers, fetchDeliveryCards } from '../../../../shared/api/dispatcher';
import { logger } from '../../../../shared/utils/logger';
import { formatBahrainClock } from '../../../../shared/utils/timeUtils';
import { useDeliveryBoardEvents } from '../hooks/useDeliveryBoardEvents';
import type { CourierBoardRow, CourierStats, DeliveryCard, UnassignedOrder } from '../types';
import {
    FRESHNESS_BUDGET_MINUTES, FRESHNESS_LABEL, freshnessFill, freshnessStanding, freshnessText,
} from '../utils/freshness';
import { AssignCourierDialog } from './AssignCourierDialog';
import {
    BRAND_RED as brandRed, CLICKABLE_ROW_SX, EmptyState, FADED, Metric, MUTED, PANEL_CARD_SX,
    PANEL_MIN_HEIGHT, PanelNotice, SECTION_TITLE_SX, TONE_BAD, TONE_OK,
} from './dispatcherStyles';

/**
 * The dispatcher board (DELIVERY_TODO.md "Dispatcher board"): every delivery in flight, over the
 * `/management/delivery/board/**` endpoints.
 *
 * It carries no item list on purpose. This is a logistics view: it answers "which delivery is
 * about to be late, and who do I phone about it", which is why both phone numbers are on the card
 * and none of the food is.
 *
 * The engine's per-rider verdict for one order used to be a second panel beside this one. It now
 * opens with the order, inside {@link AssignCourierDialog} — see that component for why. What is
 * left here is one block: what is in flight.
 */

export interface DeliveryBoardPanelProps {
    /** Riders the manual-assignment picker can offer; owned by the parent, which already loads them. */
    couriers: CourierStats[];
    /**
     * The server's own set of orders still waiting for a rider. Membership — not a null
     * `courierPhone`, which is also null for a rider with no number on file — is what decides
     * whether manual assignment is offered for a card.
     */
    awaiting: UnassignedOrder[];
    onAssign: (orderId: number, courierId: string) => void;
    /**
     * Minutes the food may spend out of the oven before it stops being what the customer ordered.
     * Null when the server has not told us (which is every case today — see
     * {@link FRESHNESS_BUDGET_MINUTES}), and then the card states the figure without judging it.
     */
    freshnessBudgetMinutes?: number | null;
}

/**
 * A dash, never a zero. The backend returns null when a timing could not be derived, and "0 min"
 * would read as an instant handover — a silently wrong operational number.
 */
function clockOrDash(timestamp: string | null): string {
    return formatBahrainClock(timestamp) ?? '—';
}

/**
 * The card's headline figure: how long the food will have been out of the oven when it arrives,
 * read against the budget the delivery radius was drawn around.
 *
 * Three states, and they must stay three. `unknown` is greyed and says "not known" — never 0, and
 * never a colour, because an absent figure is not a reassuring one. `no-budget` prints the
 * minutes in plain text with no verdict, since without the server's own budget any colour here
 * would be this client's opinion. Only `within`/`over` earn a semantic tone and the bar.
 */
function FreshnessReading({ minutes, budgetMinutes }: {
    minutes: number | null;
    budgetMinutes: number | null;
}): JSX.Element {
    const standing = freshnessStanding(minutes, budgetMinutes);
    const tone = standing === 'unknown'
        ? FADED
        : standing === 'over'
            ? TONE_BAD
            : standing === 'within' ? TONE_OK : '#3b352c';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="caption" sx={{ color: MUTED, whiteSpace: 'nowrap' }}>
                {FRESHNESS_LABEL}
            </Typography>
            {/* The label's immediate next sibling, so the pairing can be asserted rather than the
                mere presence of a number somewhere on the card. */}
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 700, color: tone, whiteSpace: 'nowrap',
                    fontStyle: standing === 'unknown' ? 'italic' : 'normal',
                }}
            >
                {freshnessText(minutes, budgetMinutes)}
            </Typography>
            {minutes !== null && budgetMinutes !== null && budgetMinutes > 0 && (
                <Box
                    data-testid="freshness-bar"
                    sx={{ width: 120, height: 4, borderRadius: 999, backgroundColor: '#f1eae4', mt: 0.5 }}
                >
                    <Box sx={{
                        width: `${freshnessFill(minutes, budgetMinutes) * 100}%`,
                        height: '100%', borderRadius: 999, backgroundColor: tone,
                    }} />
                </Box>
            )}
        </Box>
    );
}

/**
 * A phone number the manager can actually press. Calling is the next action on nearly every card
 * here, and a number that has to be copied out by hand while a delivery is stuck is a number
 * nobody uses.
 *
 * `stopPropagation` because the card itself opens the order: dialling must not also open a dialog
 * behind the call.
 */
function PhoneMetric({ label, phone, absent }: {
    label: string;
    phone: string | null;
    absent: string;
}): JSX.Element {
    return (
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: MUTED }}>{label}</Typography>
            {phone === null ? (
                <Typography variant="caption" sx={{ color: FADED, fontStyle: 'italic' }}>{absent}</Typography>
            ) : (
                <Typography
                    component="a"
                    href={`tel:${phone}`}
                    variant="caption"
                    onClick={(event: React.MouseEvent) => event.stopPropagation()}
                    sx={{ color: brandRed, fontWeight: 700, textDecoration: 'none' }}
                >
                    {phone}
                </Typography>
            )}
        </Box>
    );
}

export function DeliveryBoardPanel({
    couriers,
    awaiting,
    onAssign,
    freshnessBudgetMinutes = FRESHNESS_BUDGET_MINUTES,
}: DeliveryBoardPanelProps): JSX.Element {
    const [cards, setCards] = useState<DeliveryCard[]>([]);
    const [rows, setRows] = useState<CourierBoardRow[]>([]);
    const [openOrderId, setOpenOrderId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Cards first, then couriers — not in parallel — because the second call's annotation depends
     * on whether the opened card is still live. An order concludes and leaves the card list while
     * the board is open; leaving its ranking on screen would answer a question nobody is asking
     * any more, so the dialog closes with it.
     *
     * With nothing open the roster is not fetched at all: every column on it is annotated for one
     * order, so an unannotated copy answers nothing.
     */
    const reload = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const loadedCards = await fetchDeliveryCards();
            const isStillLive = openOrderId !== null
                && loadedCards.some((card) => card.orderId === openOrderId);
            setCards(loadedCards);
            if (isStillLive) {
                setRows(await fetchBoardCouriers(openOrderId));
            } else {
                setRows([]);
                if (openOrderId !== null) setOpenOrderId(null);
            }
        } catch (err) {
            logger.error('Delivery board request failed:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [openOrderId]);

    // Opening a card changes `reload`'s identity, which is what fetches the annotated roster.
    useEffect(() => { void reload(); }, [reload]);

    // The board is the screen a manager stares at while a delivery is stuck, so it cannot be a
    // snapshot. Refetches rather than patching from the frame — half-applied events leave a list
    // that is partly live and partly stale.
    useDeliveryBoardEvents(reload);

    const openCard = cards.find((card) => card.orderId === openOrderId) ?? null;

    return (
        <Box sx={{ mb: 4 }}>
            {error !== null && <PanelNotice tone="error">{error}</PanelNotice>}
            {loading && <CircularProgress size={22} sx={{ mb: 2, color: brandRed }} />}

            <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>Live deliveries</Typography>
            <Typography variant="caption" sx={{ color: MUTED, display: 'block', mb: 1.5 }}>
                Open one to see the order the engine would offer it in.
            </Typography>
            {/* The floor keeps an empty board from collapsing to a single line of text between the
                queue above it and the roster below. */}
            <Box data-testid="live-deliveries-card" sx={{ ...PANEL_CARD_SX, minHeight: PANEL_MIN_HEIGHT }}>
                {cards.length === 0 && !loading && (
                    <EmptyState>Nothing is out for delivery right now.</EmptyState>
                )}
                {/* Rendered in the order the server sent them: it has already sorted on
                    riskMinutes, most at risk first. A chronological list buries the one order that
                    needs attention, and re-sorting here would be a second opinion on a figure the
                    server computed. */}
                {cards.map((card) => (
                    <Box
                        key={card.orderId}
                        data-testid={`delivery-card-${card.orderId}`}
                        onClick={() => setOpenOrderId(card.orderId)}
                        sx={{ ...CLICKABLE_ROW_SX, flexDirection: 'column', alignItems: 'stretch', gap: 0.5 }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                #{card.orderNo ?? card.orderId}
                            </Typography>
                            <Typography variant="body2" sx={{ color: MUTED, flex: 1, minWidth: 0 }}>
                                {card.status}
                            </Typography>
                            {/* The reason the list is in this order, so it is the one figure on the
                                card that gets emphasis — named, in minutes, and against its
                                budget rather than as a bare integer captioned "risk". */}
                            <FreshnessReading
                                minutes={card.riskMinutes}
                                // The card's own budget wins: the server sends it with the
                                // figure, so the two can never disagree. The prop stays as the
                                // fallback for a payload from before the field existed.
                                budgetMinutes={card.freshnessBudgetMinutes ?? freshnessBudgetMinutes}
                            />
                        </Box>

                        <Typography variant="body2" sx={{ color: MUTED }}>
                            {card.branchName ?? '—'} · {card.addressLine ?? 'No address on file'}
                        </Typography>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                            <Metric label="Ready" value={clockOrDash(card.readyAt)} />
                            <Metric label="Handover" value={clockOrDash(card.estimatedHandoverAt)} />
                            <Metric label="At the door" value={clockOrDash(card.estimatedDeliveredAt)} />
                        </Box>

                        {/* Both numbers, because the manager's next action on a stuck delivery is
                            almost always a phone call — and an absent one says so in words rather
                            than showing a blank. */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                            <PhoneMetric label="Customer" phone={card.customerPhone} absent="no number on file" />
                            <PhoneMetric label="Courier" phone={card.courierPhone} absent="not assigned" />
                        </Box>
                    </Box>
                ))}
            </Box>

            {/* The same dialog the waiting-for-a-courier queue opens, carrying the engine's verdict
                for THIS order. Assignment is offered only for an order the server still lists as
                unassigned — `claimForCourier` matches nothing once a rider holds it. */}
            <AssignCourierDialog
                order={openCard}
                couriers={couriers}
                availability={rows}
                availabilityLoading={loading}
                assignable={openCard !== null && awaiting.some((order) => order.orderId === openCard.orderId)}
                onClose={() => setOpenOrderId(null)}
                onAssign={(courierId) => {
                    if (openCard === null) return;
                    setOpenOrderId(null);
                    onAssign(openCard.orderId, courierId);
                }}
            />
        </Box>
    );
}
