import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import {
    cancelOrder, fetchCouriers, fetchCourierOrders, fetchOrderRoute, fetchOrdersAwaitingCourier,
    manualAssign, releaseOrder,
} from '../../../../shared/api/dispatcher';
import { logger } from '../../../../shared/utils/logger';
import { AssignCourierDialog } from './AssignCourierDialog';
import { DeliveryBoardPanel } from './DeliveryBoardPanel';
import { DispatcherOrderActionDialog } from './DispatcherOrderActionDialog';
import type { DispatcherOrderAction } from './DispatcherOrderActionDialog';
import { OrderRouteMap } from './OrderRouteMap';
import { useDeliveryBoardEvents } from '../hooks/useDeliveryBoardEvents';
import { GOOGLE_MAPS_API_KEY } from '../../../branch/utils/mapsConfig';
import { formatBahrainClock } from '../../../../shared/utils/timeUtils';
import type { CourierOrderSummary, CourierStats, OrderRoute, UnassignedOrder } from '../types';
import {
    BRAND_RED as brandRed, CLICKABLE_ROW_SX, CourierStatusChip, EmptyState, PANEL_CARD_SX,
    PanelNotice, ROW_SX, SECTION_TITLE_SX,
} from './dispatcherStyles';

/**
 * The manager dispatcher panel (DELIVERY_SPEC.md §4).
 *
 * A drill-down — couriers → courier's orders → one order's route — because §4 explicitly rules
 * out an all-couriers-at-once map: a live view of every rider is noise, not information.
 *
 * ── On the route map ─────────────────────────────────────────────────────────────────────────
 * §4 named **Mapbox** for the manager side, and that token was never issued (§10) — so the GPS
 * trail printed as a list of raw coordinates, which no manager reconstructs a route from. It is
 * now drawn by {@link OrderRouteMap} on the Google loader this frontend already runs for the
 * branch picker and reverse geocoding, so it needed no new dependency and no new external input.
 * The coordinate list survives underneath as the no-key fallback, exactly as BranchListView does
 * for the branch picker — the drill-down still works with no Maps key configured.
 */
type View =
    | { level: 'couriers' }
    | { level: 'orders'; courier: CourierStats }
    | { level: 'route'; courier: CourierStats; order: CourierOrderSummary };

/**
 * Statuses a delivery order can never leave, mirroring DispatcherService's CONCLUDED_STATUSES
 * plus its already-Cancelled no-op. Release and cancel are hidden on these because the server
 * answers 409 (or does nothing) — offering a button that can only fail is worse than no button.
 */
const CONCLUDED_ORDER_STATUSES = ['Delivered', 'Returned Undelivered', 'Cancelled'];

/** The pending confirmation for a destructive action on one of a courier's orders. */
type PendingOrderAction = { action: DispatcherOrderAction; order: CourierOrderSummary };

export function CourierDispatcherPanel(): JSX.Element {
    const [view, setView] = useState<View>({ level: 'couriers' });
    const [couriers, setCouriers] = useState<CourierStats[]>([]);
    const [awaiting, setAwaiting] = useState<UnassignedOrder[]>([]);
    const [assigning, setAssigning] = useState<UnassignedOrder | null>(null);
    const [orders, setOrders] = useState<CourierOrderSummary[]>([]);
    const [pendingAction, setPendingAction] = useState<PendingOrderAction | null>(null);
    const [route, setRoute] = useState<OrderRoute | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async <T,>(fn: () => Promise<T>, apply: (value: T) => void): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            apply(await fn());
        } catch (err) {
            logger.error('Dispatcher panel request failed:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    // One load() call, not two: `load` clears the error as it starts, so a second sequential
    // call would wipe the first one's failure off the screen.
    const loadCouriersView = useCallback(async (): Promise<void> => {
        await load(
            async () => await Promise.all([fetchCouriers(), fetchOrdersAwaitingCourier()]),
            ([loadedCouriers, loadedAwaiting]) => {
                setCouriers(loadedCouriers);
                setAwaiting(loadedAwaiting);
            }
        );
    }, [load]);

    const reloadCurrentView = useCallback((): void => {
        if (view.level === 'couriers') {
            void loadCouriersView();
        } else if (view.level === 'orders') {
            void load(() => fetchCourierOrders(view.courier.courierId), setOrders);
        } else {
            void load(() => fetchOrderRoute(view.order.orderId), setRoute);
        }
    }, [view, load, loadCouriersView]);

    useEffect(() => { reloadCurrentView(); }, [reloadCurrentView]);

    // Live, not a snapshot: an order that falls out of automatic assignment must appear here on
    // its own. Refetches the view the manager is actually looking at, not always the roster.
    useDeliveryBoardEvents(reloadCurrentView);

    /**
     * §2.3's escape hatch. The conflict cases are the point of the reload: another manager (or a
     * courier finally accepting the offer) can take the order between this list being drawn and
     * the button being pressed, and the server rejects that with a 409 rather than reassigning.
     */
    async function handleAssign(courierId: string): Promise<void> {
        const order = assigning;
        if (order === null) return;
        setAssigning(null);
        // Assign and refresh inside one load() so a 409 stays on screen instead of being cleared
        // by the refetch that follows it.
        await load(
            async () => {
                await manualAssign(order.orderId, courierId);
                return await Promise.all([fetchCouriers(), fetchOrdersAwaitingCourier()]);
            },
            ([loadedCouriers, loadedAwaiting]) => {
                setCouriers(loadedCouriers);
                setAwaiting(loadedAwaiting);
            }
        );
    }

    /**
     * G1: the delivery design keeps saying "the manager sorts it out" — a rider goes dark, a
     * phone dies, a bike breaks — and until now nothing on this screen could take an order back
     * off a courier, so it stayed on them forever.
     *
     * Same one-load() shape as handleAssign, and for the same reason: the order can conclude (or
     * another manager can act on it) between this row being drawn and the button being pressed,
     * and the resulting 409 has to stay on screen instead of being wiped by the refetch.
     */
    async function handleConfirmAction(): Promise<void> {
        const pending = pendingAction;
        if (pending === null || view.level !== 'orders') return;
        const courierId = view.courier.courierId;
        setPendingAction(null);
        await load(
            async () => {
                if (pending.action === 'release') {
                    await releaseOrder(pending.order.orderId);
                } else {
                    await cancelOrder(pending.order.orderId);
                }
                return await fetchCourierOrders(courierId);
            },
            setOrders
        );
    }

    function renderMinutes(value: number | null): string {
        // "—" rather than "0 min": the backend returns null when a timing could not be derived,
        // and showing zero would read as an instant handover (see DispatcherService).
        return value === null ? '—' : `${value} min`;
    }

    return (
        <Box sx={{ p: 3 }}>
            {view.level !== 'couriers' && (
                <Button
                    startIcon={<ArrowBackIosNewIcon fontSize="small" />}
                    onClick={() =>
                        setView(view.level === 'route' ? { level: 'orders', courier: view.courier } : { level: 'couriers' })
                    }
                    sx={{ textTransform: 'none', color: brandRed, mb: 1 }}
                >
                    Back
                </Button>
            )}

            {error !== null && <PanelNotice tone="error">{error}</PanelNotice>}
            {loading && <CircularProgress size={22} sx={{ mb: 2, color: brandRed }} />}

            {view.level === 'couriers' && (
                <>
                    {/* Empty is the normal state — the assignment engine handles the ordinary
                        case, and an order only lands here when every courier refused or none was
                        free. So this block renders only when there is something to act on. */}
                    {awaiting.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>
                                Waiting for a courier
                            </Typography>
                            <Box sx={PANEL_CARD_SX}>
                                {awaiting.map((order) => (
                                    <Box key={order.orderId} sx={ROW_SX}>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                #{order.orderNo ?? order.orderId}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#8a807a' }}>
                                                {order.branchName ?? '—'} · {order.addressLine ?? '—'}
                                            </Typography>
                                        </Box>
                                        {/* The wait is the reason this row exists, so it is the
                                            one number that gets emphasis. */}
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: brandRed, whiteSpace: 'nowrap' }}>
                                            {order.waitingMinutes} min
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={() => setAssigning(order)}
                                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 999,
                                                  backgroundColor: brandRed, boxShadow: 'none',
                                                  '&:hover': { backgroundColor: brandRed, boxShadow: 'none', filter: 'brightness(0.94)' } }}
                                        >
                                            Assign
                                        </Button>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {/* The board proper (DELIVERY_TODO.md): live deliveries linked to the
                        engine's own courier ranking. It answers "why is this order still
                        sitting here"; the roster below it stays the drill-down into one
                        courier's history, which is a different question. */}
                    <DeliveryBoardPanel />

                    <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>Couriers</Typography>
                    <Box sx={PANEL_CARD_SX}>
                        {couriers.length === 0 && !loading && (
                            <EmptyState>No couriers have signed in yet.</EmptyState>
                        )}
                        {couriers.map((courier) => (
                            <Box
                                key={courier.courierId}
                                sx={CLICKABLE_ROW_SX}
                                onClick={() => setView({ level: 'orders', courier })}
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {courier.name ?? courier.courierId}
                                    </Typography>
                                    {/* "Nearest", not "Branch": riders are not assigned to one, this
                                        is the kitchen closest to their last known position. */}
                                    <Typography variant="body2" sx={{ color: '#8a807a' }}>
                                        {courier.nearestBranchName ?? 'Position unknown'}
                                    </Typography>
                                </Box>
                                <CourierStatusChip status={courier.status} />
                                {/* Declined and missed stay separate — see types.ts. Delivered
                                    leads because it is the number a dispatcher trusts. */}
                                <Typography variant="body2" sx={{ color: '#8a807a', whiteSpace: 'nowrap' }}>
                                    {courier.delivered} done · {courier.accepted} taken ·{' '}
                                    {courier.declined} declined · {courier.missed} missed
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                    {!loading && couriers.length === 0 && (
                        <Typography variant="body2" sx={{ color: '#666', mt: 2 }}>No couriers yet.</Typography>
                    )}
                </>
            )}

            {view.level === 'orders' && (
                <>
                    <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>
                        {view.courier.name ?? view.courier.courierId} — orders
                    </Typography>
                    <Box sx={PANEL_CARD_SX}>
                        {!loading && orders.length === 0 && <EmptyState>No orders yet.</EmptyState>}
                        {orders.map((order) => (
                            <Box
                                key={order.orderId}
                                sx={CLICKABLE_ROW_SX}
                                onClick={() => setView({ level: 'route', courier: view.courier, order })}
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        #{order.orderNo ?? order.orderId}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#8a807a' }}>
                                        {order.status}
                                    </Typography>
                                </Box>
                                {/* Wait is time the rider stood at the counter, travel is time on
                                    the road — a dispatcher reads them together or not at all. */}
                                <Typography variant="body2" sx={{ color: '#8a807a', whiteSpace: 'nowrap' }}>
                                    wait {renderMinutes(order.waitTimeMinutes)} · travel {renderMinutes(order.travelTimeMinutes)}
                                </Typography>
                                {order.geofenceWarning === true && (
                                    <Box sx={{ backgroundColor: '#fff6e6', borderRadius: 999, px: 1.25, py: 0.25 }}>
                                        <Typography variant="caption" sx={{ color: '#8a5a00', fontWeight: 700 }}>
                                            Geofence
                                        </Typography>
                                    </Box>
                                )}
                                {/* stopPropagation: the row itself drills into the route, and a
                                    destructive action must not also navigate underneath it. */}
                                {!CONCLUDED_ORDER_STATUSES.includes(order.status) && (
                                    <>
                                        <Button
                                            size="small"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setPendingAction({ action: 'release', order });
                                            }}
                                            sx={{ textTransform: 'none', fontWeight: 700, color: brandRed,
                                                  whiteSpace: 'nowrap' }}
                                        >
                                            Release
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setPendingAction({ action: 'cancel', order });
                                            }}
                                            sx={{ textTransform: 'none', fontWeight: 700, color: '#8a807a',
                                                  whiteSpace: 'nowrap' }}
                                        >
                                            Cancel
                                        </Button>
                                    </>
                                )}
                            </Box>
                        ))}
                    </Box>
                </>
            )}

            <AssignCourierDialog
                order={assigning}
                couriers={couriers}
                onClose={() => setAssigning(null)}
                onAssign={(courierId) => { void handleAssign(courierId); }}
            />

            <DispatcherOrderActionDialog
                action={pendingAction?.action ?? null}
                order={pendingAction?.order ?? null}
                courierName={view.level === 'orders'
                    ? (view.courier.name ?? view.courier.courierId)
                    : 'this courier'}
                onClose={() => setPendingAction(null)}
                onConfirm={() => { void handleConfirmAction(); }}
            />

            {view.level === 'route' && route !== null && (
                <>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Order #{route.orderNo ?? route.orderId}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 4, mb: 3 }}>
                        <Box><Typography variant="caption">Wait</Typography>
                            <Typography>{renderMinutes(route.waitTimeMinutes)}</Typography></Box>
                        <Box><Typography variant="caption">Travel</Typography>
                            <Typography>{renderMinutes(route.travelTimeMinutes)}</Typography></Box>
                        <Box><Typography variant="caption">At the door</Typography>
                            <Typography>{renderMinutes(route.serviceTimeMinutes)}</Typography></Box>
                    </Box>

                    {route.geofenceWarning === true && (
                        <PanelNotice tone="info">
                            Drop-off logged {Math.round(route.geofenceDistanceM ?? 0)} m from the customer's pin.
                        </PanelNotice>
                    )}

                    <Typography variant="subtitle1" sx={SECTION_TITLE_SX}>
                        Route ({route.points.length} points)
                    </Typography>
                    {/* No key configured means no map at all — the list is the fallback, not a
                        degraded mode, so the drill-down keeps working either way. */}
                    {GOOGLE_MAPS_API_KEY ? (
                        <OrderRouteMap route={route} />
                    ) : (
                        <Box sx={{ ...PANEL_CARD_SX, maxHeight: 360, overflowY: 'auto' }}>
                            {route.points.length === 0 && (
                                <EmptyState>No GPS samples recorded for this order.</EmptyState>
                            )}
                            {route.points.map((point, index) => (
                                <Box key={index} sx={ROW_SX}>
                                    {/* recordedAt is a UTC instant with a `Z`, unlike the naive
                                        Bahrain-local stamps elsewhere in delivery. formatBahrainClock
                                        parses through toEpochMsBahrain, which detects that offset
                                        instead of appending one, so the time is not shifted by three
                                        hours — and a wall clock beats an ISO string for a human. */}
                                    <Typography variant="body2" sx={{ flex: 1, color: '#3b352c' }}>
                                        {formatBahrainClock(point.recordedAt) ?? '—'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#8a807a', whiteSpace: 'nowrap' }}>
                                        {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
}
