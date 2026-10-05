import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Box, CircularProgress} from "@mui/material";
import {GoogleMap, useJsApiLoader} from "@react-google-maps/api";
import {
    GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, LIGHT_MAP_STYLES,
} from "../../../branch/utils/mapsConfig";
import {NO_DATA_COLOR} from "../utils/deliveryZoneScale";
import type {DeliveryZoneCell, DeliveryZonePoint} from "../types";

/**
 * The delivery-zones hexagons, drawn over Bahrain.
 *
 * Only ever mounted when GOOGLE_MAPS_API_KEY is truthy — the card keeps a table of the same cells
 * as the no-key fallback, exactly as CourierDispatcherPanel keeps the coordinate list behind
 * OrderRouteMap.
 */

// Explicit, because the map container is the child of an auto-height card: a height left to flex
// collapses to zero and the map renders as nothing.
const MAP_HEIGHT = 380;

/** Keeps the fitted cells off the edges of the frame. */
const BOUNDS_PADDING = {top: 40, right: 40, bottom: 40, left: 40};

/** Exported so the legend can be drawn at the same strength the cells are painted at. */
export const CELL_FILL_OPACITY = 0.65;

/**
 * White edges between neighbours: two adjacent cells one ramp step apart would otherwise merge
 * into a single blob and the grid would stop reading as cells.
 */
const CELL_EDGE_COLOR = "#ffffff";
/** DESIGN.md's primary ink — the selection is an outline, not a colour on the scale. */
const SELECTED_EDGE_COLOR = "#3b352c";

const CELL_Z_INDEX = 1;
const SELECTED_Z_INDEX = 2;

type LatLng = { lat: number; lng: number };

function toLatLng(point: DeliveryZonePoint): LatLng {
    return {lat: point.latitude, lng: point.longitude};
}

function fitToCells(target: google.maps.Map, cells: DeliveryZoneCell[]): void {
    if (cells.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const cell of cells) {
        for (const vertex of cell.vertices) bounds.extend(toLatLng(vertex));
    }
    target.fitBounds(bounds, BOUNDS_PADDING);
}

type Props = {
    cells: DeliveryZoneCell[];
    /** Fill per cell id, for the metric the card is showing. */
    fills: ReadonlyMap<string, string>;
    selectedId: string | null;
    onSelect: (cell: DeliveryZoneCell) => void;
    /**
     * Re-frames the map when it changes. The card keys it on the date range, NOT on the cells: a
     * manager who zooms into one district and then switches the cell size wants to stay there.
     */
    fitKey: string;
};

export function DeliveryZoneStatsMap({cells, fills, selectedId, onSelect, fitKey}: Props): JSX.Element {
    // Identical option set to BranchMapView, OrderRouteMap, DeliveryZoneMap and useReverseGeocode.
    // useJsApiLoader is a singleton: a caller passing a different shape warns and can refuse to load
    // the API for every map on the page.
    const {isLoaded} = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
        ...(GOOGLE_MAPS_MAP_ID ? {mapIds: [GOOGLE_MAPS_MAP_ID]} : {}),
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);

    // Read through refs so neither a parent's inline handler nor a new cell list re-runs the fit.
    const selectRef = useRef(onSelect);
    useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
    const cellsRef = useRef(cells);
    useEffect(() => { cellsRef.current = cells; }, [cells]);

    const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map());

    // Not in `onLoad`, and not `center`/`zoom` props: the first measures a container that has not
    // been laid out yet, the second would re-centre on every render. Same shape as OrderRouteMap.
    useEffect(() => {
        if (map === null) return;

        const fit = (): void => fitToCells(map, cellsRef.current);
        fit();
        const listener = google.maps.event.addListenerOnce(map, "idle", fit);
        return () => google.maps.event.removeListener(listener);
    }, [map, fitKey]);

    /**
     * Polygons are created imperatively against the instance `onLoad` handed us, never as <Polygon>
     * children of <GoogleMap>: under React 18 StrictMode <GoogleMap> builds a second map and JSX
     * overlays stay bound to the discarded one — a working map with nothing drawn on it, in dev
     * only. See DeliveryZoneMap for the full story.
     */
    useEffect(() => {
        if (map === null) return;

        const created = new Map<string, google.maps.Polygon>();
        for (const cell of cells) {
            const polygon = new google.maps.Polygon({
                paths: cell.vertices.map(toLatLng),
                map,
                clickable: true,
                fillColor: fills.get(cell.id) ?? NO_DATA_COLOR,
                fillOpacity: CELL_FILL_OPACITY,
                strokeColor: CELL_EDGE_COLOR,
                strokeOpacity: 1,
                strokeWeight: 1,
                zIndex: CELL_Z_INDEX,
            });
            polygon.addListener("click", () => selectRef.current(cell));
            created.set(cell.id, polygon);
        }
        polygonsRef.current = created;

        return () => {
            for (const polygon of created.values()) {
                google.maps.event.clearInstanceListeners(polygon);
                polygon.setMap(null);
            }
            polygonsRef.current = new Map();
        };
    }, [map, cells, fills]);

    // Restyles in place rather than rebuilding every polygon on each tap. Keyed on the same inputs
    // as the effect above as well, so a rebuilt set picks the selection up again.
    useEffect(() => {
        for (const [id, polygon] of polygonsRef.current) {
            const selected = id === selectedId;
            polygon.setOptions({
                strokeColor: selected ? SELECTED_EDGE_COLOR : CELL_EDGE_COLOR,
                strokeWeight: selected ? 3 : 1,
                zIndex: selected ? SELECTED_Z_INDEX : CELL_Z_INDEX,
            });
        }
    }, [map, cells, fills, selectedId]);

    const handleLoad = useCallback((loaded: google.maps.Map) => setMap(loaded), []);
    const handleUnmount = useCallback(() => setMap(null), []);

    const options = useMemo<google.maps.MapOptions>(
        () => ({
            disableDefaultUI: true,
            zoomControl: true,
            // Not "greedy" as on the dispatcher map: this one sits inside a scrolling statistics
            // page, and greedy handling turns every one-finger swipe over it into a pan, trapping
            // the scroll.
            gestureHandling: "cooperative",
            clickableIcons: false,
            ...(GOOGLE_MAPS_MAP_ID
                ? {mapId: GOOGLE_MAPS_MAP_ID} // cloud style wins; `styles` would be ignored
                : {styles: LIGHT_MAP_STYLES}),
        }),
        []
    );

    if (!isLoaded) {
        return (
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "center",
                      height: MAP_HEIGHT, borderRadius: 4, bgcolor: "#f4f1ea"}}>
                <CircularProgress size={24} sx={{color: "#8f887c"}}/>
            </Box>
        );
    }

    return (
        <Box sx={{borderRadius: 4, overflow: "hidden", border: "1px solid #f1eae4"}}>
            <GoogleMap
                mapContainerStyle={{width: "100%", height: MAP_HEIGHT}}
                onLoad={handleLoad}
                onUnmount={handleUnmount}
                options={options}
            />
        </Box>
    );
}
