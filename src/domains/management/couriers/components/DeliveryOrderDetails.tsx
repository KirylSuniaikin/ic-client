import React from 'react';
import { Box, Chip, Divider, Typography } from '@mui/material';
import type { DeliveryCard } from '../types';
import {
    clockOrDash, FADED, FreshnessReading, INK, Metric, MUTED, PhoneMetric, SECTION_TITLE_SX,
} from './dispatcherStyles';

/**
 * The order, as the dispatcher needs it when they open a card.
 *
 * <p>The popup used to lead with the assignment engine's verdict — which rider was ranked where,
 * and why the rest got no offer. That is the right content for the screen where a manager is
 * *choosing* a rider, and the wrong content everywhere else: for a delivery already in flight the
 * decision has been made, and re-litigating it answers a question nobody asked. What the
 * dispatcher actually does with an open card is pick up the phone.
 *
 * <p>So the order comes first and the verdict stays behind {@code assignable}. Everything here is
 * addressed to one of two calls:
 *
 * <ul>
 *   <li><b>the customer</b> — their name to greet them by, their number to reach them on, the
 *       address the food is going to, and what they ordered, so "is this the two pepperonis?" can
 *       be answered without opening a second screen;</li>
 *   <li><b>the rider</b> — their number, and the three timings that say whether the delay is the
 *       kitchen's or the road's.</li>
 * </ul>
 *
 * <p>Absent values are named rather than blanked. "no number on file" is a fact a dispatcher can
 * act on; an empty space next to a label is one they have to go and check.
 */
export interface DeliveryOrderDetailsProps {
    card: DeliveryCard;
    /** The board's fallback budget, used only for a payload predating the card's own field. */
    freshnessBudgetMinutes: number | null;
}

export function DeliveryOrderDetails({
    card,
    freshnessBudgetMinutes,
}: DeliveryOrderDetailsProps): JSX.Element {
    return (
        <Box data-testid="delivery-order-details">
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                <Chip size="small" label={card.status} sx={{ fontWeight: 700 }} />
                <Box sx={{ flex: 1 }} />
                <FreshnessReading
                    minutes={card.riskMinutes}
                    budgetMinutes={card.freshnessBudgetMinutes ?? freshnessBudgetMinutes}
                />
            </Box>

            <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 0.5 }}>
                Customer
            </Typography>
            <Typography variant="body2" sx={{ color: INK, fontWeight: 600 }}>
                {card.customerName ?? 'No name on file'}
            </Typography>
            <Typography variant="body2" sx={{ color: MUTED, mb: 0.75 }}>
                {card.addressLine ?? 'No address on file'}
            </Typography>
            <PhoneMetric label="Phone" phone={card.customerPhone} absent="no number on file" />

            <Divider sx={{ my: 1.75 }} />

            <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 0.5 }}>
                Courier
            </Typography>
            <PhoneMetric label="Phone" phone={card.courierPhone} absent="not assigned" />

            <Divider sx={{ my: 1.75 }} />

            {/* Three stamps, not one: they are what separate "the kitchen is slow" from "the rider
                is slow", which is the only diagnosis this popup can offer and the one that decides
                which of the two numbers above gets dialled. */}
            <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 0.75 }}>
                Timings — from {card.branchName ?? 'an unknown branch'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <Metric label="Ready" value={clockOrDash(card.readyAt)} />
                <Metric label="Handover" value={clockOrDash(card.estimatedHandoverAt)} />
                <Metric label="At the door" value={clockOrDash(card.estimatedDeliveredAt)} />
            </Box>

            <Divider sx={{ my: 1.75 }} />

            <Typography variant="subtitle2" sx={{ ...SECTION_TITLE_SX, mb: 0.75 }}>
                In the order
            </Typography>
            {card.items.length === 0 ? (
                <Typography variant="body2" sx={{ color: FADED, fontStyle: 'italic' }}>
                    No items on file
                </Typography>
            ) : (
                card.items.map((item, index) => (
                    <Box
                        // Index, deliberately: order lines have no client-visible id, and two
                        // identical lines are a real possibility on one order.
                        key={`${item.name ?? 'item'}-${index}`}
                        sx={{ display: 'flex', gap: 1, alignItems: 'baseline', py: 0.25 }}
                    >
                        <Typography variant="body2" sx={{ color: MUTED, minWidth: 24 }}>
                            {item.quantity ?? 1}×
                        </Typography>
                        <Typography variant="body2" sx={{ color: INK }}>
                            {item.name ?? 'Item no longer on the menu'}
                        </Typography>
                    </Box>
                ))
            )}
        </Box>
    );
}
