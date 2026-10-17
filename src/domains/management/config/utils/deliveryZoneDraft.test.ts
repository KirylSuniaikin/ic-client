import { describe, it, expect } from "@jest/globals";
import { draftFromZone, isDraftDirty, validateZoneDraft } from "./deliveryZoneDraft";
import type { DeliveryZoneDraft } from "./deliveryZoneDraft";
import type { DeliveryZone } from "../types";

// A small triangle around Manama, in [longitude, latitude] — GeoJSON order, as the wire and the
// column both store it.
const TRIANGLE: number[][] = [[50.57, 26.21], [50.59, 26.21], [50.58, 26.24]];

function draft(overrides: Partial<DeliveryZoneDraft> = {}): DeliveryZoneDraft {
    return { id: null, name: "North", polygon: TRIANGLE, active: true, ...overrides };
}

function zone(overrides: Partial<DeliveryZone> = {}): DeliveryZone {
    return {
        id: "z1", branchId: "b1", branchName: "Manama", name: "North",
        polygon: TRIANGLE.map((point) => [...point]), active: true,
        ...overrides,
    };
}

describe("validateZoneDraft", () => {
    it("accepts a closed-enough ring of three named points", () => {
        expect(validateZoneDraft(draft())).toBeNull();
    });

    /**
     * The reason this validation exists at all. DeliveryZoneService fails CLOSED — a polygon it
     * cannot parse covers nothing — and zones NARROW coverage, so a two-point "zone" saved
     * against a branch stops it delivering anywhere, with no symptom other than customers being
     * turned away.
     */
    it("refuses a polygon with fewer than three points", () => {
        expect(validateZoneDraft(draft({ polygon: [[50.57, 26.21], [50.59, 26.21]] })))
            .toBe("A zone needs at least 3 points — tap the map to add them.");
        expect(validateZoneDraft(draft({ polygon: [] }))).not.toBeNull();
    });

    it("refuses a nameless zone", () => {
        expect(validateZoneDraft(draft({ name: "   " }))).toBe("Give the zone a name.");
    });

    /**
     * The coordinate ORDER is the mistake that actually happens here. A lat/lon pair the wrong way
     * round still parses — in Bahrain a longitude of 26 is perfectly legal — so only the blatant
     * half is catchable, and this is it: a latitude of 150 cannot exist.
     */
    it("refuses a point whose latitude is out of range", () => {
        const swapped = [[50.57, 26.21], [50.59, 26.21], [26.24, 150.58]];
        expect(validateZoneDraft(draft({ polygon: swapped })))
            .toBe("Point 3 is not a valid coordinate.");
    });

    it("refuses a longitude beyond 180", () => {
        const bad = [[50.57, 26.21], [50.59, 26.21], [200.1, 26.24]];
        expect(validateZoneDraft(draft({ polygon: bad }))).toBe("Point 3 is not a valid coordinate.");
    });

    it("refuses a point that is not a pair, or carries a non-finite number", () => {
        expect(validateZoneDraft(draft({ polygon: [[50.57, 26.21], [50.59, 26.21], [50.58]] })))
            .toBe("Point 3 is not a [longitude, latitude] pair.");
        expect(validateZoneDraft(draft({ polygon: [[50.57, 26.21], [50.59, 26.21], [NaN, 26.24]] })))
            .toBe("Point 3 is not a [longitude, latitude] pair.");
    });
});

describe("draftFromZone", () => {
    /**
     * The draft must not share array identity with the loaded zone: an edit that mutated the row
     * the dirty comparison is measured against would make a changed draft look clean.
     */
    it("copies the polygon rather than aliasing the loaded zone's arrays", () => {
        const loaded = zone();
        const copy = draftFromZone(loaded);

        copy.polygon[0][0] = 0;

        expect(loaded.polygon[0][0]).toBe(50.57);
        expect(isDraftDirty(copy, [loaded])).toBe(true);
    });
});

describe("isDraftDirty", () => {
    /** Opening a saved zone just to look at it is not work to lose, so it must not prompt. */
    it("is clean when an untouched saved zone is open", () => {
        const loaded = zone();
        expect(isDraftDirty(draftFromZone(loaded), [loaded])).toBe(false);
    });

    it("is dirty once a vertex moves", () => {
        const loaded = zone();
        const moved = draftFromZone(loaded);
        moved.polygon[1] = [50.6, 26.22];

        expect(isDraftDirty(moved, [loaded])).toBe(true);
    });

    it("is dirty when the name or the active flag changes", () => {
        const loaded = zone();
        expect(isDraftDirty({ ...draftFromZone(loaded), name: "South" }, [loaded])).toBe(true);
        expect(isDraftDirty({ ...draftFromZone(loaded), active: false }, [loaded])).toBe(true);
    });

    it("is dirty when a point is added or removed", () => {
        const loaded = zone();
        const shorter = { ...draftFromZone(loaded), polygon: TRIANGLE.slice(0, 2) };
        expect(isDraftDirty(shorter, [loaded])).toBe(true);
    });

    /** A brand-new zone nobody has touched yet is nothing to lose either. */
    it("is clean for an empty new zone and dirty after the first point or letter", () => {
        expect(isDraftDirty({ id: null, name: "", polygon: [], active: true }, [])).toBe(false);
        expect(isDraftDirty({ id: null, name: "N", polygon: [], active: true }, [])).toBe(true);
        expect(isDraftDirty({ id: null, name: "", polygon: [[50.5, 26.2]], active: true }, [])).toBe(true);
    });

    /** A zone deleted from under the editor leaves the draft as the only copy of the drawing. */
    it("is dirty when the zone it was opened from has disappeared", () => {
        expect(isDraftDirty(draftFromZone(zone()), [])).toBe(true);
    });
});
