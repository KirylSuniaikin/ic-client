import type { Coordinates } from "../types";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometers (mean Earth radius 6371 km). Local computation only —
 * both the backend and this picker deliberately avoid a paid Distance Matrix API. */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

    return EARTH_RADIUS_KM * c;
}
