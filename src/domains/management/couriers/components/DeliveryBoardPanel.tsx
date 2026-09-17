import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { fetchBoardCouriers, fetchDeliveryCards } from '../../../../shared/api/dispatcher';
import { logger } from '../../../../shared/utils/logger';
import { useDeliveryBoardEvents } from '../hooks/useDeliveryBoardEvents';
import type {
    CourierBoardRow, CourierStats, DeliveryCard, ManualAssignResult, UnassignedOrder,
} from '../types';
import { FRESHNESS_BUDGET_MINUTES } from '../utils/freshness';
import { AssignCourierDialog } from './AssignCourierDialog';
import {
    BRAND_RED as brandRed, CLICKABLE_ROW_SX, clockOrDash, EmptyState, FADED, Metric,
    MUTED, PANEL_CARD_SX, PANEL_MIN_HEIGHT, PanelNotice, PhoneMetric, SECTION_TITLE_SX,
} from './dispatcherStyles';
import { CircularTimer } from '../../../../shared/components/CircularTimer';
import { usePreciseCountdown } from '../../../../shared/hooks/usePreciseCountdown';
import { toEpochMsBahrain } from '../../../../shared/utils/timeUtils';

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
    /**
     * Server-authoritative two-step (courier-capacity, task-spec.md §5): the parent's own
     * `manualAssign` wrapper, awaited by this panel's dialog wiring below. Returns the result
     * rather than firing and forgetting, so an `assigned: false` warning can keep the popup open
     * instead of this panel closing it out from under the dialog.
     */
    onAssign: (orderId: number, courierId: string, acknowledgeOverCapacity: boolean) => Promise<ManualAssignResult>;
    /**
     * Minutes the food may spend out of the oven before it stops being what the customer ordered.
     * Null when the server has not told us (which is every case today — see
     * {@link FRESHNESS_BUDGET_MINUTES}), and then the card states the figure without judging it.
     */
    freshnessBudgetMinutes?: number | null;
}

/**
 * One live delivery, with a countdown to the moment it becomes a problem.
 *
 * <p>The card used to lead with how old the food would be on arrival — a real figure, but one a
 * manager has to read against a budget before it means anything, and the budget had to be sent
 * alongside it for that reason. What a dispatcher scanning a board wants is how long is left,
 * which is the question the kitchen card already answers with a ring; this is the same ring, over
 * the whole promised journey rather than the kitchen half of it.
 *
 * <p>Its own component because of the countdown: a hook cannot be called inside a `.map`, and a
 * single timer at panel level would have to re-render every card on every tick to move one.
 *
 * <p>The food-age figure has not been deleted — it moved into the popup this card opens, where
 * there is room to read it against its budget. Card answers "how urgent"; popup answers "why".
 */
function DeliveryCardRow({ card, onOpen }: {
    card: DeliveryCard;
    onOpen: () => void;
}): JSX.Element {
    // Zero when there is no promise, which the timer below never reads — it renders a dash
    // instead. toEpochMsBahrain would answer `Date.now()` for a null, i.e. "due this instant".
    const deadlineMs = card.promisedAt === null ? 0 : toEpochMsBahrain(card.promisedAt);
    const msLeft = usePreciseCountdown(deadlineMs, 1000);

    return (
        <Box
            data-testid={`delivery-card-${card.orderId}`}
            onClick={onOpen}
            sx={{ ...CLICKABLE_ROW_SX, flexDirection: 'column', alignItems: 'stretch', gap: 0.5 }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    #{card.orderNo ?? card.orderId}
                </Typography>
                <Typography variant="body2" sx={{ color: MUTED, flex: 1, minWidth: 0 }}>
                    {card.status}
                </Typography>
                {card.promisedAt === null || card.promisedTotalMinutes === null ? (
                    // An order from before the road quote existed has no promise and never can.
                    // Saying so beats a ring drawn against a number nobody recorded.
                    <Typography
                        data-testid={`delivery-card-${card.orderId}-no-deadline`}
                        variant="caption"
                        sx={{ color: FADED, fontStyle: 'italic', whiteSpace: 'nowrap' }}
                    >
                        no promised time
                    </Typography>
                ) : (
                    <CircularTimer
                        timeLeft={Math.ceil(msLeft / 1000)}
                        totalSec={card.promisedTotalMinutes * 60}
                        size={56}
                    />
                )}
            </Box>

            <Typography variant="body2" sx={{ color: MUTED }}>
                {card.branchName ?? '—'} · {card.addressLine ?? 'No address on file'}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <Metric label="Ready" value={clockOrDash(card.readyAt)} />
                <Metric label="Handover" value={clockOrDash(card.estimatedHandoverAt)} />
                <Metric label="At the door" value={clockOrDash(card.estimatedDeliveredAt)} />
            </Box>

            {/* Both numbers, because the manager's next action on a stuck delivery is almost
                always a phone call — and an absent one says so in words rather than showing a
                blank. */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <PhoneMetric label="Customer" phone={card.customerPhone} absent="no number on file" />
                <PhoneMetric label="Courier" phone={card.courierPhone} absent="not assigned" />
            </Box>
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
                Open one to see the order, both phone numbers and where the time is going.
            </Typography>
            {/* The floor keeps an empty board from collapsing to a single line of text between the
                queue above it and the roster below. */}
            <Box data-testid="live-deliveries-card" sx={{ ...PANEL_CARD_SX, minHeight: PANEL_MIN_HEIGHT }}>
                {cards.length === 0 && !loading && (
                    <EmptyState>Nothing is out for delivery right now.</EmptyState>
                )}
                {/* Rendered in the order the server sent them: it has already sorted on the
                    promised deadline, soonest first. A chronological list buries the one order
                    that needs attention, and re-sorting here would be a second opinion on a figure
                    the server computed. */}
                {cards.map((card) => (
                    <DeliveryCardRow
                        key={card.orderId}
                        card={card}
                        onOpen={() => setOpenOrderId(card.orderId)}
                    />
                ))}
            </Box>

            {/* The same dialog the waiting-for-a-courier queue opens — but given the whole card, so
                it leads with the order rather than with the engine's ranking. Assignment, and the
                ranking that explains it, are offered only for an order the server still lists as
                unassigned: `claimForCourier` matches nothing once a rider holds it. */}
            <AssignCourierDialog
                order={openCard}
                card={openCard}
                freshnessBudgetMinutes={freshnessBudgetMinutes}
                couriers={couriers}
                availability={rows}
                availabilityLoading={loading}
                assignable={openCard !== null && awaiting.some((order) => order.orderId === openCard.orderId)}
                onClose={() => setOpenOrderId(null)}
                onAssign={(courierId, acknowledgeOverCapacity) => {
                    if (openCard === null) return Promise.resolve({ assigned: false, warning: null });
                    return onAssign(openCard.orderId, courierId, acknowledgeOverCapacity)
                        .then((result) => {
                            if (result.assigned) setOpenOrderId(null);
                            return result;
                        })
                        .catch((): ManualAssignResult => {
                            // Fulfils AssignCourierDialog's "never rejects" contract. The parent's
                            // own `handleAssign` has already logged this and surfaced it via
                            // `setError` — this popup's own job is to close rather than sit open
                            // over an order that may have already moved (Issue 1, review
                            // iteration 1).
                            setOpenOrderId(null);
                            return { assigned: false, warning: null };
                        });
                }}
            />
        </Box>
    );
}
