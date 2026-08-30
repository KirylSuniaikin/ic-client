import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render } from "@testing-library/react";

import { DeliveryZoneMap } from "./DeliveryZoneMap";
import type { DeliveryZone } from "../types";

// ONE hoisted mock with mutable state, the shape BranchMapView.test.tsx and OrderRouteMap.test.tsx
// settled on: jest.doMock + resetModules + require pulls a SECOND copy of React while `render`
// drives the first, and every MUI element then hits a null hooks dispatcher.
//
// The `mock` name prefix is what lets a hoisted factory close over these without tripping
// babel-plugin-jest-hoist's out-of-scope check.
const mockLoaderState: { isLoaded: boolean } = { isLoaded: true };

type MockGoogleMapProps = { onLoad?: (map: unknown) => void };

// The component creates its overlays against the instance onLoad hands it, so the fake map has to
// be handed over the same way — a mock that only rendered children would exercise nothing.
jest.mock("@react-google-maps/api", () => {
    // Required inside the factory rather than closed over: babel-plugin-jest-hoist lifts this
    // above the imports, so the module-scope React binding is not initialised yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useEffect } = require("react") as typeof import("react");
    return {
        useJsApiLoader: () => mockLoaderState,
        GoogleMap: ({ onLoad }: MockGoogleMapProps) => {
            useEffect(() => {
                onLoad?.(mockMapInstance);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return <div data-testid="google-map" />;
        },
    };
});

type LatLng = { lat: number; lng: number };

/** A google.maps.LatLng is read through lat()/lng(), never as plain properties. */
function fakeLatLng(lat: number, lng: number): google.maps.LatLng {
    // Cast: the component only ever calls lat()/lng() on these, and building a real LatLng needs
    // the Maps script that this suite deliberately does not load.
    return { lat: () => lat, lng: () => lng } as unknown as google.maps.LatLng;
}

/**
 * A real MVCArray-alike rather than a stub, because the invariant under test is that the overlay
 * OWNS the path during an edit session: the component pushes into it, listens to it, and reads it
 * back. A path that only recorded calls would prove none of that.
 */
class FakePath {
    private points: google.maps.LatLng[];
    readonly listeners = new Map<string, Array<() => void>>();

    constructor(initial: google.maps.LatLng[]) {
        this.points = [...initial];
    }

    getArray(): google.maps.LatLng[] { return this.points; }

    push(point: google.maps.LatLng): void {
        this.points.push(point);
        this.fire("insert_at");
    }

    removeAt(index: number): void {
        this.points.splice(index, 1);
        this.fire("remove_at");
    }

    addListener(event: string, handler: () => void): { remove: () => void } {
        const handlers = this.listeners.get(event) ?? [];
        handlers.push(handler);
        this.listeners.set(event, handlers);
        return { remove: () => undefined };
    }

    fire(event: string): void {
        for (const handler of this.listeners.get(event) ?? []) handler();
    }
}

type FakePolygonOptions = {
    map?: unknown;
    paths?: LatLng[];
    editable?: boolean;
    strokeColor?: string;
    fillOpacity?: number;
    zIndex?: number;
};

const mockPolygons: FakePolygon[] = [];

class FakePolygon {
    map: unknown;
    private readonly path: FakePath;
    readonly handlers = new Map<string, Array<(event: unknown) => void>>();

    constructor(public options: FakePolygonOptions) {
        this.map = options.map;
        this.path = new FakePath((options.paths ?? []).map((p) => fakeLatLng(p.lat, p.lng)));
        mockPolygons.push(this);
    }

    getPath(): FakePath { return this.path; }

    setMap(map: unknown): void { this.map = map; }

    addListener(event: string, handler: (event: unknown) => void): { remove: () => void } {
        const handlers = this.handlers.get(event) ?? [];
        handlers.push(handler);
        this.handlers.set(event, handlers);
        return { remove: () => undefined };
    }
}

type FakeCircleOptions = {
    map?: unknown;
    center?: LatLng;
    radius?: number;
    clickable?: boolean;
    zIndex?: number;
};

const mockCircles: FakeCircle[] = [];

/**
 * The radius overlay. Same shape as FakePolygon and for the same reason: the component builds it
 * against the map instance `onLoad` handed it, so anything that only recorded a render would
 * prove nothing about which map it landed on.
 */
class FakeCircle {
    map: unknown;

    constructor(public options: FakeCircleOptions) {
        this.map = options.map;
        mockCircles.push(this);
    }

    setMap(map: unknown): void { this.map = map; }
}

/** Handlers the component registered on the MAP itself — the click that appends a vertex. */
const mockMapHandlers = new Map<string, Array<(event: unknown) => void>>();

const mockMapInstance = {
    fitBounds: (): void => {},
    setCenter: (): void => {},
    setZoom: (): void => {},
    getZoom: (): number => 12,
    addListener: (event: string, handler: (e: unknown) => void): { remove: () => void } => {
        const handlers = mockMapHandlers.get(event) ?? [];
        handlers.push(handler);
        mockMapHandlers.set(event, handlers);
        return { remove: () => undefined };
    },
};

function clickMapAt(lat: number, lng: number): void {
    for (const handler of mockMapHandlers.get("click") ?? []) {
        handler({ latLng: fakeLatLng(lat, lng) });
    }
}

// The component reaches for the `google` global — LatLngBounds to fit the view, Polygon to draw.
// In the app that global is guaranteed by the time it renders, because useJsApiLoader only
// reports isLoaded once the script is in place; under test the mocked loader reports isLoaded
// with no script behind it, so the global has to be stubbed here.
function installGoogleStub(): void {
    (globalThis as unknown as { google: unknown }).google = {
        maps: {
            LatLngBounds: class {
                extend(): void {}
            },
            Polygon: FakePolygon,
            Circle: FakeCircle,
            event: {
                addListenerOnce: (): Record<string, never> => ({}),
                removeListener: (): void => {},
                clearInstanceListeners: (): void => {},
            },
        },
    };
}

beforeAll(installGoogleStub);

// [longitude, latitude] — GeoJSON order, as the wire and the column both store it.
const TRIANGLE: number[][] = [[50.57, 26.21], [50.59, 26.21], [50.58, 26.24]];

const OTHER_ZONE: DeliveryZone = {
    id: "z2", branchId: "b1", branchName: "Manama", name: "South",
    polygon: [[50.5, 26.1], [50.6, 26.1], [50.55, 26.15]], active: true,
};

beforeEach(() => {
    mockLoaderState.isLoaded = true;
    mockPolygons.length = 0;
    mockCircles.length = 0;
    mockMapHandlers.clear();
});

function renderMap(props: Partial<React.ComponentProps<typeof DeliveryZoneMap>> = {}): {
    onPolygonChange: ReturnType<typeof jest.fn<void, [number[][]]>>;
    unmount: () => void;
    rerender: (next: Partial<React.ComponentProps<typeof DeliveryZoneMap>>) => void;
} {
    const onPolygonChange = jest.fn<void, [number[][]]>();
    const base: React.ComponentProps<typeof DeliveryZoneMap> = {
        zones: [],
        editingZoneId: null,
        editing: true,
        sessionKey: "new-1",
        initialPolygon: [],
        onPolygonChange,
        center: { lat: 26.22, lng: 50.58 },
        radiusKm: 7,
        ...props,
    };
    const view = render(<DeliveryZoneMap {...base} />);
    return {
        onPolygonChange,
        unmount: view.unmount,
        rerender: (next) => view.rerender(<DeliveryZoneMap {...base} {...next} />),
    };
}

describe("DeliveryZoneMap", () => {
    /**
     * The regression BranchMapView's imperative markers exist for: under React 18 StrictMode
     * <GoogleMap> builds a SECOND google.maps.Map, and any overlay bound to the first, discarded
     * one is invisible while the map on screen is the second — a working map with nothing drawn on
     * it, in dev only.
     */
    it("binds every polygon to the map instance onLoad supplied", () => {
        renderMap({ zones: [OTHER_ZONE] });

        expect(mockPolygons.length).toBeGreaterThan(0);
        for (const polygon of mockPolygons) expect(polygon.map).toBe(mockMapInstance);
    });

    /** Google speaks {lat, lng}; the wire is [lon, lat]. The swap happens here and nowhere else. */
    it("seeds the editable overlay from [longitude, latitude] pairs", () => {
        renderMap({ initialPolygon: TRIANGLE });

        const editable = mockPolygons.find((polygon) => polygon.options.editable === true);
        expect(editable?.options.paths).toEqual([
            { lat: 26.21, lng: 50.57 },
            { lat: 26.21, lng: 50.59 },
            { lat: 26.24, lng: 50.58 },
        ]);
    });

    /** Tapping the map is how a zone is drawn at all, with no `drawing` library involved. */
    it("appends a vertex on a map click and reports it back in [longitude, latitude] order", () => {
        const { onPolygonChange } = renderMap({ initialPolygon: TRIANGLE });

        clickMapAt(26.25, 50.6);

        expect(onPolygonChange).toHaveBeenLastCalledWith([...TRIANGLE, [50.6, 26.25]]);
    });

    /** Dragging a vertex is Google's own gesture; the draft has to hear about it. */
    it("reports a dragged vertex through the path's set_at event", () => {
        const { onPolygonChange } = renderMap({ initialPolygon: TRIANGLE });

        const editable = mockPolygons.find((polygon) => polygon.options.editable === true);
        editable?.getPath().fire("set_at");

        expect(onPolygonChange).toHaveBeenLastCalledWith(TRIANGLE);
    });

    /** Right-click is Google's delete gesture; without it a mis-placed point can only be cleared. */
    it("removes the right-clicked vertex", () => {
        const { onPolygonChange } = renderMap({ initialPolygon: TRIANGLE });

        const editable = mockPolygons.find((polygon) => polygon.options.editable === true);
        for (const handler of editable?.handlers.get("rightclick") ?? []) handler({ vertex: 1 });

        expect(onPolygonChange).toHaveBeenLastCalledWith([TRIANGLE[0], TRIANGLE[2]]);
    });

    /**
     * The overlay is UNCONTROLLED during a session. Re-seeding it from the prop on every reported
     * change would rebuild the shape under the finger that is dragging it — so a changed
     * `initialPolygon` alone must NOT rebuild anything.
     */
    it("does not rebuild the editable overlay when only the polygon prop changes", () => {
        const { rerender } = renderMap({ initialPolygon: TRIANGLE });
        const before = mockPolygons.filter((polygon) => polygon.options.editable === true).length;

        rerender({ initialPolygon: [...TRIANGLE, [50.6, 26.25]] });

        expect(mockPolygons.filter((polygon) => polygon.options.editable === true))
            .toHaveLength(before);
    });

    /** Undo, clear and opening a different zone all go through the session key — and must rebuild. */
    it("rebuilds the editable overlay from the polygon when the session changes", () => {
        const { rerender } = renderMap({ initialPolygon: TRIANGLE });

        rerender({ initialPolygon: [[50.5, 26.2]], sessionKey: "new-2" });

        const editables = mockPolygons.filter((polygon) => polygon.options.editable === true);
        expect(editables).toHaveLength(2);
        expect(editables[1].options.paths).toEqual([{ lat: 26.2, lng: 50.5 }]);
        // The abandoned overlay is detached, so the old shape does not linger on the map.
        expect(editables[0].map).toBeNull();
    });

    /** Drawn twice — once read-only, once editable — the zone under edit would double up. */
    it("leaves the zone being edited out of the read-only layer", () => {
        renderMap({ zones: [OTHER_ZONE], editingZoneId: OTHER_ZONE.id, initialPolygon: OTHER_ZONE.polygon });

        expect(mockPolygons.filter((polygon) => polygon.options.editable !== true)).toHaveLength(0);
    });

    /** An inactive zone restricts nothing, so it must not be drawn as though it were coverage. */
    it("draws an inactive zone differently from an active one", () => {
        renderMap({ zones: [OTHER_ZONE, { ...OTHER_ZONE, id: "z3", active: false }], editing: false });

        const [active, inactive] = mockPolygons;
        expect(active.options.strokeColor).not.toBe(inactive.options.strokeColor);
        expect(inactive.options.fillOpacity).toBeLessThan(active.options.fillOpacity ?? 1);
    });

    it("draws no editable overlay when the editor is closed", () => {
        renderMap({ zones: [OTHER_ZONE], editing: false });

        expect(mockPolygons.filter((polygon) => polygon.options.editable === true)).toHaveLength(0);
    });
});

/**
 * The delivery radius (admin item 5). It was computed on every availability check and serialised
 * to nobody, so "a zone narrows the radius, it never extends it" was something a manager could be
 * told and never see.
 */
describe("DeliveryZoneMap — the delivery radius", () => {
    it("draws the radius as a circle on the map instance onLoad supplied", () => {
        renderMap({ radiusKm: 7, center: { lat: 26.22, lng: 50.58 } });

        expect(mockCircles).toHaveLength(1);
        expect(mockCircles[0].map).toBe(mockMapInstance);
        expect(mockCircles[0].options.center).toEqual({ lat: 26.22, lng: 50.58 });
    });

    /** Google speaks metres and the branch payload speaks kilometres. */
    it("converts kilometres to the metres Google expects", () => {
        renderMap({ radiusKm: 7 });

        expect(mockCircles[0].options.radius).toBe(7000);
    });

    /**
     * Not cosmetic. A clickable overlay swallows the map click that appends a vertex, so a
     * clickable circle would silently break drawing across the whole radius — which is exactly
     * the area every zone is drawn in.
     */
    it("does not intercept the map clicks that draw a zone", () => {
        const { onPolygonChange } = renderMap({ radiusKm: 7, initialPolygon: TRIANGLE });

        expect(mockCircles[0].options.clickable).toBe(false);

        clickMapAt(26.25, 50.6);
        expect(onPolygonChange).toHaveBeenLastCalledWith([...TRIANGLE, [50.6, 26.25]]);
    });

    /** Under the polygons: the radius is the ground the zones sit on, not a fourth zone. */
    it("sits beneath both polygon layers", () => {
        renderMap({ radiusKm: 7, zones: [OTHER_ZONE], initialPolygon: TRIANGLE });

        const circleZ = mockCircles[0].options.zIndex ?? 0;
        for (const polygon of mockPolygons) {
            expect(polygon.options.zIndex ?? 0).toBeGreaterThan(circleZ);
        }
    });

    /**
     * A branch object that never came from a branch fetch has no radius. An invented circle would
     * be drawn in the wrong place and then have zones drawn against it, which is worse than none.
     */
    it("draws nothing when the branch has no radius", () => {
        renderMap({ radiusKm: null });

        expect(mockCircles).toHaveLength(0);
    });

    it("draws nothing when the branch has no coordinates to centre it on", () => {
        renderMap({ radiusKm: 7, center: null });

        expect(mockCircles).toHaveLength(0);
    });

    /** Same cleanup contract as the polygons — an orphaned overlay outlives its map. */
    it("detaches the circle on unmount", () => {
        const { unmount } = renderMap({ radiusKm: 7 });

        unmount();

        expect(mockCircles[0].map).toBeNull();
    });
});
