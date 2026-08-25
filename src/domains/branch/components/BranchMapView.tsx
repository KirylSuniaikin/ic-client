import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { IBranch } from "../../management/inventory/types";
import {
    BRANCH_PIN_URL,
    GOOGLE_MAPS_API_KEY,
    GOOGLE_MAPS_MAP_ID,
    LIGHT_MAP_STYLES,
} from "../utils/mapsConfig";

// Arbitrary fallback center (Bahrain) used only when every branch is coordinate-less — the map
// still renders, just with zero pins, never a pin at 0,0.
const FALLBACK_CENTER = { lat: 26.0667, lng: 50.5577 };
const FALLBACK_ZOOM = 12;

/** Keeps the fitted bounds off the edges, and clear of the controls floating over the map. */
const BOUNDS_PADDING = { top: 96, right: 48, bottom: 160, left: 48 };

/** Above this the view is a single branch zoomed to street level, which reads as an error. */
const MAX_SINGLE_BRANCH_ZOOM = 15;

/** Rendered size of the branch pin, in CSS pixels. The asset itself is 128px for retina. */
const PIN_SIZE = 52;
/** Baseline of the branch name. Measured from the icon's TOP-LEFT, which is where Google anchors
 * labelOrigin — measuring from the centre puts the text inside the circle. */
const LABEL_OFFSET = PIN_SIZE + 11;

export interface BranchMapViewProps {
    branches: IBranch[]; // markers rendered only for entries with non-null lat/lng
    onSelectBranch: (branch: IBranch) => void;
    /** The branch whose details are open. Its pin bounces, so the map says which one you tapped. */
    activeBranchId?: string | null;
    /** Fills its container. The picker gives it the whole dialog. */
    height?: string | number;
}

/** Presentational — only ever mounted by BranchPickerDrawer when GOOGLE_MAPS_API_KEY is truthy. */
export function BranchMapView({
    branches,
    onSelectBranch,
    activeBranchId = null,
    height = "100%",
}: BranchMapViewProps): JSX.Element {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
        ...(GOOGLE_MAPS_MAP_ID ? { mapIds: [GOOGLE_MAPS_MAP_ID] } : {}),
    });

    const branchesWithCoords = useMemo(
        () =>
            branches.filter(
                (branch): branch is IBranch & { latitude: number; longitude: number } =>
                    branch.latitude !== null && branch.longitude !== null
            ),
        [branches]
    );

    const [map, setMap] = useState<google.maps.Map | null>(null);

    // Read through a ref so a caller passing an inline arrow (the picker does) does not tear the
    // markers down and rebuild them on every render.
    const selectBranchRef = useRef(onSelectBranch);
    useEffect(() => {
        selectBranchRef.current = onSelectBranch;
    }, [onSelectBranch]);

    const fitToBranches = useCallback(
        (target: google.maps.Map) => {
            if (branchesWithCoords.length === 0) {
                target.setCenter(FALLBACK_CENTER);
                target.setZoom(FALLBACK_ZOOM);
                return;
            }

            const bounds = new google.maps.LatLngBounds();
            for (const branch of branchesWithCoords) {
                bounds.extend({ lat: branch.latitude, lng: branch.longitude });
            }
            target.fitBounds(bounds, BOUNDS_PADDING);

            // A single branch collapses the bounds to a point and fitBounds zooms to maximum,
            // which looks like a bug rather than a location. Pull it back to a readable level.
            if (branchesWithCoords.length === 1) {
                const zoom = target.getZoom();
                if (zoom !== undefined && zoom > MAX_SINGLE_BRANCH_ZOOM) {
                    target.setZoom(MAX_SINGLE_BRANCH_ZOOM);
                }
            }
        },
        [branchesWithCoords]
    );

    /**
     * Fits the view AFTER the map exists and the container has real size.
     *
     * Not in `onLoad`: the map initialises while the drawer is still animating open, so its
     * container is a few pixels tall at that moment. fitBounds against a near-zero viewport
     * produces a nonsense centre and zoom, and the pins end up somewhere off screen.
     *
     * Deliberately NOT `center`/`zoom` props, which would re-centre on every render and make
     * panning impossible. This fires only when the map or the branch set actually changes.
     */
    useEffect(() => {
        if (map === null) return;

        fitToBranches(map);
        // One more pass once the map settles, which is after the open animation finishes and the
        // container has its final height. Harmless when the first fit was already correct.
        const listener = google.maps.event.addListenerOnce(map, "idle", () => fitToBranches(map));
        return () => google.maps.event.removeListener(listener);
    }, [map, fitToBranches]);

    /**
     * Markers are created imperatively against the map instance this component holds, NOT as
     * <Marker> children of <GoogleMap>.
     *
     * @react-google-maps/api's <Marker> reads the map out of context once, in componentDidMount,
     * and never re-attaches when that context changes. Under React 18 StrictMode the whole tree
     * mounts, unmounts and mounts again in development, and <GoogleMap> builds a SECOND
     * google.maps.Map for its container along the way — so the surviving markers stay bound to the
     * first, discarded map while the one on screen is the second. The result is a working map with
     * no pins at any zoom level, in dev only. Owning the markers here keeps them on exactly the
     * map that `onLoad` handed us, in both dev and production.
     */
    // Keyed by branch id so the animation effect below can reach one pin without rebuilding the
    // rest — recreating a marker to change its animation would restart it on every render.
    const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

    useEffect(() => {
        if (map === null) return;

        const markers = branchesWithCoords.map((branch) => {
            const marker = new google.maps.Marker({
                position: { lat: branch.latitude, lng: branch.longitude },
                map,
                title: branch.branchName,
                label: {
                    text: branch.branchName,
                    className: "branch-marker-label",
                    color: "#3b352c",
                    fontSize: "13px",
                    fontWeight: "700",
                },
                icon: {
                    url: BRANCH_PIN_URL,
                    scaledSize: new google.maps.Size(PIN_SIZE, PIN_SIZE),
                    // Both default to the image's bottom centre, which would hang the badge above
                    // its branch and print the name across it.
                    anchor: new google.maps.Point(PIN_SIZE / 2, PIN_SIZE / 2),
                    labelOrigin: new google.maps.Point(PIN_SIZE / 2, LABEL_OFFSET),
                },
            });
            marker.addListener("click", () => selectBranchRef.current(branch));
            markersRef.current.set(branch.id, marker);
            return marker;
        });

        return () => {
            for (const marker of markers) {
                google.maps.event.clearInstanceListeners(marker);
                marker.setMap(null);
            }
            markersRef.current.clear();
        };
    }, [map, branchesWithCoords]);

    /**
     * Bounces the pin of the branch currently being described, and only that one.
     *
     * Runs after the marker effect above, so a freshly built marker set is already in the ref.
     * Clearing the animation on every other pin each time is deliberate: one leftover bouncing
     * marker is worse than none, and there are two of them, not two hundred.
     */
    useEffect(() => {
        for (const [branchId, marker] of markersRef.current) {
            marker.setAnimation(branchId === activeBranchId ? google.maps.Animation.BOUNCE : null);
        }
    }, [activeBranchId, branchesWithCoords, map]);

    const handleLoad = useCallback((loaded: google.maps.Map) => setMap(loaded), []);
    const handleUnmount = useCallback(() => setMap(null), []);

    const options = useMemo<google.maps.MapOptions>(
        () => ({
            disableDefaultUI: true,
            gestureHandling: "greedy", // one-finger pan inside a dialog, no "use two fingers" overlay
            clickableIcons: false, // Google's own POIs are not selectable branches
            ...(GOOGLE_MAPS_MAP_ID
                ? { mapId: GOOGLE_MAPS_MAP_ID } // cloud style wins; `styles` would be ignored
                : { styles: LIGHT_MAP_STYLES }),
        }),
        []
    );

    if (!isLoaded) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height, bgcolor: "#f4f1ea" }}>
                <CircularProgress size={24} sx={{ color: "#8f887c" }} />
            </Box>
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={{ width: "100%", height }}
            onLoad={handleLoad}
            onUnmount={handleUnmount}
            options={options}
        />
    );
}
