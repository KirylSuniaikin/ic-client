import { useCallback } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID } from "../../branch/utils/mapsConfig";
import { logger } from "../../../shared/utils/logger";

/** The Bahrain parts the courier actually reads off an address. */
export type GeocodedAddress = {
    block: string | null;
    road: string | null;
    building: string | null;
};

/**
 * Turns a dropped pin into street parts.
 *
 * Why it exists: "use my location" saved an address carrying nothing but coordinates, so the
 * courier's card read "No address" and the confirm sheet fell back to "Pinned location". The pin
 * is enough to navigate, but the rider still has to find a door.
 *
 * Prefill, never replace: whatever the customer typed wins. A reverse geocode is a good guess at
 * a building, not the truth about which flat someone lives in.
 *
 * Loaded with exactly the options BranchMapView uses — useJsApiLoader is a singleton, and calling
 * it with a different shape warns and refuses to reload.
 */
export function useReverseGeocode(): (
    latitude: number,
    longitude: number,
) => Promise<GeocodedAddress | null> {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
        ...(GOOGLE_MAPS_MAP_ID ? { mapIds: [GOOGLE_MAPS_MAP_ID] } : {}),
    });

    return useCallback(async (latitude: number, longitude: number): Promise<GeocodedAddress | null> => {
        if (!isLoaded || typeof google === "undefined") return null;
        try {
            const { results } = await new google.maps.Geocoder().geocode({
                location: { lat: latitude, lng: longitude },
            });
            const best = results.at(0);
            if (best === undefined) return null;

            const part = (type: string): string | null =>
                best.address_components.find((component) => component.types.includes(type))?.long_name ?? null;

            return {
                // Bahrain's own addressing maps onto Google's components like this: a block is a
                // neighbourhood, a road is a route, a building is the street number.
                block: part("neighborhood") ?? part("sublocality") ?? null,
                road: part("route"),
                building: part("street_number") ?? part("premise"),
            };
        } catch (error) {
            // Never fatal: the pin alone still routes the courier, and a failed guess must not
            // stop the customer saving the address.
            logger.error("Reverse geocode failed:", error);
            return null;
        }
    }, [isLoaded]);
}
