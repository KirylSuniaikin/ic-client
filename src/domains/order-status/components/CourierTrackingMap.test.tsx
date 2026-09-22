import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
// i18n instance (side-effect import) so `orderStatus.courierUpdatedAgo` resolves under English.
import "../../../shared/i18n";

// ONE hoisted mock with mutable state — the shape OrderRouteMap.test.tsx/BranchMapView.test.tsx
// settled on: jest.doMock + resetModules + require would pull a SECOND copy of React while
// `render` drives the first. The `mock` name prefix is what lets a hoisted factory close over
// these without tripping babel-plugin-jest-hoist's out-of-scope check.
const mockLoaderState: { isLoaded: boolean } = { isLoaded: true };

type MockGoogleMapProps = { onLoad?: (map: unknown) => void };

// The component creates its marker against the instance onLoad hands it, so the fake map has to
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

// The Maps key decides whether the component renders at all, and it is a module const read
// from process.env at import time — exposed through a getter so a mutable test value survives
// module hoisting (CourierDispatcherPanel.test.tsx's pattern).
const mockMapsKey: { value: string | undefined } = { value: "test-key" };
jest.mock("../../branch/utils/mapsConfig", () => ({
    get GOOGLE_MAPS_API_KEY(): string | undefined { return mockMapsKey.value; },
    GOOGLE_MAPS_MAP_ID: undefined,
    LIGHT_MAP_STYLES: [],
}));

import { CourierTrackingMap } from "./CourierTrackingMap";
import type { TrackedCourier } from "../types";

type LatLng = { lat: number; lng: number };

type FakeMarkerOptions = { map?: unknown; position?: LatLng; title?: string };

/**
 * A real class rather than a stubbed <Marker> element, for the reason OrderRouteMap's
 * FakeOverlay exists: the bug this pattern guards against is a marker bound to the WRONG map
 * instance, which a mocked React element proves nothing about.
 */
class FakeMarker {
    map: unknown;
    position: LatLng | undefined;
    title: string | undefined;

    constructor(public options: FakeMarkerOptions) {
        this.map = options.map;
        this.position = options.position;
        this.title = options.title;
        mockMarkers.push(this);
    }

    setMap(map: unknown): void {
        this.map = map;
    }

    setPosition(position: LatLng): void {
        this.position = position;
    }
}

/** Records every `extend` call so a test can assert which positions a `fitBounds` call covered. */
class FakeLatLngBounds {
    points: LatLng[] = [];

    extend(position: LatLng): void {
        this.points.push(position);
    }
}

let mockMarkers: FakeMarker[] = [];
let mockSetCenterCalls: LatLng[] = [];
let mockSetZoomCalls: number[] = [];
let mockFitBoundsCalls: FakeLatLngBounds[] = [];
let mockZoomAfterFitBounds: number | undefined;

const mockMapInstance = {
    setCenter: (position: LatLng): void => {
        mockSetCenterCalls.push(position);
    },
    setZoom: (zoom: number): void => {
        mockSetZoomCalls.push(zoom);
    },
    fitBounds: (bounds: FakeLatLngBounds): void => {
        mockFitBoundsCalls.push(bounds);
    },
    getZoom: (): number | undefined => mockZoomAfterFitBounds,
};

function installGoogleStub(): void {
    (globalThis as unknown as { google: unknown }).google = {
        maps: { Marker: FakeMarker, LatLngBounds: FakeLatLngBounds },
    };
}

// Captures every queued frame so a test can drive the interpolation to completion manually,
// rather than depending on a real animation clock. Keyed by call order, not by partIndex — a
// test drives a specific part's glide by indexing into this array in creation/update order.
let rafCallbacks: Array<(t: number) => void> = [];
let rafCallCount = 0;
let cancelledFrames: number[] = [];

function installRafStub(): void {
    (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame })
        .requestAnimationFrame = ((cb: FrameRequestCallback): number => {
            rafCallCount += 1;
            rafCallbacks.push(cb as (t: number) => void);
            return rafCallCount;
        }) as typeof requestAnimationFrame;

    (globalThis as unknown as { cancelAnimationFrame: typeof cancelAnimationFrame })
        .cancelAnimationFrame = ((id: number): void => {
            cancelledFrames.push(id);
        }) as typeof cancelAnimationFrame;
}

beforeAll(() => {
    installGoogleStub();
    installRafStub();
});

function courier(overrides: Partial<TrackedCourier> = {}): TrackedCourier {
    return {
        name: "Ali",
        latitude: 26.2285,
        longitude: 50.586,
        positionAgeSeconds: 10,
        partIndex: 1,
        ...overrides,
    };
}

beforeEach(() => {
    mockLoaderState.isLoaded = true;
    mockMapsKey.value = "test-key";
    mockMarkers = [];
    mockSetCenterCalls = [];
    mockSetZoomCalls = [];
    mockFitBoundsCalls = [];
    mockZoomAfterFitBounds = undefined;
    rafCallbacks = [];
    rafCallCount = 0;
    cancelledFrames = [];
});

describe("CourierTrackingMap", () => {
    it("renders nothing when couriers is empty", () => {
        const { container } = render(<CourierTrackingMap couriers={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing when the mocked loader reports isLoaded: false", () => {
        mockLoaderState.isLoaded = false;
        const { container } = render(<CourierTrackingMap couriers={[courier()]} />);
        expect(container.firstChild).toBeNull();
        expect(mockMarkers).toHaveLength(0);
    });

    it("renders nothing when GOOGLE_MAPS_API_KEY is mocked falsy", () => {
        mockMapsKey.value = undefined;
        const { container } = render(<CourierTrackingMap couriers={[courier()]} />);
        expect(container.firstChild).toBeNull();
        expect(mockMarkers).toHaveLength(0);
    });

    describe("single courier — byte-identical to Phase 1b", () => {
        it("creates exactly one marker bound to the onLoad map instance, at the courier's position, with no animation on the first fix", () => {
            render(<CourierTrackingMap couriers={[courier()]} />);

            expect(mockMarkers).toHaveLength(1);
            expect(mockMarkers[0].map).toBe(mockMapInstance);
            expect(mockMarkers[0].position).toEqual({ lat: 26.2285, lng: 50.586 });
            expect(mockMarkers[0].title).toBe("Ali");
            expect(rafCallbacks).toHaveLength(0);
            expect(mockSetCenterCalls).toEqual([{ lat: 26.2285, lng: 50.586 }]);
            expect(mockSetZoomCalls).toEqual([16]);
        });

        it("requests an animation frame on a coordinate change and ends at the new position", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} />);
            expect(rafCallbacks).toHaveLength(0);

            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.3, longitude: 50.7 })]} />);

            expect(rafCallbacks).toHaveLength(1);
            // Drive the single queued frame straight to completion — a timestamp far past the
            // animation's duration collapses the interpolation fraction to 1 in one call.
            rafCallbacks[0](1_000_000_000);

            expect(mockMarkers[0].position).toEqual({ lat: 26.3, lng: 50.7 });
        });

        it("requests no animation frame on an identical-coordinate update", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} />);

            rerender(<CourierTrackingMap couriers={[courier({ positionAgeSeconds: 25 })]} />);

            expect(rafCallbacks).toHaveLength(0);
            expect(mockMarkers[0].position).toEqual({ lat: 26.2285, lng: 50.586 });
        });

        it("detaches the marker when couriers becomes empty", () => {
            const { rerender, container } = render(<CourierTrackingMap couriers={[courier()]} />);
            const marker = mockMarkers[0];
            expect(marker.map).not.toBeNull();

            rerender(<CourierTrackingMap couriers={[]} />);

            expect(marker.map).toBeNull();
            expect(container.firstChild).toBeNull();
        });

        it("detaches the marker on unmount", () => {
            const { unmount } = render(<CourierTrackingMap couriers={[courier()]} />);
            const marker = mockMarkers[mockMarkers.length - 1];

            unmount();

            expect(marker.map).toBeNull();
        });

        it("always shows the courier's name", () => {
            render(<CourierTrackingMap couriers={[courier({ name: "Fatima" })]} />);
            expect(screen.getByText(/Fatima/)).toBeTruthy();
        });

        it('shows "Updated 1 min ago" once positionAgeSeconds reaches the 60-second threshold', () => {
            render(<CourierTrackingMap couriers={[courier({ positionAgeSeconds: 60 })]} />);
            expect(screen.getByText(/Updated 1 min ago/)).toBeTruthy();
        });

        it("shows no age text below the 60-second threshold", () => {
            render(<CourierTrackingMap couriers={[courier({ positionAgeSeconds: 30 })]} />);
            expect(screen.queryByText(/Updated/)).toBeNull();
        });

        it("shows no part caption / part-number text for a single courier", () => {
            render(<CourierTrackingMap couriers={[courier()]} />);
            expect(screen.queryByTestId(/^courier-caption-/)).toBeNull();
            expect(screen.queryByText(/Part 1/)).toBeNull();
        });
    });

    describe("two or more couriers", () => {
        function courier2(overrides: Partial<TrackedCourier> = {}): TrackedCourier {
            return courier({ name: "Sara", latitude: 26.23, longitude: 50.59, partIndex: 2, ...overrides });
        }

        it("renders two distinct markers bound to the shared map instance, each at its own courier's coordinates", () => {
            render(<CourierTrackingMap couriers={[courier(), courier2()]} />);

            expect(mockMarkers).toHaveLength(2);
            expect(mockMarkers[0].map).toBe(mockMapInstance);
            expect(mockMarkers[0].position).toEqual({ lat: 26.2285, lng: 50.586 });
            expect(mockMarkers[0].title).toBe("Ali — Part 1");
            expect(mockMarkers[1].map).toBe(mockMapInstance);
            expect(mockMarkers[1].position).toEqual({ lat: 26.23, lng: 50.59 });
            expect(mockMarkers[1].title).toBe("Sara — Part 2");
        });

        it("calls fitBounds exactly once with bounds built from every current courier's target position, and never calls setCenter", () => {
            render(<CourierTrackingMap couriers={[courier(), courier2()]} />);

            expect(mockFitBoundsCalls).toHaveLength(1);
            expect(mockFitBoundsCalls[0].points).toEqual([
                { lat: 26.2285, lng: 50.586 },
                { lat: 26.23, lng: 50.59 },
            ]);
            expect(mockSetCenterCalls).toEqual([]);
        });

        it("does not call setCenter during either marker's glide with two markers current", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier(), courier2()]} />);

            rerender(<CourierTrackingMap couriers={[
                courier({ latitude: 26.3, longitude: 50.7 }),
                courier2({ latitude: 26.35, longitude: 50.75 }),
            ]} />);

            expect(rafCallbacks).toHaveLength(2);
            rafCallbacks.forEach((cb) => cb(1_000_000_000));

            expect(mockSetCenterCalls).toEqual([]);
        });

        it("clamps the post-fitBounds zoom to MAX_MULTI_MARKER_ZOOM (16) when the two riders' fixes coincide", () => {
            mockZoomAfterFitBounds = 20;
            render(<CourierTrackingMap couriers={[courier(), courier2({ latitude: 26.2285, longitude: 50.586 })]} />);

            expect(mockSetZoomCalls).toEqual([16]);
        });

        it("does not clamp the zoom when fitBounds already settled within MAX_MULTI_MARKER_ZOOM", () => {
            mockZoomAfterFitBounds = 12;
            render(<CourierTrackingMap couriers={[courier(), courier2()]} />);

            expect(mockSetZoomCalls).toEqual([]);
        });

        it("a part dropping out detaches exactly that marker and leaves the other marker's map non-null, and it is absent from the next fitBounds call", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier(), courier2()]} />);
            const [firstMarker, secondMarker] = mockMarkers;
            mockFitBoundsCalls = [];

            rerender(<CourierTrackingMap couriers={[courier()]} />);

            expect(secondMarker.map).toBeNull();
            expect(firstMarker.map).not.toBeNull();
            // couriers.length is now 1 — the single-marker branch does not call fitBounds at all.
            expect(mockFitBoundsCalls).toHaveLength(0);
        });

        it("a part appearing for the first time (while another already exists) creates a new marker with no animation frame requested for it", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} />);
            expect(mockMarkers).toHaveLength(1);
            rafCallbacks = [];

            rerender(<CourierTrackingMap couriers={[courier(), courier2()]} />);

            expect(mockMarkers).toHaveLength(2);
            expect(mockMarkers[1].position).toEqual({ lat: 26.23, lng: 50.59 });
            expect(rafCallbacks).toHaveLength(0);
        });

        it("two parts' animation frames are independent: resolving only one leaves the other's marker at its pre-glide position", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier(), courier2()]} />);

            rerender(<CourierTrackingMap couriers={[
                courier({ latitude: 26.3, longitude: 50.7 }),
                courier2({ latitude: 26.35, longitude: 50.75 }),
            ]} />);

            expect(rafCallbacks).toHaveLength(2);
            // Resolve only the first part's queued frame.
            rafCallbacks[0](1_000_000_000);

            expect(mockMarkers[0].position).toEqual({ lat: 26.3, lng: 50.7 });
            // The second part's marker never had its frame driven, so it is still at its
            // pre-glide (original) position.
            expect(mockMarkers[1].position).toEqual({ lat: 26.23, lng: 50.59 });
        });

        it("renders each courier's own data-testid caption line using the courierPartCaption copy", () => {
            render(<CourierTrackingMap couriers={[courier(), courier2()]} />);

            expect(screen.getByTestId("courier-caption-1").textContent).toBe("Part 1 · Ali");
            expect(screen.getByTestId("courier-caption-2").textContent).toBe("Part 2 · Sara");
        });

        it("suffixes a caption line with the staleness label once that courier's positionAgeSeconds reaches 60", () => {
            render(<CourierTrackingMap couriers={[courier({ positionAgeSeconds: 60 }), courier2()]} />);

            expect(screen.getByTestId("courier-caption-1").textContent).toBe("Part 1 · Ali · Updated 1 min ago");
            expect(screen.getByTestId("courier-caption-2").textContent).toBe("Part 2 · Sara");
        });
    });
});
