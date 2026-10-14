import type { DeliveryZone } from "../types";

/**
 * A zone being drawn or edited, before it is sent.
 *
 * `polygon` is `[longitude, latitude]` pairs — GeoJSON order, matching the wire format and the
 * stored column. Google's own APIs speak `{lat, lng}`, so the swap happens exactly once, at the
 * map boundary, and nowhere else.
 */
export type DeliveryZoneDraft = {
    /** Null while the zone has never been saved. */
    id: string | null;
    name: string;
    polygon: number[][];
    active: boolean;
};

const MIN_VERTICES = 3;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

/**
 * Everything the server would reject, caught before the request.
 *
 * This is not belt-and-braces duplication of the backend's own check. `DeliveryZoneService` fails
 * **closed**: a polygon it cannot parse covers nothing, and since zones narrow coverage, a saved
 * broken polygon silently stops that branch delivering anywhere, with no symptom other than
 * customers being turned away. The server does validate on the way in — but a save that never
 * leaves the browser is the only version of that failure a manager can see and correct.
 *
 * Returns null when the draft is sendable, or the reason it is not.
 */
export function validateZoneDraft(draft: DeliveryZoneDraft): string | null {
    if (draft.name.trim() === "") {
        return "Give the zone a name.";
    }
    if (draft.polygon.length < MIN_VERTICES) {
        return `A zone needs at least ${MIN_VERTICES} points — tap the map to add them.`;
    }
    for (let i = 0; i < draft.polygon.length; i++) {
        const point = draft.polygon[i];
        if (point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
            return `Point ${i + 1} is not a [longitude, latitude] pair.`;
        }
        // Range-checked because the coordinate ORDER is the mistake that actually happens here.
        // A lat/lon pair the wrong way round still parses, and in Bahrain (lat ~26, lon ~50) it
        // draws the zone in the wrong hemisphere, where it covers nothing.
        if (Math.abs(point[1]) > MAX_LATITUDE || Math.abs(point[0]) > MAX_LONGITUDE) {
            return `Point ${i + 1} is not a valid coordinate.`;
        }
    }
    return null;
}

/** The draft a saved zone starts from, so an edit begins as an exact copy of what is stored. */
export function draftFromZone(zone: DeliveryZone): DeliveryZoneDraft {
    return {
        id: zone.id,
        name: zone.name,
        // Copied element-wise: sharing the loaded zone's arrays would let an edit mutate the row
        // the "unsaved changes" comparison is measured against, which is how a dirty draft comes
        // to look clean.
        polygon: zone.polygon.map((point) => [...point]),
        active: zone.active,
    };
}

/**
 * Whether this draft would change anything.
 *
 * Drives the branch-switch guard, so it has to answer "is there work to lose", not "is the editor
 * open". Opening a saved zone to look at it must not raise a discard prompt.
 */
export function isDraftDirty(draft: DeliveryZoneDraft, zones: DeliveryZone[]): boolean {
    if (draft.id === null) {
        return draft.name.trim() !== "" || draft.polygon.length > 0;
    }
    const original = zones.find((zone) => zone.id === draft.id);
    // A zone that vanished from under the editor (deleted elsewhere) counts as dirty: the draft
    // is now the only copy of that drawing.
    if (original === undefined) return true;

    return draft.name !== original.name
        || draft.active !== original.active
        || !samePolygon(draft.polygon, original.polygon);
}

function samePolygon(a: number[][], b: number[][]): boolean {
    if (a.length !== b.length) return false;
    return a.every((point, i) => point[0] === b[i][0] && point[1] === b[i][1]);
}
