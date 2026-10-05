// runs/1b/task-spec.md §6, extended by runs/6b/task-spec.md §6 to 0..N couriers (one per
// currently-out-for-delivery part). Copies OrderRouteMap's canonical Google-maps pattern (§3): the
// loader is called with the exact singleton option shape, and every overlay is created
// imperatively against the map instance handed to onLoad — never as a JSX <Marker> child (React 18
// StrictMode double-mounts bind a JSX marker to the discarded first map instance).
//
// Each courier is a moped seen from above, turned to its direction of travel; the customer's own
// address is a home marker beneath it. Markers are keyed by partIndex, so a delivered part
// dropping out never shifts another part's marker or status line.
//
// Camera, by case:
// - No home pin, one courier: the camera follows the moped's glide (Phase 1b, unchanged).
// - No home pin, two or more: fitBounds on every update (Phase 6b, unchanged) — following one
//   rider would thrash between independently-moving ones.
// - With a home pin: the riders and home are framed together. A glance map (`keepInFrame`, the
//   order-detail sheet) re-frames on every poll. The status page's map, which the customer can
//   pan, is framed when tracking starts and when the set of riders or the pin changes, and is
//   otherwise left where the customer put it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useTranslation } from "react-i18next";
import {
    GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, LIGHT_MAP_STYLES,
} from "../../branch/utils/mapsConfig";
import { POLL_INTERVAL_MS } from "../hooks/useCourierTracking";
import { iconAngleOf, normalizeDegrees, shortestTurnDegrees } from "../utils/heading";
import {
    HOME_ICON_HEIGHT, HOME_ICON_URL, HOME_ICON_WIDTH, MOPED_ICON_SIZE, mopedIconUrl,
} from "../utils/trackingMarkerArt";
import { CourierStatusLines } from "./CourierStatusLines";
import type { TrackedCourier, TrackingDestination } from "../types";

const MAP_HEIGHT = 220;
const MAP_ZOOM = 16;
// The marker glides over exactly one poll cycle, so it always arrives before the next fix lands.
const MARKER_ANIMATION_DURATION_MS = POLL_INTERVAL_MS;
// Short on purpose: a rider corners and then rides straight. Spread across the whole glide, a
// 90° corner would read as the moped drifting sideways down the street for fifteen seconds.
const TURN_DURATION_MS = 1_000;
// Small, self-contained duplicates of OrderRouteMap's viewport constants (runs/6b/task-spec.md §3
// "Map viewport precedent") — flagged there as a future extraction, not performed here.
const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
// The home icon stands 42 px tall above its point, so the top edge needs more room than the
// other three or a home along the top of the frame loses its roof.
const HOME_BOUNDS_PADDING = { top: 56, right: 40, bottom: 40, left: 40 };
const MAX_MULTI_MARKER_ZOOM = 16;
// Home is drawn beneath the moped(s): at the door the rider sits on top of the pin.
const HOME_Z_INDEX = 1;
const COURIER_Z_INDEX = 2;

type LatLng = { lat: number; lng: number };

type Glide = { from: LatLng; to: LatLng; startedAt: number };
type Turn = { from: number; delta: number; startedAt: number };

type MarkerEntry = {
    marker: google.maps.Marker;
    /** The latest fix — where the current glide ends. */
    targetPosition: LatLng;
    /** Where the marker is drawn right now, mid-glide included — the next glide starts here. */
    displayedPosition: LatLng;
    /** The heading the moped turns to and then holds; kept when a poll reports no bearing. */
    targetBearing: number;
    displayedBearing: number;
    /** The whole-degree angle the current icon is drawn at. */
    iconAngle: number;
    glide: Glide | null;
    turn: Turn | null;
    animationFrameId: number | null;
};

type HomeEntry = {
    marker: google.maps.Marker;
    position: LatLng;
    title: string;
};

function toLatLng(point: { latitude: number; longitude: number }): LatLng {
    return { lat: point.latitude, lng: point.longitude };
}

function sameLatLng(a: LatLng, b: LatLng): boolean {
    return a.lat === b.lat && a.lng === b.lng;
}

function markerTitleFor(courier: TrackedCourier, multi: boolean): string {
    return multi ? `${courier.name} — Part ${courier.partIndex}` : courier.name;
}

/** The reported heading, or null — `typeof` also covers a backend that predates the field. */
function reportedBearingOf(courier: TrackedCourier): number | null {
    return typeof courier.bearingDegrees === "number" ? normalizeDegrees(courier.bearingDegrees) : null;
}

function mopedIcon(degrees: number): google.maps.Icon {
    return {
        url: mopedIconUrl(degrees),
        scaledSize: new google.maps.Size(MOPED_ICON_SIZE, MOPED_ICON_SIZE),
        // The centre: the GPS point is the pivot the art rotates about, not the bottom edge
        // Google anchors image icons on by default.
        anchor: new google.maps.Point(MOPED_ICON_SIZE / 2, MOPED_ICON_SIZE / 2),
    };
}

function homeIcon(): google.maps.Icon {
    return {
        url: HOME_ICON_URL,
        scaledSize: new google.maps.Size(HOME_ICON_WIDTH, HOME_ICON_HEIGHT),
        // The pointer tip, so the pin points at the door at every zoom.
        anchor: new google.maps.Point(HOME_ICON_WIDTH / 2, HOME_ICON_HEIGHT),
    };
}

/** Changes exactly when the interactive map should re-frame: a rider joins or leaves, or the pin moves. */
function framingKeyOf(couriers: TrackedCourier[], destination: TrackingDestination | null): string {
    const riders = couriers.map((courier) => courier.partIndex).sort((a, b) => a - b).join(",");
    const home = destination === null ? "" : `${destination.latitude},${destination.longitude}`;
    return `${riders}|${home}`;
}

type CourierTrackingMapProps = {
    couriers: TrackedCourier[];
    /** The customer's own drop-off pin, drawn as a home under the moped(s). Null: no pin. */
    destination?: TrackingDestination | null;
    /**
     * The order is split into parts (partsTotal > 1). Riders are then labelled by part even when
     * only one of them is out, so its minutes are not read as the whole order's.
     */
    split?: boolean;
    /**
     * "greedy" (the default) suits the full-screen status page, where the map is the only thing to
     * drag. Inside a scrolling sheet one-finger drags must keep scrolling the sheet, or a customer
     * on a phone gets stuck on the map — "cooperative" is Google's own answer to that (one finger
     * scrolls the page, two move the map).
     */
    gestureHandling?: "greedy" | "cooperative";
    /**
     * True for a glance map the customer reads rather than explores: riders and home are re-framed
     * on every poll. False (the status page) frames them on start and when the set of riders
     * changes, so a customer who pans away is not snapped back every fifteen seconds.
     */
    keepInFrame?: boolean;
};

export function CourierTrackingMap({
    couriers,
    destination = null,
    split = false,
    gestureHandling = "greedy",
    keepInFrame = false,
}: CourierTrackingMapProps): JSX.Element | null {
    const { t } = useTranslation("customerAuth");
    const homeTitle = t("orderStatus.deliveryAddressMarker");

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
    const homeRef = useRef<HomeEntry | null>(null);
    // The framing the status-page map last applied; null until tracking (re)starts.
    const lastFramedKeyRef = useRef<string | null>(null);
    // Read by animation loops started in an earlier run of the effect below, which must still
    // follow (or stop following) according to the latest update.
    const followCameraRef = useRef<boolean>(false);

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

        function detachHome(): void {
            homeRef.current?.marker.setMap(null);
            homeRef.current = null;
        }

        // No map yet, or nothing to show: detach every overlay and reset local state.
        if (map === null || couriers.length === 0) {
            entries.forEach(detachEntry);
            entries.clear();
            detachHome();
            lastFramedKeyRef.current = null;
            return;
        }
        const liveMap = map;

        // Remove anything that dropped out (delivered, or its courier lost its fix) — no ghost pin.
        const incomingPartIndexes = new Set(couriers.map((courier) => courier.partIndex));
        entries.forEach((entry, partIndex) => {
            if (!incomingPartIndexes.has(partIndex)) {
                detachEntry(entry);
                entries.delete(partIndex);
            }
        });

        const multi = couriers.length > 1;
        const partLabels = split || multi;
        const homePosition = destination === null ? null : toLatLng(destination);
        // The camera follows one moped only when there is nothing else to keep in view.
        const followCamera = !multi && homePosition === null;
        followCameraRef.current = followCamera;

        if (homePosition === null) {
            detachHome();
        } else if (homeRef.current === null) {
            homeRef.current = {
                marker: new google.maps.Marker({
                    position: homePosition,
                    map: liveMap,
                    title: homeTitle,
                    icon: homeIcon(),
                    zIndex: HOME_Z_INDEX,
                    optimized: false,
                }),
                position: homePosition,
                title: homeTitle,
            };
        } else {
            const home = homeRef.current;
            if (!sameLatLng(home.position, homePosition)) {
                home.marker.setPosition(homePosition);
                home.position = homePosition;
            }
            if (home.title !== homeTitle) {
                home.marker.setTitle(homeTitle);
                home.title = homeTitle;
            }
        }

        function drawHeading(entry: MarkerEntry, degrees: number): void {
            const angle = iconAngleOf(degrees);
            if (angle === entry.iconAngle) return;
            entry.iconAngle = angle;
            entry.marker.setIcon(mopedIcon(angle));
        }

        // One loop per marker drives both its glide and its turn, so a turn arriving mid-glide
        // never restarts the glide (or the other way round).
        function step(entry: MarkerEntry, now: number): void {
            let running = false;

            if (entry.glide !== null) {
                const { from, to, startedAt } = entry.glide;
                const fraction = Math.min(1, (now - startedAt) / MARKER_ANIMATION_DURATION_MS);
                // Exactly `to` at fraction 1 — the interpolation formula alone can leave a
                // sub-precision float remainder instead of landing on the real destination.
                const position: LatLng = fraction >= 1
                    ? to
                    : {
                        lat: from.lat + (to.lat - from.lat) * fraction,
                        lng: from.lng + (to.lng - from.lng) * fraction,
                    };
                entry.marker.setPosition(position);
                entry.displayedPosition = position;
                if (followCameraRef.current) {
                    liveMap.setCenter(position);
                }
                if (fraction >= 1) entry.glide = null;
                else running = true;
            }

            if (entry.turn !== null) {
                const { from, delta, startedAt } = entry.turn;
                const fraction = Math.min(1, (now - startedAt) / TURN_DURATION_MS);
                const bearing = fraction >= 1 ? entry.targetBearing : normalizeDegrees(from + delta * fraction);
                entry.displayedBearing = bearing;
                drawHeading(entry, bearing);
                if (fraction >= 1) entry.turn = null;
                else running = true;
            }

            entry.animationFrameId = running ? requestAnimationFrame((next) => step(entry, next)) : null;
        }

        for (const courier of couriers) {
            const target = toLatLng(courier);
            const reportedBearing = reportedBearingOf(courier);
            const existing = entries.get(courier.partIndex);

            // First fix for this part: create the marker at its exact position and heading, no
            // animation. Never seen a heading yet: upright, nose to the north.
            if (existing === undefined) {
                const bearing = reportedBearing ?? 0;
                const marker = new google.maps.Marker({
                    position: target,
                    map: liveMap,
                    title: markerTitleFor(courier, partLabels),
                    icon: mopedIcon(bearing),
                    zIndex: COURIER_Z_INDEX,
                    // Its own DOM image rather than a tile of Google's shared marker canvas: the
                    // icon is swapped on every frame of a turn, which is what Google's guidance
                    // for animated or frequently changing marker images asks for.
                    optimized: false,
                });
                entries.set(courier.partIndex, {
                    marker,
                    targetPosition: target,
                    displayedPosition: target,
                    targetBearing: bearing,
                    displayedBearing: bearing,
                    iconAngle: iconAngleOf(bearing),
                    glide: null,
                    turn: null,
                    animationFrameId: null,
                });
                if (followCamera) {
                    liveMap.setCenter(target);
                    liveMap.setZoom(MAP_ZOOM);
                }
                continue;
            }

            let moved = false;

            // A repeat of the same fix leaves any glide still in flight to finish — snapping it
            // to the end would be a visible jump for no new information.
            if (!sameLatLng(existing.targetPosition, target)) {
                existing.glide = { from: existing.displayedPosition, to: target, startedAt: performance.now() };
                existing.targetPosition = target;
                moved = true;
            }

            // No bearing (standing still, or a stale fix) keeps the heading already shown.
            if (reportedBearing !== null && iconAngleOf(reportedBearing) !== iconAngleOf(existing.targetBearing)) {
                existing.turn = {
                    from: existing.displayedBearing,
                    delta: shortestTurnDegrees(existing.displayedBearing, reportedBearing),
                    startedAt: performance.now(),
                };
                existing.targetBearing = reportedBearing;
                moved = true;
            }

            if (moved) {
                cancelEntryAnimation(existing);
                const entry = existing;
                entry.animationFrameId = requestAnimationFrame((now) => step(entry, now));
            }
        }

        // Viewport, evaluated once per this effect run (a poll tick, a part appearing, or a part
        // disappearing) — never once per animation frame.
        if (followCamera) {
            return;
        }

        const framingKey = framingKeyOf(couriers, destination);
        const reframe = homePosition === null || keepInFrame || framingKey !== lastFramedKeyRef.current;
        lastFramedKeyRef.current = framingKey;
        if (!reframe) {
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        for (const courier of couriers) {
            const entry = entries.get(courier.partIndex);
            if (entry === undefined) continue;
            // Both ends of the glide, so the moped stays in frame for all of it.
            if (!sameLatLng(entry.displayedPosition, entry.targetPosition)) {
                bounds.extend(entry.displayedPosition);
            }
            bounds.extend(entry.targetPosition);
        }
        if (homePosition !== null) {
            bounds.extend(homePosition);
        }
        liveMap.fitBounds(bounds, homePosition === null ? BOUNDS_PADDING : HOME_BOUNDS_PADDING);

        // A rider at the door (or two whose fixes coincide) would otherwise zoom fully in, which
        // reads as a broken map rather than a location.
        const zoom = liveMap.getZoom();
        if (zoom !== undefined && zoom > MAX_MULTI_MARKER_ZOOM) {
            liveMap.setZoom(MAX_MULTI_MARKER_ZOOM);
        }
        // A transition from 2+ markers down to exactly 1 with no home is not a special case here:
        // the surviving marker isn't recreated (it hit the `existing` branch above), so it keeps
        // whatever zoom the last fitBounds left the map at; this same effect, on its next run,
        // simply takes the follow path and resumes following it.
    }, [map, couriers, destination, split, keepInFrame, homeTitle]);

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
            homeRef.current?.marker.setMap(null);
            homeRef.current = null;
        };
    }, []);

    // Keyed on the primitive prop only, so the object keeps its identity across poll ticks and
    // GoogleMap does not re-apply its options on every render.
    const options = useMemo<google.maps.MapOptions>(
        () => ({
            disableDefaultUI: true,
            gestureHandling,
            clickableIcons: false,
            // The moped's heading is drawn into its icon relative to north. On a vector Map ID
            // with rotation or tilt switched on in Cloud Console, a two-finger twist would turn
            // the roads under a moped that stays screen-aligned, pointing it off its street.
            // Left unset, these fall back to that cloud configuration; on a raster map they are
            // ignored.
            headingInteractionEnabled: false,
            tiltInteractionEnabled: false,
            ...(GOOGLE_MAPS_MAP_ID
                ? { mapId: GOOGLE_MAPS_MAP_ID }
                : { styles: LIGHT_MAP_STYLES }),
        }),
        [gestureHandling]
    );

    if (!GOOGLE_MAPS_API_KEY || !isLoaded || couriers.length === 0) {
        return null;
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
            <CourierStatusLines couriers={couriers} split={split} />
        </Box>
    );
}
