import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useTranslation } from "react-i18next";
import type { IBranch } from "../../management/inventory/types";
import { branchDisplayName } from "../utils/branchDisplayName";
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

/** The PC picker's map column has no floating button to clear; only the close button sits in its
 *  top inline-end corner. */
const DESKTOP_BOUNDS_PADDING = { top: 80, right: 64, bottom: 64, left: 64 };

/** Above this the view is a single branch zoomed to street level, which reads as an error. */
const MAX_SINGLE_BRANCH_ZOOM = 15;

/**
 * Rendered size of the branch pin, in CSS pixels: the old 52px badge as a round head, with a
 * pointed tip under it. The asset is 2x this (104x136) for retina, and its tip's apex is the
 * image's bottom-centre pixel row.
 */
const PIN_WIDTH = 52;
const PIN_HEIGHT = 68;
/** Centre of the branch name, 11px below the tip. Measured from the icon's TOP-LEFT, which is
 * where Google anchors labelOrigin — measuring from the anchor puts the text inside the pin. */
const LABEL_OFFSET = PIN_HEIGHT + 11;

export interface BranchMapViewProps {
    branches: IBranch[]; // markers rendered only for entries with non-null lat/lng
    onSelectBranch: (branch: IBranch) => void;
    /** The branch whose details are open. Its pin bounces, so the map says which one you tapped. */
    activeBranchId?: string | null;
    /** Fills its container. The picker gives it the whole dialog. */
    height?: string | number;
    /** "sheet" (default): the phone picker, controls float over the map. "dialog": the PC
     *  picker's map column, which also pans to the branch whose details are open. */
    layout?: "sheet" | "dialog";
}

/**
 * One full up-and-down of Google's BOUNCE, in milliseconds. The animation has no "play once"
 * mode and no completion callback, so the single hop is produced by clearing it after exactly
 * one cycle. Google does not publish the period; ~700 ms is what one cycle measures at, and a
 * little slack keeps the pin from being frozen mid-air on a slow frame.
 */
const ONE_BOUNCE_MS = 750;

/** Presentational — only ever mounted by BranchPickerDrawer when GOOGLE_MAPS_API_KEY is truthy. */
export function BranchMapView({
    branches,
    onSelectBranch,
    activeBranchId = null,
    height = "100%",
    layout = "sheet",
}: BranchMapViewProps): JSX.Element {
    const { i18n } = useTranslation();
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
            target.fitBounds(bounds, layout === "dialog" ? DESKTOP_BOUNDS_PADDING : BOUNDS_PADDING);

            // A single branch collapses the bounds to a point and fitBounds zooms to maximum,
            // which looks like a bug rather than a location. Pull it back to a readable level.
            if (branchesWithCoords.length === 1) {
                const zoom = target.getZoom();
                if (zoom !== undefined && zoom > MAX_SINGLE_BRANCH_ZOOM) {
                    target.setZoom(MAX_SINGLE_BRANCH_ZOOM);
                }
            }
        },
        [branchesWithCoords, layout]
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
            const name = branchDisplayName(branch, i18n.language);
            const marker = new google.maps.Marker({
                position: { lat: branch.latitude, lng: branch.longitude },
                map,
                title: name,
                label: {
                    text: name,
                    className: "branch-marker-label",
                    color: "#3b352c",
                    fontSize: "13px",
                    fontWeight: "700",
                },
                icon: {
                    url: BRANCH_PIN_URL,
                    scaledSize: new google.maps.Size(PIN_WIDTH, PIN_HEIGHT),
                    // The tip, so the pin points at its branch at every zoom. A badge anchored at
                    // its centre read as sitting lower than the branch. Google's default anchor is
                    // the same point; it is spelled out because it is the whole job of this art.
                    anchor: new google.maps.Point(PIN_WIDTH / 2, PIN_HEIGHT),
                    // Defaults to the image's centre, which would print the name across the head.
                    labelOrigin: new google.maps.Point(PIN_WIDTH / 2, LABEL_OFFSET),
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
        // i18n.language: the labels follow a language switch made while the picker is open.
    }, [map, branchesWithCoords, i18n.language]);

    /**
     * Bounces the pin of the branch currently being described, and only that one — ONCE.
     *
     * Google's {@code Animation.BOUNCE} loops forever until it is cleared, which reads as a pin
     * that will not settle rather than as an answer to "which one did I just tap". A single hop
     * says the same thing and then gets out of the way, so the map goes back to being readable.
     *
     * Runs after the marker effect above, so a freshly built marker set is already in the ref.
     * Clearing the animation on every other pin each time is deliberate: one leftover bouncing
     * marker is worse than none, and there are two of them, not two hundred.
     */
    useEffect(() => {
        for (const [branchId, marker] of markersRef.current) {
            marker.setAnimation(branchId === activeBranchId ? google.maps.Animation.BOUNCE : null);
        }
        if (activeBranchId === null) return;

        // On PC the details open beside the map, so the map brings that branch into view (a
        // "Use nearest branch" pick may be off screen). Phones keep today's behaviour and do not pan.
        if (layout === "dialog" && map !== null) {
            const active = branchesWithCoords.find((branch) => branch.id === activeBranchId);
            if (active !== undefined) map.panTo({ lat: active.latitude, lng: active.longitude });
        }

        // Stopping the loop is what makes it a single hop. The timer is cleared when the
        // selection changes or the view unmounts, so a fast re-tap cannot leave one pin
        // mid-bounce while another starts.
        const timer = window.setTimeout(() => {
            for (const [branchId, marker] of markersRef.current) {
                if (branchId === activeBranchId) marker.setAnimation(null);
            }
        }, ONE_BOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [activeBranchId, branchesWithCoords, map, layout]);

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
