// runs/1b/task-spec.md §6. Renders the single courier marker on the order-status "Out for
// delivery" screen. Copies OrderRouteMap's canonical Google-maps pattern (§3): the loader is
// called with the exact singleton option shape, and every overlay is created imperatively
// against the map instance handed to onLoad — never as a JSX <Marker> child (React 18
// StrictMode double-mounts bind a JSX marker to the discarded first map instance).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useTranslation } from "react-i18next";
import {
    GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, LIGHT_MAP_STYLES,
} from "../../branch/utils/mapsConfig";
import { POLL_INTERVAL_MS } from "../hooks/useCourierTracking";
import type { TrackedCourier } from "../types";

const MAP_HEIGHT = 220;
const MAP_ZOOM = 16;
// Locked design constant (task-spec.md §1): exactly one courier-app reporting cycle.
const STALE_LABEL_THRESHOLD_SECONDS = 60;
// The marker glides over exactly one poll cycle, so it always arrives before the next fix lands.
const MARKER_ANIMATION_DURATION_MS = POLL_INTERVAL_MS;

type LatLng = { lat: number; lng: number };

function toLatLng(courier: TrackedCourier): LatLng {
    return { lat: courier.latitude, lng: courier.longitude };
}

function sameLatLng(a: LatLng, b: LatLng): boolean {
    return a.lat === b.lat && a.lng === b.lng;
}

export function CourierTrackingMap({ courier }: { courier: TrackedCourier | null }): JSX.Element | null {
    const { t } = useTranslation("customerAuth");

    // Identical option set to OrderRouteMap/BranchMapView. useJsApiLoader is a singleton: a
    // second caller passing a different shape can refuse to load the script for everyone.
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
        ...(GOOGLE_MAPS_MAP_ID ? { mapIds: [GOOGLE_MAPS_MAP_ID] } : {}),
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    // "Where the marker visually is right now" — kept separate from the latest `courier` prop so
    // an in-flight interpolation always knows where it started from.
    const displayedPositionRef = useRef<LatLng | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const handleLoad = useCallback((loaded: google.maps.Map): void => setMap(loaded), []);
    const handleUnmount = useCallback((): void => setMap(null), []);

    useEffect(() => {
        function cancelPendingAnimation(): void {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        }

        // No map yet, or nothing to show: detach whatever overlay exists and reset local state.
        if (map === null || courier === null) {
            cancelPendingAnimation();
            if (markerRef.current !== null) {
                markerRef.current.setMap(null);
                markerRef.current = null;
            }
            displayedPositionRef.current = null;
            return;
        }

        const target = toLatLng(courier);

        // First fix: create the marker at its exact position, no animation.
        if (markerRef.current === null) {
            const marker = new google.maps.Marker({ position: target, map, title: courier.name });
            markerRef.current = marker;
            displayedPositionRef.current = target;
            map.setCenter(target);
            map.setZoom(MAP_ZOOM);
            return;
        }

        const displayed = displayedPositionRef.current ?? target;

        // Courier hasn't reported since the last poll — nothing to interpolate.
        if (sameLatLng(displayed, target)) {
            cancelPendingAnimation();
            markerRef.current.setPosition(target);
            displayedPositionRef.current = target;
            return;
        }

        cancelPendingAnimation();
        const marker = markerRef.current;
        const startTime = performance.now();

        function step(now: number): void {
            const elapsed = now - startTime;
            const fraction = Math.min(1, elapsed / MARKER_ANIMATION_DURATION_MS);
            // Exactly `target` at fraction 1 — the interpolation formula alone can leave a
            // sub-precision float remainder instead of landing on the real destination.
            const position: LatLng = fraction >= 1
                ? target
                : {
                    lat: displayed.lat + (target.lat - displayed.lat) * fraction,
                    lng: displayed.lng + (target.lng - displayed.lng) * fraction,
                };
            marker.setPosition(position);
            map.setCenter(position);

            if (fraction < 1) {
                animationFrameRef.current = requestAnimationFrame(step);
            } else {
                animationFrameRef.current = null;
                displayedPositionRef.current = target;
            }
        }

        animationFrameRef.current = requestAnimationFrame(step);
    }, [map, courier]);

    // Unmount: cancel any pending animation frame and detach the marker, mirroring
    // OrderRouteMap's overlay-cleanup effect.
    useEffect(() => {
        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (markerRef.current !== null) {
                markerRef.current.setMap(null);
            }
        };
    }, []);

    const options = useMemo<google.maps.MapOptions>(
        () => ({
            disableDefaultUI: true,
            gestureHandling: "greedy",
            clickableIcons: false,
            ...(GOOGLE_MAPS_MAP_ID
                ? { mapId: GOOGLE_MAPS_MAP_ID }
                : { styles: LIGHT_MAP_STYLES }),
        }),
        []
    );

    if (!GOOGLE_MAPS_API_KEY || !isLoaded || courier === null) {
        return null;
    }

    // Never a client-maintained ticking clock — recomputed from the current fix on every render.
    const showAge = courier.positionAgeSeconds >= STALE_LABEL_THRESHOLD_SECONDS;
    const minutes = Math.floor(courier.positionAgeSeconds / 60);

    return (
        <Box>
            <Box sx={{ borderRadius: 4, overflow: "hidden", border: "1px solid #f1eae4" }}>
                <GoogleMap
                    mapContainerStyle={{ width: "100%", height: MAP_HEIGHT }}
                    onLoad={handleLoad}
                    onUnmount={handleUnmount}
                    options={options}
                />
            </Box>
            <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#8a807a", fontWeight: 600 }}>
                {courier.name}
                {showAge ? ` · ${t("orderStatus.courierUpdatedAgo", { minutes })}` : null}
            </Typography>
        </Box>
    );
}
