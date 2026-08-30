import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";

import { OrderRouteMap } from "./OrderRouteMap";
import type { OrderRoute } from "../types";

// ONE hoisted mock with mutable state, the shape BranchMapView.test.tsx settled on: jest.doMock +
// resetModules + require pulls a SECOND copy of React while `render` drives the first, and every
// MUI element in the not-loaded branch then hits a null hooks dispatcher.
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

/**
 * Real classes rather than a stubbed <Polyline>/<Marker> element, for the reason BranchMapView's
 * FakeMarker exists: the bug this pattern guards against is an overlay bound to the WRONG map
 * instance, which a mocked React element proves nothing about.
 */
class FakeOverlay {
    map: unknown;

    constructor(public options: { map?: unknown }) {
        this.map = options.map;
    }

    setMap(map: unknown): void {
        this.map = map;
    }
}

const mockPolylines: FakePolyline[] = [];
const mockMarkers: FakeMarker[] = [];

type FakePolylineOptions = { map?: unknown; path?: LatLng[]; strokeOpacity?: number; icons?: unknown[] };
class FakePolyline extends FakeOverlay {
    constructor(public polylineOptions: FakePolylineOptions) {
        super(polylineOptions);
        mockPolylines.push(this);
    }
}

type FakeMarkerOptions = { map?: unknown; position?: LatLng; title?: string };
class FakeMarker extends FakeOverlay {
    constructor(public markerOptions: FakeMarkerOptions) {
        super(markerOptions);
        mockMarkers.push(this);
    }
}

/** Every position the component fed to fitBounds, so the "fits everything" claim is checkable. */
const mockExtended: LatLng[] = [];
let mockFitBoundsCalls = 0;

const mockMapInstance = {
    fitBounds: (): void => {
        mockFitBoundsCalls += 1;
    },
    getZoom: (): number => 20,
    setZoom: (): void => {},
};

// The component reaches for the `google` global — LatLngBounds to fit the view, Polyline/Marker
// to draw. In the app that global is guaranteed by the time it renders, because useJsApiLoader
// only reports isLoaded once the script is in place; under test the mocked loader reports
// isLoaded with no script behind it, so the global has to be stubbed here.
function installGoogleStub(): void {
    (globalThis as unknown as { google: unknown }).google = {
        maps: {
            LatLngBounds: class {
                extend(position: LatLng): void {
                    mockExtended.push(position);
                }
            },
            Polyline: FakePolyline,
            Marker: FakeMarker,
            SymbolPath: { CIRCLE: "CIRCLE" },
            event: {
                addListenerOnce: (): Record<string, never> => ({}),
                removeListener: (): void => {},
                clearInstanceListeners: (): void => {},
            },
        },
    };
}

beforeAll(installGoogleStub);

const DESTINATION = { latitude: 26.2285, longitude: 50.586, recordedAt: null };

function route(overrides: Partial<OrderRoute> = {}): OrderRoute {
    return {
        orderId: 42,
        orderNo: 7,
        waitTimeMinutes: 3,
        travelTimeMinutes: 12,
        serviceTimeMinutes: null,
        geofenceWarning: false,
        geofenceDistanceM: null,
        geofenceOverridden: null,
        destination: DESTINATION,
        // The default case is an order that never reached hand-over, so the pickup marker is
        // opt-in per test rather than always present.
        pickup: null,
        // Oldest first, exactly as the backend serves them.
        points: [
            { latitude: 26.21, longitude: 50.57, recordedAt: "2026-08-08T09:55:00Z" },
            { latitude: 26.22, longitude: 50.58, recordedAt: "2026-08-08T10:01:00Z" },
            { latitude: 26.2284, longitude: 50.5859, recordedAt: "2026-08-08T10:09:00Z" },
        ],
        ...overrides,
    };
}

beforeEach(() => {
    mockLoaderState.isLoaded = true;
    mockPolylines.length = 0;
    mockMarkers.length = 0;
    mockExtended.length = 0;
    mockFitBoundsCalls = 0;
});

describe("OrderRouteMap", () => {
    /** The whole point of the change: the trail is a line through the breadcrumbs, in order. */
    it("draws the trail as one polyline through every point, oldest first", () => {
        render(<OrderRouteMap route={route()} />);

        const trail = mockPolylines[0];
        expect(trail.polylineOptions.path).toEqual([
            { lat: 26.21, lng: 50.57 },
            { lat: 26.22, lng: 50.58 },
            { lat: 26.2284, lng: 50.5859 },
        ]);
    });

    // The regression BranchMapView's FakeMarker exists for: an overlay bound to anything other
    // than the map the component was handed is invisible on screen.
    it("binds every overlay to the map instance onLoad supplied", () => {
        render(<OrderRouteMap route={route()} />);

        expect(mockPolylines.length).toBeGreaterThan(0);
        expect(mockMarkers.length).toBeGreaterThan(0);
        for (const overlay of [...mockPolylines, ...mockMarkers]) {
            expect(overlay.map).toBe(mockMapInstance);
        }
    });

    it("marks the first fix, the drop-off and the customer's pin", () => {
        render(<OrderRouteMap route={route()} />);

        const titles = mockMarkers.map((marker) => marker.markerOptions.title);
        expect(titles).toEqual([
            "First fix · 12:55",
            "Drop-off · 13:09",
            "Customer's pin",
        ]);
    });

    /**
     * The hand-over is the one thing the trail cannot show on its own: the drive to the kitchen
     * and the drive to the customer are a single unbroken line, and the pickup marker is the join
     * between them.
     */
    it("marks the pickup the server picked, between the drop-off and the customer's pin", () => {
        render(
            <OrderRouteMap
                route={route({
                    pickup: { latitude: 26.22, longitude: 50.58, recordedAt: "2026-08-08T10:01:00Z" },
                })}
            />
        );

        const titles = mockMarkers.map((marker) => marker.markerOptions.title);
        expect(titles).toEqual([
            "First fix · 12:55",
            "Drop-off · 13:09",
            "Picked up · 13:01",
            "Customer's pin",
        ]);
        expect(mockMarkers[2].markerOptions.position).toEqual({ lat: 26.22, lng: 50.58 });
    });

    /**
     * Null means the order never reached hand-over, or that no sample was recorded against it. A
     * marker at the wrong end of the run is worse than no marker, so nothing is guessed.
     */
    it("draws no pickup marker when the server could not place one", () => {
        render(<OrderRouteMap route={route({ pickup: null })} />);

        const titles = mockMarkers.map((marker) => marker.markerOptions.title);
        expect(titles).toEqual(["First fix · 12:55", "Drop-off · 13:09", "Customer's pin"]);
        expect(screen.queryByText("Picked up")).toBeNull();
    });

    /**
     * recordedAt is a UTC instant carrying a `Z`, unlike every other delivery timestamp (naive
     * Bahrain-local). toEpochMsBahrain detects the offset instead of appending one, so 09:55Z has
     * to read as 12:55 Bahrain — not 09:55 (raw) and not 15:55 (offset applied twice).
     */
    it("renders a UTC recordedAt at Bahrain wall-clock without double-shifting it", () => {
        render(<OrderRouteMap route={route()} />);

        const first = mockMarkers[0].markerOptions.title;
        expect(first).toContain("12:55");
        expect(first).not.toContain("09:55");
        expect(first).not.toContain("15:55");
    });

    it("fits the view to every point and the customer's pin, not just the first", () => {
        render(<OrderRouteMap route={route()} />);

        expect(mockFitBoundsCalls).toBeGreaterThan(0);
        expect(mockExtended).toEqual([
            { lat: 26.21, lng: 50.57 },
            { lat: 26.22, lng: 50.58 },
            { lat: 26.2284, lng: 50.5859 },
            { lat: 26.2285, lng: 50.586 },
        ]);
    });

    /**
     * A courier whose phone never reported is a real failure — the one the courier app was just
     * hardened against. An empty map would read as a short but fine route, so it has to say the
     * track is missing and draw no map at all.
     */
    it("says no track was recorded rather than drawing an empty map", () => {
        render(<OrderRouteMap route={route({ points: [] })} />);

        expect(screen.getByText(/No track recorded/)).toBeTruthy();
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(mockPolylines).toHaveLength(0);
        expect(mockMarkers).toHaveLength(0);
    });

    /** One fix is not a trail: a polyline through it draws nothing, and "first" implies a missing last. */
    it("draws no trail for a single point and does not call it a start", () => {
        render(<OrderRouteMap route={route({ points: [{ latitude: 26.21, longitude: 50.57, recordedAt: null }] })} />);

        expect(mockPolylines).toHaveLength(0);
        expect(mockMarkers.map((marker) => marker.markerOptions.title)).toEqual([
            "Only recorded fix · —",
            "Customer's pin",
        ]);
    });

    /**
     * A drop-off logged away from the customer's pin is exactly what a manager investigating a
     * complaint is looking for, so the gap is drawn as a gap — recorded, never an error state.
     */
    it("connects the drop-off to the customer's pin only when the server flagged the distance", () => {
        render(<OrderRouteMap route={route({ geofenceWarning: false })} />);
        expect(mockPolylines).toHaveLength(1);

        mockPolylines.length = 0;
        render(<OrderRouteMap route={route({ geofenceWarning: true, geofenceDistanceM: 180 })} />);

        expect(mockPolylines).toHaveLength(2);
        expect(mockPolylines[1].polylineOptions.path).toEqual([
            { lat: 26.2284, lng: 50.5859 },
            { lat: 26.2285, lng: 50.586 },
        ]);
    });

    it("detaches every overlay when the route changes, so a stale trail never lingers", () => {
        const { rerender } = render(<OrderRouteMap route={route()} />);
        const stale = [...mockPolylines, ...mockMarkers];

        rerender(
            <OrderRouteMap
                route={route({ points: [{ latitude: 26.3, longitude: 50.6, recordedAt: null }] })}
            />
        );

        for (const overlay of stale) expect(overlay.map).toBeNull();
    });

    it("shows a loading state while the script has not loaded yet", () => {
        mockLoaderState.isLoaded = false;

        render(<OrderRouteMap route={route()} />);

        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(mockPolylines).toHaveLength(0);
    });
});
