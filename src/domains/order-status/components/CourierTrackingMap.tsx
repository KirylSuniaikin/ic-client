// runs/1b/task-spec.md §6, extended by runs/6b/task-spec.md §6 to 0..N couriers (one per
// currently-out-for-delivery part). Copies OrderRouteMap's canonical Google-maps pattern (§3): the
// loader is called with the exact singleton option shape, and every overlay is created
// imperatively against the map instance handed to onLoad — never as a JSX <Marker> child (React 18
// StrictMode double-mounts bind a JSX marker to the discarded first map instance).
//
// A single-part order (couriers.length <= 1) renders byte-identically to what Phase 1b shipped:
// one marker, camera follows its glide, plain-name caption. Two or more couriers switch to a
// fitBounds viewport (never camera-follow, which would thrash between independently-moving
// riders) and a per-marker caption line, keyed by partIndex so a delivered part dropping out never
// shifts another part's marker or caption.
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
// Small, self-contained duplicates of OrderRouteMap's viewport constants (runs/6b/task-spec.md §3
// "Map viewport precedent") — flagged there as a future extraction, not performed here.
const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const MAX_MULTI_MARKER_ZOOM = 16;

type LatLng = { lat: number; lng: number };

type MarkerEntry = {
    marker: google.maps.Marker;
    displayedPosition: LatLng;
    animationFrameId: number | null;
};

function toLatLng(courier: TrackedCourier): LatLng {
    return { lat: courier.latitude, lng: courier.longitude };
}

function sameLatLng(a: LatLng, b: LatLng): boolean {
    return a.lat === b.lat && a.lng === b.lng;
}

function markerTitleFor(courier: TrackedCourier, multi: boolean): string {
    return multi ? `${courier.name} — Part ${courier.partIndex}` : courier.name;
}

export function CourierTrackingMap({ couriers }: { couriers: TrackedCourier[] }): JSX.Element | null {
    const { t } = useTranslation("customerAuth");

    // Identical option set to OrderRouteMap/BranchMapView. useJsApiLoader is a singleton: a
    // second caller passing a different shape can refuse to load the script for everyone.
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
        ...(GOOGLE_MAPS_MAP_ID ? { mapIds: [GOOGLE_MAPS_MAP_ID] } : {}),
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    // One entry per currently-mounted marker, keyed by partIndex — never by array position, so a
    // delivered part dropping out of the incoming array never shifts a sibling part's marker.
    const entriesRef = useRef<Map<number, MarkerEntry>>(new Map());

    const handleLoad = useCallback((loaded: google.maps.Map): void => setMap(loaded), []);
    const handleUnmount = useCallback((): void => setMap(null), []);

    useEffect(() => {
        const entries = entriesRef.current;

        function cancelEntryAnimation(entry: MarkerEntry): void {
            if (entry.animationFrameId !== null) {
                cancelAnimationFrame(entry.animationFrameId);
                entry.animationFrameId = null;
            }
        }

        function detachEntry(entry: MarkerEntry): void {
            cancelEntryAnimation(entry);
            entry.marker.setMap(null);
        }

        // No map yet, or nothing to show: detach every overlay and reset local state.
        if (map === null || couriers.length === 0) {
            entries.forEach(detachEntry);
            entries.clear();
            return;
        }

        // Remove anything that dropped out (delivered, or its courier lost its fix) — no ghost pin.
        const incomingPartIndexes = new Set(couriers.map((courier) => courier.partIndex));
        entries.forEach((entry, partIndex) => {
            if (!incomingPartIndexes.has(partIndex)) {
                detachEntry(entry);
                entries.delete(partIndex);
            }
        });

        const multi = couriers.length > 1;
        // With one marker on screen the camera follows its own glide, exactly as Phase 1b. With
        // two or more, the camera never follows any single marker's per-frame position — it would
        // thrash between independently-moving riders — so fitBounds (below) owns the viewport.
        const followCamera = !multi;

        function startGlide(entry: MarkerEntry, target: LatLng, startPosition: LatLng): void {
            const startTime = performance.now();

            function step(now: number): void {
                const elapsed = now - startTime;
                const fraction = Math.min(1, elapsed / MARKER_ANIMATION_DURATION_MS);
                // Exactly `target` at fraction 1 — the interpolation formula alone can leave a
                // sub-precision float remainder instead of landing on the real destination.
                const position: LatLng = fraction >= 1
                    ? target
                    : {
                        lat: startPosition.lat + (target.lat - startPosition.lat) * fraction,
                        lng: startPosition.lng + (target.lng - startPosition.lng) * fraction,
                    };
                entry.marker.setPosition(position);
                if (followCamera) {
                    map.setCenter(position);
                }

                if (fraction < 1) {
                    entry.animationFrameId = requestAnimationFrame(step);
                } else {
                    entry.animationFrameId = null;
                    entry.displayedPosition = target;
                }
            }

            entry.animationFrameId = requestAnimationFrame(step);
        }

        for (const courier of couriers) {
            const target = toLatLng(courier);
            const existing = entries.get(courier.partIndex);

            // First fix for this part: create the marker at its exact position, no animation.
            if (existing === undefined) {
                const marker = new google.maps.Marker({ position: target, map, title: markerTitleFor(courier, multi) });
                entries.set(courier.partIndex, { marker, displayedPosition: target, animationFrameId: null });
                if (!multi) {
                    map.setCenter(target);
                    map.setZoom(MAP_ZOOM);
                }
                continue;
            }

            // This part hasn't reported since the last poll — nothing to interpolate.
            if (sameLatLng(existing.displayedPosition, target)) {
                cancelEntryAnimation(existing);
                existing.marker.setPosition(target);
                existing.displayedPosition = target;
                continue;
            }

            cancelEntryAnimation(existing);
            startGlide(existing, target, existing.displayedPosition);
        }

        // Viewport, evaluated once per this effect run (a poll tick, a part appearing, or a part
        // disappearing) — never once per animation frame.
        if (multi) {
            const bounds = new google.maps.LatLngBounds();
            for (const courier of couriers) {
                bounds.extend(toLatLng(courier));
            }
            map.fitBounds(bounds, BOUNDS_PADDING);

            // Two riders whose current fixes coincide or are extremely close would otherwise
            // fully zoom in, which reads as a broken map rather than a location.
            const zoom = map.getZoom();
            if (zoom !== undefined && zoom > MAX_MULTI_MARKER_ZOOM) {
                map.setZoom(MAX_MULTI_MARKER_ZOOM);
            }
        }
        // A transition from 2+ markers down to exactly 1 is not a special case here: the
        // surviving marker isn't recreated (it hit the `existing` branch above), so it keeps
        // whatever zoom the last fitBounds left the map at; this same effect, on its next run,
        // simply takes the `multi === false` path and resumes following it.
    }, [map, couriers]);

    // Unmount: cancel every pending animation frame and detach every marker, mirroring
    // OrderRouteMap's overlay-cleanup effect, generalized to N.
    useEffect(() => {
        const entries = entriesRef.current;
        return () => {
            entries.forEach((entry) => {
                if (entry.animationFrameId !== null) {
                    cancelAnimationFrame(entry.animationFrameId);
                }
                entry.marker.setMap(null);
            });
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

    if (!GOOGLE_MAPS_API_KEY || !isLoaded || couriers.length === 0) {
        return null;
    }

    // Never a client-maintained ticking clock — recomputed from the current fix on every render.
    function ageSuffix(courier: TrackedCourier): string | null {
        if (courier.positionAgeSeconds < STALE_LABEL_THRESHOLD_SECONDS) return null;
        const minutes = Math.floor(courier.positionAgeSeconds / 60);
        return ` · ${t("orderStatus.courierUpdatedAgo", { minutes })}`;
    }

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
            {couriers.length === 1 ? (
                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#8a807a", fontWeight: 600 }}>
                    {couriers[0].name}
                    {ageSuffix(couriers[0])}
                </Typography>
            ) : (
                couriers.map((courier) => (
                    <Typography
                        key={courier.partIndex}
                        data-testid={`courier-caption-${courier.partIndex}`}
                        variant="caption"
                        sx={{ display: "block", mt: 1, color: "#8a807a", fontWeight: 600 }}
                    >
                        {t("orderStatus.courierPartCaption", { index: courier.partIndex, name: courier.name })}
                        {ageSuffix(courier)}
                    </Typography>
                ))
            )}
        </Box>
    );
}
