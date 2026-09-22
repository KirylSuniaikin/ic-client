import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import {
    GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, LIGHT_MAP_STYLES,
} from "../../../branch/utils/mapsConfig";
import type { DeliveryZone } from "../types";

/**
 * Draws and edits one branch's delivery zones.
 *
 * ── Why there is no drawing library ──────────────────────────────────────────────────────────
 * `useJsApiLoader` is a **singleton**: BranchMapView, OrderRouteMap and useReverseGeocode all
 * call it with the same option shape, and a caller that asks for a different one (an extra
 * `libraries: ['drawing']`, for instance) warns and can refuse to load the API for everyone.
 * So the option shape here is byte-identical to theirs, and the drawing is done with a plain
 * editable `google.maps.Polygon`: click the map to add a vertex, drag a vertex to move it, drag
 * a midpoint to insert one. That is the whole DrawingManager feature set this screen needs, at
 * the cost of no new dependency and no risk to three existing maps.
 *
 * ── Why the editable polygon is uncontrolled ─────────────────────────────────────────────────
 * The path lives in the Google overlay while a session is open, and changes are reported UP. It
 * is never pushed back down mid-session: re-seeding the polygon from a prop on every change
 * would rebuild the overlay under the finger that is dragging it. The parent restarts a session
 * — by changing `sessionKey` — when it genuinely wants to replace the shape (undo, clear, or
 * opening a different zone).
 *
 * Only ever mounted when GOOGLE_MAPS_API_KEY is truthy; the caller keeps a coordinate list as the
 * no-key fallback, exactly as BranchPickerDrawer keeps BranchListView.
 */

const MAP_HEIGHT = 380;

/** Keeps a fitted zone off the edges of the frame. */
const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

/** A branch with no zones fits to a single point, and fitBounds then zooms to maximum. */
const MAX_SINGLE_POINT_ZOOM = 15;

/** Bahrain, used only when the branch has no coordinates and no zone has been drawn yet. */
const FALLBACK_CENTER = { lat: 26.0667, lng: 50.5577 };
const FALLBACK_ZOOM = 12;

const ACTIVE_ZONE_COLOR = "#2e7d32";
/** Grey: an inactive zone restricts nothing, so it must not read as coverage. */
const INACTIVE_ZONE_COLOR = "#8a807a";
const DRAFT_COLOR = "#E44B4C";
/**
 * The radius borrows the inactive zone's neutral rather than introducing a colour of its own: it
 * is the ground the zones sit on, not a fourth zone, and DESIGN.md's rule is that new code does
 * not invent hexes.
 */
const RADIUS_COLOR = INACTIVE_ZONE_COLOR;

/**
 * Stacking order, stated explicitly instead of relying on the order overlays happen to be created
 * in: the radius is the ground, the saved zones sit on it, and the shape being edited is on top
 * where a manager's own drag has to stay visible.
 */
const RADIUS_Z_INDEX = 0;
const ZONE_Z_INDEX = 1;
const DRAFT_Z_INDEX = 2;

const METRES_PER_KM = 1000;

type LatLng = { lat: number; lng: number };

/**
 * The one place `[lon, lat]` becomes `{lat, lng}`. Google speaks lat/lng and the wire format is
 * GeoJSON lon/lat; doing the swap anywhere else is how a zone ends up in the wrong hemisphere.
 */
function toLatLng(point: number[]): LatLng {
    return { lat: point[1], lng: point[0] };
}

function toLonLat(position: google.maps.LatLng): number[] {
    return [position.lng(), position.lat()];
}

export type DeliveryZoneMapProps = {
    /** Every zone on the branch, for context. The one under edit is excluded automatically. */
    zones: DeliveryZone[];
    /** The saved zone currently open in the editor, or null when drawing a new one. */
    editingZoneId: string | null;
    editing: boolean;
    /**
     * Changes whenever the parent wants the editable overlay rebuilt from `initialPolygon` —
     * a different zone opened, an undo, a clear. It does NOT change as vertices are dragged.
     */
    sessionKey: string;
    initialPolygon: number[][];
    onPolygonChange: (polygon: number[][]) => void;
    /** The kitchen this zone belongs to, so an empty map opens somewhere meaningful. */
    center: LatLng | null;
    /**
     * How far this kitchen currently delivers, in km, drawn as a circle under the polygons.
     *
     * "Zones narrow the radius, they never extend it" is the one thing a manager has to get right
     * here, and until now it could only be read in a sentence. Null draws nothing: a branch object
     * that never came from a branch fetch has no radius, and an invented circle would be drawn in
     * the wrong place and then have zones drawn against it.
     *
     * Under today's config this is a constant 7.0 km on every branch — the ceiling
     * (`delivery.max-radius-km`) clamping a larger computed value, which is the ceiling doing its
     * job rather than a bug. It will differ per branch the moment that config does.
     */
    radiusKm: number | null;
};

export function DeliveryZoneMap({
    zones,
    editingZoneId,
    editing,
    sessionKey,
    initialPolygon,
    onPolygonChange,
    center,
    radiusKm,
}: DeliveryZoneMapProps): JSX.Element {
    // Identical option set to BranchMapView, OrderRouteMap and useReverseGeocode — see the note
    // above on why this must not diverge.
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
        ...(GOOGLE_MAPS_MAP_ID ? { mapIds: [GOOGLE_MAPS_MAP_ID] } : {}),
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);

    // Read through refs so a parent passing an inline arrow, or a polygon array rebuilt on every
    // render, does not tear the editable overlay down mid-drag.
    const changeRef = useRef(onPolygonChange);
    useEffect(() => { changeRef.current = onPolygonChange; }, [onPolygonChange]);
    const seedRef = useRef(initialPolygon);
    useEffect(() => { seedRef.current = initialPolygon; }, [initialPolygon]);

    const otherZones = useMemo(
        () => zones.filter((zone) => zone.id !== editingZoneId && zone.polygon.length >= 3),
        [zones, editingZoneId]
    );

    const fitToZones = useCallback(
        (target: google.maps.Map) => {
            const positions: LatLng[] = [
                ...zones.flatMap((zone) => zone.polygon.map(toLatLng)),
                ...initialPolygon.map(toLatLng),
            ];
            if (positions.length === 0) {
                target.setCenter(center ?? FALLBACK_CENTER);
                target.setZoom(FALLBACK_ZOOM);
                return;
            }

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
        // Deliberately keyed on the SESSION, not on `initialPolygon`'s identity: re-fitting on
        // every vertex drag would fight the manager for control of the viewport.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [zones, center, sessionKey]
    );

    // Not in `onLoad`, and not `center`/`zoom` props: the first measures a container that has not
    // been laid out, the second would re-centre on every render and make panning impossible.
    useEffect(() => {
        if (map === null) return;

        fitToZones(map);
        const listener = google.maps.event.addListenerOnce(map, "idle", () => fitToZones(map));
        return () => google.maps.event.removeListener(listener);
    }, [map, fitToZones]);

    /**
     * The delivery radius, under everything else.
     *
     * Imperative and bound to the instance `onLoad` handed us, for the same StrictMode reason as
     * the polygons below — see that comment. Declared FIRST so it is also created first, though
     * the explicit zIndex is what actually decides the stacking.
     *
     * `clickable: false` is load-bearing, not cosmetic: a clickable overlay swallows the map click
     * that appends a vertex, so a clickable circle would silently break drawing everywhere inside
     * the radius — which is the whole area anyone draws a zone in.
     */
    useEffect(() => {
        if (map === null || center === null || radiusKm === null) return;

        const circle = new google.maps.Circle({
            map,
            center,
            radius: radiusKm * METRES_PER_KM,
            clickable: false,
            strokeColor: RADIUS_COLOR,
            strokeOpacity: 0.7,
            strokeWeight: 1,
            fillColor: RADIUS_COLOR,
            fillOpacity: 0.06,
            zIndex: RADIUS_Z_INDEX,
        });

        return () => {
            google.maps.event.clearInstanceListeners(circle);
            circle.setMap(null);
        };
    }, [map, center, radiusKm]);

    /**
     * Overlays are created imperatively against the instance `onLoad` handed us, never as
     * <Polygon> children of <GoogleMap>. Those read the map out of context once, in
     * componentDidMount, and never re-attach; under React 18 StrictMode the tree mounts twice in
     * development and <GoogleMap> builds a SECOND google.maps.Map along the way, leaving the
     * children bound to the first, discarded one. The result is a working map with nothing drawn
     * on it, in dev only — a bug this repo has already paid for twice.
     */
    useEffect(() => {
        if (map === null) return;

        const overlays = otherZones.map((zone) => new google.maps.Polygon({
            paths: zone.polygon.map(toLatLng),
            map,
            clickable: false,
            strokeColor: zone.active ? ACTIVE_ZONE_COLOR : INACTIVE_ZONE_COLOR,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: zone.active ? ACTIVE_ZONE_COLOR : INACTIVE_ZONE_COLOR,
            fillOpacity: zone.active ? 0.12 : 0.05,
            zIndex: ZONE_Z_INDEX,
        }));

        return () => {
            for (const overlay of overlays) {
                google.maps.event.clearInstanceListeners(overlay);
                overlay.setMap(null);
            }
        };
    }, [map, otherZones]);

    /**
     * The editable overlay. Rebuilt only when the edit session changes — see the note at the top
     * on why it is uncontrolled.
     */
    useEffect(() => {
        if (map === null || !editing) return;

        const polygon = new google.maps.Polygon({
            // ONE ring, wrapped, even when it is empty. A flat array is read as "these are my
            // vertices" only while it has some: `paths: []` means "no rings at all", and a polygon
            // with no rings answers getPath() with undefined -- which crashed the editor on the
            // very first thing anyone does, drawing a zone that does not exist yet.
            paths: [seedRef.current.map(toLatLng)],
            map,
            editable: true,
            clickable: true,
            strokeColor: DRAFT_COLOR,
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: DRAFT_COLOR,
            fillOpacity: 0.15,
            zIndex: DRAFT_Z_INDEX,
        });

        const path = polygon.getPath();
        const emit = (): void => {
            changeRef.current(path.getArray().map(toLonLat));
        };

        const listeners: google.maps.MapsEventListener[] = [
            // set_at fires on a vertex drag, insert_at on a midpoint drag, remove_at on a
            // right-click delete. All three are the same event as far as the draft is concerned.
            path.addListener("set_at", emit),
            path.addListener("insert_at", emit),
            path.addListener("remove_at", emit),
            // Right-clicking a vertex is Google's own delete gesture; without this the only way
            // to drop a mis-placed point is to clear the whole shape.
            polygon.addListener("rightclick", (event: google.maps.PolyMouseEvent) => {
                if (event.vertex === undefined) return;
                path.removeAt(event.vertex);
            }),
            // Clicking the map appends. Vertices are added in tap order, which is the ring
            // order — a manager who taps a self-crossing outline gets a self-crossing zone, and
            // the fill makes that visible immediately.
            map.addListener("click", (event: google.maps.MapMouseEvent) => {
                if (event.latLng === null || event.latLng === undefined) return;
                path.push(event.latLng);
                emit();
            }),
        ];

        return () => {
            for (const listener of listeners) google.maps.event.removeListener(listener);
            google.maps.event.clearInstanceListeners(polygon);
            polygon.setMap(null);
        };
    }, [map, editing, sessionKey]);

    const handleLoad = useCallback((loaded: google.maps.Map) => setMap(loaded), []);
    const handleUnmount = useCallback(() => setMap(null), []);

    const options = useMemo<google.maps.MapOptions>(
        () => ({
            disableDefaultUI: true,
            zoomControl: true, // the one control a drawing surface genuinely needs
            gestureHandling: "greedy",
            clickableIcons: false,
            ...(GOOGLE_MAPS_MAP_ID
                ? { mapId: GOOGLE_MAPS_MAP_ID } // cloud style wins; `styles` would be ignored
                : { styles: LIGHT_MAP_STYLES }),
        }),
        []
    );

    if (!isLoaded) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                       height: MAP_HEIGHT, borderRadius: 2, bgcolor: "#f4f1ea" }}>
                <CircularProgress size={24} sx={{ color: "#8f887c" }} />
            </Box>
        );
    }

    return (
        <Box sx={{ borderRadius: 2, overflow: "hidden", border: "1px solid #eee" }}>
            <GoogleMap
                mapContainerStyle={{ width: "100%", height: MAP_HEIGHT }}
                onLoad={handleLoad}
                onUnmount={handleUnmount}
                options={options}
            />
        </Box>
    );
}
