import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
    Button, CircularProgress, Alert, Chip,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import {
    fetchCouriers, fetchCourierOrders, fetchOrderRoute, fetchOrdersAwaitingCourier, manualAssign,
} from '../../../../shared/api/dispatcher';
import { logger } from '../../../../shared/utils/logger';
import { AssignCourierDialog } from './AssignCourierDialog';
import type { CourierOrderSummary, CourierStats, OrderRoute, UnassignedOrder } from '../types';

const brandRed = '#E44B4C';

/**
 * The manager dispatcher panel (DELIVERY_SPEC.md §4).
 *
 * A drill-down — couriers → courier's orders → one order's route — because §4 explicitly rules
 * out an all-couriers-at-once map: a live view of every rider is noise, not information.
 *
 * ── On the route map ─────────────────────────────────────────────────────────────────────────
 * §4 specifies **Mapbox** for the manager side (client side stays Google). The Mapbox token is
 * still an open external input (§10), so the GPS trail renders as an ordered point list for now.
 * The backend already serves every point plus the customer's pin as `destination`, so dropping a
 * map in over the same data is additive — nothing else on this screen changes.
 */
type View =
    | { level: 'couriers' }
    | { level: 'orders'; courier: CourierStats }
    | { level: 'route'; courier: CourierStats; order: CourierOrderSummary };

export function CourierDispatcherPanel(): JSX.Element {
    const [view, setView] = useState<View>({ level: 'couriers' });
    const [couriers, setCouriers] = useState<CourierStats[]>([]);
    const [awaiting, setAwaiting] = useState<UnassignedOrder[]>([]);
    const [assigning, setAssigning] = useState<UnassignedOrder | null>(null);
    const [orders, setOrders] = useState<CourierOrderSummary[]>([]);
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

    useEffect(() => {
        if (view.level === 'couriers') {
            void loadCouriersView();
        } else if (view.level === 'orders') {
            void load(() => fetchCourierOrders(view.courier.courierId), setOrders);
        } else {
            void load(() => fetchOrderRoute(view.order.orderId), setRoute);
        }
    }, [view, load, loadCouriersView]);

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

            {error !== null && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {loading && <CircularProgress size={22} sx={{ mb: 2 }} />}

            {view.level === 'couriers' && (
                <>
                    {/* Empty is the normal state — the assignment engine handles the ordinary
                        case, and an order only lands here when every courier refused or none was
                        free. So this block renders only when there is something to act on. */}
                    {awaiting.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1 }}>Waiting for a courier</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Order</TableCell>
                                        <TableCell>Branch</TableCell>
                                        <TableCell>Address</TableCell>
                                        <TableCell align="right">Waiting</TableCell>
                                        <TableCell align="right"></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {awaiting.map((order) => (
                                        <TableRow key={order.orderId}>
                                            <TableCell>#{order.orderNo ?? order.orderId}</TableCell>
                                            <TableCell>{order.branchName ?? '—'}</TableCell>
                                            <TableCell>{order.addressLine ?? '—'}</TableCell>
                                            <TableCell align="right">{order.waitingMinutes} min</TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => setAssigning(order)}
                                                    sx={{ textTransform: 'none', color: brandRed, borderColor: brandRed }}
                                                >
                                                    Assign
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    )}

                    <Typography variant="h6" sx={{ mb: 2 }}>Couriers</Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Courier</TableCell>
                                <TableCell>Status</TableCell>
                                {/* "Nearest", not "Branch": riders are not assigned to one, this
                                    is the kitchen closest to their last known position. */}
                                <TableCell>Nearest</TableCell>
                                <TableCell align="right">Accepted</TableCell>
                                {/* Declined and missed are separate columns on purpose — see types.ts. */}
                                <TableCell align="right">Declined</TableCell>
                                <TableCell align="right">No answer</TableCell>
                                <TableCell align="right">Delivered</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {couriers.map((courier) => (
                                <TableRow
                                    key={courier.courierId}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => setView({ level: 'orders', courier })}
                                >
                                    <TableCell>{courier.name ?? courier.courierId}</TableCell>
                                    <TableCell><Chip size="small" label={courier.status} /></TableCell>
                                    <TableCell>{courier.nearestBranchName ?? '—'}</TableCell>
                                    <TableCell align="right">{courier.accepted}</TableCell>
                                    <TableCell align="right">{courier.declined}</TableCell>
                                    <TableCell align="right">{courier.missed}</TableCell>
                                    <TableCell align="right">{courier.delivered}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {!loading && couriers.length === 0 && (
                        <Typography variant="body2" sx={{ color: '#666', mt: 2 }}>No couriers yet.</Typography>
                    )}
                </>
            )}

            {view.level === 'orders' && (
                <>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        {view.courier.name ?? view.courier.courierId} — orders
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Order</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Wait</TableCell>
                                <TableCell align="right">Travel</TableCell>
                                <TableCell>Flag</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow
                                    key={order.orderId}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => setView({ level: 'route', courier: view.courier, order })}
                                >
                                    <TableCell>#{order.orderNo ?? order.orderId}</TableCell>
                                    <TableCell>{order.status}</TableCell>
                                    <TableCell align="right">{renderMinutes(order.waitTimeMinutes)}</TableCell>
                                    <TableCell align="right">{renderMinutes(order.travelTimeMinutes)}</TableCell>
                                    <TableCell>
                                        {order.geofenceWarning === true && (
                                            <Chip size="small" color="warning" label="Geofence" />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {!loading && orders.length === 0 && (
                        <Typography variant="body2" sx={{ color: '#666', mt: 2 }}>No orders yet.</Typography>
                    )}
                </>
            )}

            <AssignCourierDialog
                order={assigning}
                couriers={couriers}
                onClose={() => setAssigning(null)}
                onAssign={(courierId) => { void handleAssign(courierId); }}
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
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Drop-off logged {Math.round(route.geofenceDistanceM ?? 0)} m from the customer's pin.
                        </Alert>
                    )}

                    {/* Mapbox goes here once the token exists (§10). Until then the trail is a
                        list — the data is identical, only the rendering waits. */}
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Route ({route.points.length} points)
                    </Typography>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Recorded</TableCell>
                                <TableCell align="right">Latitude</TableCell>
                                <TableCell align="right">Longitude</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {route.points.map((point, index) => (
                                <TableRow key={index}>
                                    <TableCell>{point.recordedAt ?? '—'}</TableCell>
                                    <TableCell align="right">{point.latitude.toFixed(5)}</TableCell>
                                    <TableCell align="right">{point.longitude.toFixed(5)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {route.points.length === 0 && (
                        <Typography variant="body2" sx={{ color: '#666', mt: 2 }}>
                            No GPS samples recorded for this order.
                        </Typography>
                    )}
                </>
            )}
        </Box>
    );
}
