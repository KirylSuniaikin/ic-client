// Per-branch configuration types. Mirrors the backend DTOs in
// backend/.../domain/delivery/dto — keep the two in step; a silent field rename here surfaces as
// an undefined at render time, not as a type error.

/**
 * Mirrors backend `DeliveryZoneTO`. One hand-drawn delivery area.
 *
 * `polygon` is a list of `[longitude, latitude]` pairs — GeoJSON order, which is the order the
 * `delivery_zone.polygon_json` column already stores. It is **lon, lat and not lat, lon**:
 * getting that backwards still parses, and in Bahrain (lat ~26, lon ~50) it silently moves the
 * zone to the other side of the planet, where it covers nothing and the branch quietly stops
 * delivering.
 *
 * The ring is NOT closed — the first point is not repeated at the end; the backend closes it
 * implicitly.
 *
 * A zone whose stored polygon could not be parsed comes back with an EMPTY `polygon` rather than
 * being hidden, so the row blocking delivery is visible and fixable.
 */
export type DeliveryZone = {
    id: string;
    branchId: string | null;
    branchName: string | null;
    name: string;
    polygon: number[][];
    /**
     * An inactive zone is ignored entirely — it neither restricts nor extends coverage — and a
     * branch whose only active zone is switched off falls back to radius-only. That is the
     * intended way to suspend zoning without throwing away the drawing.
     */
    active: boolean;
};

/** Mirrors backend `SaveDeliveryZoneTO`. The id and the branch name are server-owned. */
export type SaveDeliveryZone = {
    branchId: string;
    name: string;
    polygon: number[][];
    active: boolean;
};
