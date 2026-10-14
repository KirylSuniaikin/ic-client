import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import {
    GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, LIGHT_MAP_STYLES,
} from '../../../branch/utils/mapsConfig';
import { formatBahrainClock } from '../../../../shared/utils/timeUtils';
import type { CourierRoutePoint, OrderRoute } from '../types';
import { BRAND_RED, EmptyState } from './dispatcherStyles';

/**
 * The GPS trail of one delivery, drawn (DELIVERY_SPEC.md §4).
 *
 * Replaces the ordered list of raw coordinates the drill-down used to print: nobody
 * reconstructs a route from numbers, and the question this view answers — where did the rider
 * actually go, and where did they stop — is a spatial one.
 *
 * §4 originally named Mapbox for the manager side, which left this blocked on a token that was
 * never issued. Google is already loaded on this frontend (BranchMapView, useReverseGeocode)
 * behind the same key, so the map costs no new dependency and no new external input.
 *
 * Only ever mounted when GOOGLE_MAPS_API_KEY is truthy — the caller keeps the coordinate list as
 * the no-key fallback, exactly as BranchPickerDrawer keeps BranchListView.
 */

const MAP_HEIGHT = 360;

/** Keeps the fitted trail off the edges of the frame. */
const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

/** A single position collapses the bounds to a point and fitBounds zooms to maximum, which reads
 * as a broken map rather than a location. Same guard BranchMapView applies to a lone branch. */
const MAX_SINGLE_POINT_ZOOM = 16;

const TRAIL_COLOR = BRAND_RED;
const START_COLOR = '#3b352c';
const DESTINATION_COLOR = '#1a73e8';
/** Green, so the hand-over reads as the moment the run began rather than as another fix. */
const PICKUP_COLOR = '#2e7d32';
/** Amber, matching the geofence chip on the orders list — recorded, never an error state. */
const GEOFENCE_COLOR = '#8a5a00';

type LatLng = { lat: number; lng: number };

function toLatLng(point: CourierRoutePoint): LatLng {
    return { lat: point.latitude, lng: point.longitude };
}

/**
 * `recordedAt` on a route point is a UTC instant carrying a `Z`, unlike every other delivery
 * timestamp (naive Bahrain-local). toEpochMsBahrain — which formatBahrainClock parses through —
 * detects the offset and does NOT append one, so the same helper is correct for both and the
 * trail cannot end up three hours out.
 */
function clockOf(point: CourierRoutePoint): string {
    return formatBahrainClock(point.recordedAt) ?? '—';
}

/** Anything the cleanup has to detach: a Marker and a Polyline are both this much of a map overlay. */
type MapOverlay = { setMap: (map: google.maps.Map | null) => void };

function dot(color: string, scale: number): google.maps.Symbol {
    return {
        path: google.maps.SymbolPath.CIRCLE,
        scale,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
    };
}

export function OrderRouteMap({ route }: { route: OrderRoute }): JSX.Element {
    // Identical option set to BranchMapView and useReverseGeocode. useJsApiLoader is a singleton:
    // a second caller passing a different shape warns and can refuse to load for everyone.
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? '',
        ...(GOOGLE_MAPS_MAP_ID ? { mapIds: [GOOGLE_MAPS_MAP_ID] } : {}),
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);

    const points = route.points;
    const destination = route.destination;
    const pickup = route.pickup;
    const path = useMemo(() => points.map(toLatLng), [points]);

    const fitToRoute = useCallback(
        (target: google.maps.Map) => {
            // The pickup is deliberately NOT added here: the server picks it as the sample
            // closest in time to the hand-over, so it is one of `points` already and extending
            // the bounds with it a second time would change nothing.
            const positions = destination === null ? path : [...path, toLatLng(destination)];
            if (positions.length === 0) return;

            const bounds = new google.maps.LatLngBounds();
            for (const position of positions) bounds.extend(position);
            target.fitBounds(bounds, BOUNDS_PADDING);

            if (positions.length === 1) {
                const zoom = target.getZoom();
                if (zoom !== undefined && zoom > MAX_SINGLE_POINT_ZOOM) {
                    target.setZoom(MAX_SINGLE_POINT_ZOOM);
                }
            }
        },
        [path, destination]
    );

    // Not in `onLoad`, and deliberately not `center`/`zoom` props: the first is measured against a
    // container that has not been laid out yet, the second would re-centre on every render and
    // make panning impossible. Same shape as BranchMapView.
    useEffect(() => {
        if (map === null) return;

        fitToRoute(map);
        const listener = google.maps.event.addListenerOnce(map, 'idle', () => fitToRoute(map));
        return () => google.maps.event.removeListener(listener);
    }, [map, fitToRoute]);

    /**
     * Every overlay is created imperatively against the instance `onLoad` handed us, NOT as
     * <Marker>/<Polyline> children of <GoogleMap>.
     *
     * Those components read the map out of context once, in componentDidMount, and never
     * re-attach. Under React 18 StrictMode the tree mounts twice in development and <GoogleMap>
     * builds a SECOND google.maps.Map along the way, so children bound to the first, discarded
     * map are invisible while the map on screen is the second — a working map with nothing drawn
     * on it, in dev only. This already cost one debugging session on BranchMapView.
     */
    useEffect(() => {
        if (map === null) return;

        const overlays: MapOverlay[] = [];

        // A one-point trail has no line to draw; the marker below is the whole story.
        if (path.length > 1) {
            overlays.push(
                new google.maps.Polyline({
                    path,
                    map,
                    geodesic: true,
                    strokeColor: TRAIL_COLOR,
                    strokeOpacity: 0.85,
                    strokeWeight: 4,
                })
            );
        }

        const first = points.at(0);
        const last = points.at(-1);

        if (first !== undefined && last !== undefined) {
            if (points.length === 1) {
                // One fix is not a trail, and labelling it "start" would imply a missing end.
                overlays.push(new google.maps.Marker({
                    position: toLatLng(first),
                    map,
                    title: `Only recorded fix · ${clockOf(first)}`,
                    icon: dot(START_COLOR, 7),
                }));
            } else {
                overlays.push(new google.maps.Marker({
                    position: toLatLng(first),
                    map,
                    title: `First fix · ${clockOf(first)}`,
                    icon: dot(START_COLOR, 6),
                }));
                overlays.push(new google.maps.Marker({
                    position: toLatLng(last),
                    map,
                    title: `Drop-off · ${clockOf(last)}`,
                    icon: dot(TRAIL_COLOR, 8),
                }));
            }
        }

        /**
         * The hand-over, which is the one thing the trail cannot show on its own: the drive to the
         * kitchen and the drive to the customer are a single unbroken line, and this is the join
         * between them. Drawn larger than the first fix so it is not read as another breadcrumb.
         *
         * Which sample it is, is the server's call (DispatcherService.pickupPoint), not the map's
         * — otherwise the marker would mean one thing here and another anywhere else the route is
         * later drawn.
         */
        if (pickup !== null) {
            overlays.push(new google.maps.Marker({
                position: toLatLng(pickup),
                map,
                title: `Picked up · ${clockOf(pickup)}`,
                icon: dot(PICKUP_COLOR, 8),
            }));
        }

        if (destination !== null) {
            overlays.push(new google.maps.Marker({
                position: toLatLng(destination),
                map,
                title: "Customer's pin",
                icon: dot(DESTINATION_COLOR, 8),
            }));

            // The gap the manager is investigating, drawn as the gap it is. Only when the server
            // already flagged it — a connector on every order would just be a second line.
            if (route.geofenceWarning === true && last !== undefined) {
                overlays.push(
                    new google.maps.Polyline({
                        path: [toLatLng(last), toLatLng(destination)],
                        map,
                        strokeOpacity: 0, // the dash pattern below is the only stroke that paints
                        strokeColor: GEOFENCE_COLOR,
                        icons: [{
                            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: GEOFENCE_COLOR, scale: 3 },
                            offset: '0',
                            repeat: '12px',
                        }],
                    })
                );
            }
        }

        return () => {
            for (const overlay of overlays) {
                google.maps.event.clearInstanceListeners(overlay);
                overlay.setMap(null);
            }
        };
    }, [map, path, points, destination, pickup, route.geofenceWarning]);

    const handleLoad = useCallback((loaded: google.maps.Map) => setMap(loaded), []);
    const handleUnmount = useCallback(() => setMap(null), []);

    const options = useMemo<google.maps.MapOptions>(
        () => ({
            disableDefaultUI: true,
            gestureHandling: 'greedy',
            clickableIcons: false,
            ...(GOOGLE_MAPS_MAP_ID
                ? { mapId: GOOGLE_MAPS_MAP_ID } // cloud style wins; `styles` would be ignored
                : { styles: LIGHT_MAP_STYLES }),
        }),
        []
    );

    // A courier whose phone never reported leaves no trail at all. An empty map would read as a
    // route that simply looks short — this has to say the track is missing, not draw nothing.
    if (points.length === 0) {
        return (
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #f1eae4', borderRadius: 4 }}>
                <EmptyState>
                    No track recorded — the courier's phone never reported a position for this order.
                </EmptyState>
            </Box>
        );
    }

    if (!isLoaded) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                       height: MAP_HEIGHT, borderRadius: 4, bgcolor: '#f4f1ea' }}>
                <CircularProgress size={24} sx={{ color: '#8f887c' }} />
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #f1eae4' }}>
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: MAP_HEIGHT }}
                    onLoad={handleLoad}
                    onUnmount={handleUnmount}
                    options={options}
                />
            </Box>
            {/* Three dots of the same size are indistinguishable without this, and the map is on
                screen to be read at a glance. */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1, px: 0.5 }}>
                <LegendItem color={START_COLOR}>
                    {points.length === 1 ? 'Only recorded fix' : 'First fix'}
                </LegendItem>
                {points.length > 1 && <LegendItem color={TRAIL_COLOR}>Drop-off</LegendItem>}
                {pickup !== null && <LegendItem color={PICKUP_COLOR}>Picked up</LegendItem>}
                {destination !== null && <LegendItem color={DESTINATION_COLOR}>Customer's pin</LegendItem>}
            </Box>
        </Box>
    );
}

function LegendItem({ color, children }: { color: string; children: React.ReactNode }): JSX.Element {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
            <Typography variant="caption" sx={{ color: '#8a807a', fontWeight: 600 }}>{children}</Typography>
        </Box>
    );
}
