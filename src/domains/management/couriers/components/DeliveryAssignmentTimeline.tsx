import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { fetchOrderAssignmentAudit } from '../../../../shared/api/dispatcher';
import { labelOf } from '../../../../shared/utils/labelOf';
import { logger } from '../../../../shared/utils/logger';
import { formatBahrainDateTime, toEpochMsBahrain } from '../../../../shared/utils/timeUtils';
import { BRAND_RED, EmptyState, INK, MUTED, PANEL_CARD_SX, PanelNotice, clockOrDash } from './dispatcherStyles';
import type {
    AssignmentAuditCause,
    DeliveryAssignmentAudit,
    DeliveryAssignmentAuditEntry,
    DeliveryPartStage,
} from '../types';

const CAUSE_LABELS: Record<AssignmentAuditCause, string> = {
    OFFER_ACCEPTED: 'Accepted the offer',
    PRE_ASSIGNMENT_ACCEPTED: 'Accepted a pre-assignment',
    AUTO_ACCEPTED: 'Auto-accepted',
    MANUAL_ASSIGN: 'Manual assignment',
    MANUAL_RELEASE: 'Released by hand',
    RESERVATION_DROPPED_AT_READY: 'Reservation dropped at Ready',
    ORDER_CANCELLED: 'Order cancelled',
    RETURNED_BY_COURIER: 'Rider brought it back',
    MANUAL_CANCEL: 'Cancelled by hand',
};

const STAGE_LABELS: Record<DeliveryPartStage, string> = {
    AWAITING_COURIER: 'Awaiting courier',
    GOING_TO_KITCHEN: 'Going to kitchen',
    AT_KITCHEN: 'At kitchen',
    ON_THE_ROAD: 'On the road',
    DELIVERED: 'Delivered',
};

function riderName(entry: DeliveryAssignmentAuditEntry): string {
    return entry.courierName ?? 'an unknown rider';
}

/**
 * The action as a dispatcher would say it. The server has no atomic reassign, so an ASSIGNED that
 * follows an UNASSIGNED on the same part IS the reassignment and is named so — otherwise a handover
 * between two riders reads as two unrelated events.
 */
export function describeAction(entry: DeliveryAssignmentAuditEntry, previousOnPart: DeliveryAssignmentAuditEntry | null): string {
    switch (entry.action) {
        case 'ASSIGNED':
            return previousOnPart?.action === 'UNASSIGNED'
                ? `Reassigned to ${riderName(entry)}`
                : `Assigned to ${riderName(entry)}`;
        case 'UNASSIGNED':
            return `Unassigned from ${riderName(entry)}`;
        case 'RETURNED_UNDELIVERED':
            return 'Returned undelivered';
        case 'CANCELLED':
            return 'Cancelled';
        default:
            return entry.action;
    }
}

/** Who did it. SYSTEM is the engine or a timeout acting on its own, and says so. */
export function describeActor(entry: DeliveryAssignmentAuditEntry): string {
    switch (entry.actorType) {
        case 'STAFF':
            return `by ${entry.actorName ?? 'a staff member no longer on the roster'}`;
        case 'COURIER':
            return `by ${entry.actorName ?? entry.courierName ?? 'an unknown rider'} (rider)`;
        case 'SYSTEM':
            return 'automatically';
        default:
            return '';
    }
}

/** "Part 2/3 · " on a split order, nothing on a single-part one. */
function partPrefix(entry: DeliveryAssignmentAuditEntry): string {
    return entry.partIndex !== null && entry.partsTotal !== null && entry.partsTotal > 1
        ? `Part ${entry.partIndex}/${entry.partsTotal} · `
        : '';
}

type Line = { entry: DeliveryAssignmentAuditEntry; previousOnPart: DeliveryAssignmentAuditEntry | null };

/** Pairs each entry with the one before it on the same part, which is what reassign detection reads. */
function toLines(entries: DeliveryAssignmentAuditEntry[]): Line[] {
    const lastByPart = new Map<number, DeliveryAssignmentAuditEntry>();
    return entries.map((entry) => {
        const previousOnPart = entry.partId === null ? null : lastByPart.get(entry.partId) ?? null;
        if (entry.partId !== null) lastByPart.set(entry.partId, entry);
        return { entry, previousOnPart };
    });
}

/** True when the order predates the audit trail, so its history may be missing early changes. */
function predatesRecording(audit: DeliveryAssignmentAudit): boolean {
    return audit.orderCreatedAt !== null
        && toEpochMsBahrain(audit.orderCreatedAt) < toEpochMsBahrain(audit.dataSince);
}

type Props = {
    orderId: number;
};

/**
 * Who assigned, unassigned, returned or cancelled this order, when, and from what state (M6).
 *
 * The question it answers is the one a dispatcher asks when a customer calls about a late order:
 * did anyone touch this, and was it a person or the engine. Offers and declines are deliberately
 * not here — they live in the engine's verdict and the skip-reason report — so this stays the
 * short list of changes that actually moved the order between riders.
 */
export function DeliveryAssignmentTimeline({ orderId }: Props): JSX.Element {
    const [audit, setAudit] = useState<DeliveryAssignmentAudit | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        // Another order opened while this one loads must not get this order's history.
        let current = true;
        setAudit(null);
        setFailed(false);
        fetchOrderAssignmentAudit(orderId)
            .then((loaded) => {
                if (current) setAudit(loaded);
            })
            .catch((err: unknown) => {
                if (!current) return;
                logger.error('Assignment history request failed:', err);
                setFailed(true);
            });
        return () => {
            current = false;
        };
    }, [orderId]);

    if (failed) {
        return <PanelNotice tone="error">Could not load the assignment history.</PanelNotice>;
    }
    if (audit === null) {
        return <CircularProgress size={18} sx={{ color: BRAND_RED }} data-testid="assignment-timeline-loading" />;
    }

    return (
        <Box data-testid="assignment-timeline">
            {predatesRecording(audit) && (
                <Typography data-testid="assignment-timeline-since" variant="caption"
                            sx={{ color: MUTED, display: 'block', mb: 1, fontStyle: 'italic' }}>
                    History recorded from {formatBahrainDateTime(audit.dataSince) ?? audit.dataSince}
                </Typography>
            )}
            <Box sx={PANEL_CARD_SX}>
                {audit.entries.length === 0 ? (
                    <EmptyState>No assignment changes recorded</EmptyState>
                ) : (
                    toLines(audit.entries).map(({ entry, previousOnPart }) => (
                        <Box
                            key={entry.id}
                            data-testid={`assignment-entry-${entry.id}`}
                            sx={{
                                display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.25,
                                borderBottom: '1px solid #f6f1ec', '&:last-of-type': { borderBottom: 'none' },
                            }}
                        >
                            <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700, minWidth: 40, pt: 0.25 }}>
                                {clockOrDash(entry.occurredAt)}
                            </Typography>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ color: INK, fontWeight: 600 }}
                                            data-testid={`assignment-entry-${entry.id}-action`}>
                                    {partPrefix(entry)}{describeAction(entry, previousOnPart)}
                                </Typography>
                                <Typography variant="caption" sx={{ color: MUTED, display: 'block' }}
                                            data-testid={`assignment-entry-${entry.id}-detail`}>
                                    {describeActor(entry)} · {labelOf(CAUSE_LABELS, entry.cause)}
                                </Typography>
                            </Box>
                            {entry.fromStage !== null && (
                                <Box
                                    title="Where the order stood just before this change"
                                    data-testid={`assignment-entry-${entry.id}-stage`}
                                    sx={{ backgroundColor: '#f4f1ea', borderRadius: 999, px: 1.25, py: 0.25, flexShrink: 0 }}
                                >
                                    <Typography variant="caption" sx={{ color: '#6b635b', fontWeight: 700 }}>
                                        was {labelOf(STAGE_LABELS, entry.fromStage)}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ))
                )}
            </Box>
        </Box>
    );
}
