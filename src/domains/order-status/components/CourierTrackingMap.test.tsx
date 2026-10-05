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

type MockMapOptions = {
    gestureHandling?: string;
    headingInteractionEnabled?: boolean | null;
    tiltInteractionEnabled?: boolean | null;
};
type MockGoogleMapProps = { onLoad?: (map: unknown) => void; options?: MockMapOptions };

// Every `options` object GoogleMap was rendered with, in render order — the gesture mode is only
// observable through it, and comparing identities across renders is what proves the memo holds.
let mockRenderedOptions: Array<MockMapOptions | undefined> = [];

// The component creates its marker against the instance onLoad hands it, so the fake map has to
// be handed over the same way — a mock that only rendered children would exercise nothing.
jest.mock("@react-google-maps/api", () => {
    // Required inside the factory rather than closed over: babel-plugin-jest-hoist lifts this
    // above the imports, so the module-scope React binding is not initialised yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useEffect } = require("react") as typeof import("react");
    return {
        useJsApiLoader: () => mockLoaderState,
        GoogleMap: ({ onLoad, options }: MockGoogleMapProps) => {
            mockRenderedOptions.push(options);
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
import type { TrackedCourier, TrackingDestination } from "../types";

type LatLng = { lat: number; lng: number };

class FakeSize {
    constructor(public width: number, public height: number) {}
}

class FakePoint {
    constructor(public x: number, public y: number) {}
}

type FakeIcon = { url: string; scaledSize?: FakeSize; anchor?: FakePoint };

type FakeMarkerOptions = {
    map?: unknown;
    position?: LatLng;
    title?: string;
    icon?: FakeIcon;
    zIndex?: number;
    optimized?: boolean;
};

/**
 * A real class rather than a stubbed <Marker> element, for the reason OrderRouteMap's
 * FakeOverlay exists: the bug this pattern guards against is a marker bound to the WRONG map
 * instance, which a mocked React element proves nothing about.
 */
class FakeMarker {
    map: unknown;
    position: LatLng | undefined;
    title: string | undefined;
    icon: FakeIcon | undefined;
    setIconCalls = 0;

    constructor(public options: FakeMarkerOptions) {
        this.map = options.map;
        this.position = options.position;
        this.title = options.title;
        this.icon = options.icon;
        mockMarkers.push(this);
    }

    setMap(map: unknown): void {
        this.map = map;
    }

    setPosition(position: LatLng): void {
        this.position = position;
    }

    setIcon(icon: FakeIcon): void {
        this.icon = icon;
        this.setIconCalls += 1;
    }

    setTitle(title: string): void {
        this.title = title;
    }
}

/** The angle drawn into the moped's SVG — what the customer actually sees the moped turned to. */
function rotationOf(marker: FakeMarker): number {
    const url = marker.icon?.url ?? "";
    const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    const match = /rotate\((\d+) 20 20\)/.exec(svg);
    if (match === null) throw new Error(`no rotation in icon ${url.slice(0, 60)}`);
    return Number(match[1]);
}

const HOME_TITLE = "Your address";

function mopeds(): FakeMarker[] {
    return mockMarkers.filter((marker) => marker.title !== HOME_TITLE);
}

function homeMarker(): FakeMarker | undefined {
    return mockMarkers.find((marker) => marker.title === HOME_TITLE);
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
        maps: { Marker: FakeMarker, LatLngBounds: FakeLatLngBounds, Size: FakeSize, Point: FakePoint },
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
        bearingDegrees: null,
        etaSeconds: null,
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
    mockRenderedOptions = [];
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

    describe("single courier, no home pin — the camera follows it, as in Phase 1b", () => {
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

        it("shows the age in seconds below the 60-second threshold, so a fresh fix reads as live", () => {
            render(<CourierTrackingMap couriers={[courier({ positionAgeSeconds: 30 })]} />);
            expect(screen.getByTestId("courier-updated-1").textContent).toBe("Updated 30 s ago");
        });

        it("shows no part-number text for a single courier", () => {
            render(<CourierTrackingMap couriers={[courier()]} />);
            expect(screen.getByTestId("courier-caption-1").textContent).toBe("Ali is on the way");
            expect(screen.queryByText(/Part 1/)).toBeNull();
        });
    });

    describe("gesture handling", () => {
        it('keeps one-finger "greedy" panning by default, so the status page is unchanged', () => {
            render(<CourierTrackingMap couriers={[courier()]} />);

            expect(mockRenderedOptions[mockRenderedOptions.length - 1]?.gestureHandling).toBe("greedy");
        });

        it('passes "cooperative" through when the caller asks for it', () => {
            render(<CourierTrackingMap couriers={[courier()]} gestureHandling="cooperative" />);

            expect(mockRenderedOptions[mockRenderedOptions.length - 1]?.gestureHandling).toBe("cooperative");
        });

        // The moped's turn is drawn relative to north, so a twist that rotated the roads under it
        // would point it off its street — whatever the Map ID's cloud configuration allows.
        it("keeps the map north-up and flat, so the moped's heading stays true to the roads", () => {
            render(<CourierTrackingMap couriers={[courier()]} />);

            const options = mockRenderedOptions[mockRenderedOptions.length - 1];
            expect(options?.headingInteractionEnabled).toBe(false);
            expect(options?.tiltInteractionEnabled).toBe(false);
        });

        it("hands GoogleMap the same options object across a poll tick, so the map is not re-configured", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} gestureHandling="cooperative" />);
            const first = mockRenderedOptions[mockRenderedOptions.length - 1];

            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.3, longitude: 50.7 })]} gestureHandling="cooperative" />);

            expect(mockRenderedOptions[mockRenderedOptions.length - 1]).toBe(first);
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

        it("labels a split order's only rider by part, in the line and on the marker, while the other part is in the kitchen", () => {
            render(<CourierTrackingMap couriers={[courier({ etaSeconds: 360 })]} split />);

            expect(screen.getByTestId("courier-caption-1").textContent).toBe("Part 1 · Ali · ~6 min");
            expect(mopeds()[0].title).toBe("Ali — Part 1");
        });

        it("gives each courier its own freshness line under its caption", () => {
            render(<CourierTrackingMap couriers={[courier({ positionAgeSeconds: 60 }), courier2()]} />);

            expect(screen.getByTestId("courier-caption-1").textContent).toBe("Part 1 · Ali");
            expect(screen.getByTestId("courier-updated-1").textContent).toBe("Updated 1 min ago");
            expect(screen.getByTestId("courier-caption-2").textContent).toBe("Part 2 · Sara");
            expect(screen.getByTestId("courier-updated-2").textContent).toBe("Updated 10 s ago");
        });
    });

    describe("the moped's heading", () => {
        // CourierTrackingMap's TURN_DURATION_MS: a turn takes one second, then the moped rides on.
        const TURN_MS = 1_000;

        it("draws a 40x40 moped anchored on its centre (the GPS point), upright when no bearing was ever reported", () => {
            render(<CourierTrackingMap couriers={[courier()]} />);

            const [moped] = mopeds();
            expect(rotationOf(moped)).toBe(0);
            expect(moped.icon?.scaledSize).toEqual(new FakeSize(40, 40));
            expect(moped.icon?.anchor).toEqual(new FakePoint(20, 20));
        });

        it("draws the first fix's moped already turned to its reported bearing, with no animation", () => {
            render(<CourierTrackingMap couriers={[courier({ bearingDegrees: 90 })]} />);

            expect(rotationOf(mopeds()[0])).toBe(90);
            expect(rafCallbacks).toHaveLength(0);
        });

        it("turns to a new bearing through an animation and ends exactly on it", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier({ bearingDegrees: 90 })]} />);

            rerender(<CourierTrackingMap couriers={[courier({ bearingDegrees: 180 })]} />);
            expect(rafCallbacks).toHaveLength(1);
            rafCallbacks[0](1_000_000_000);

            expect(rotationOf(mopeds()[0])).toBe(180);
        });

        it("keeps the last bearing when a poll reports none, rather than snapping back to north", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier({ bearingDegrees: 90 })]} />);
            const [moped] = mopeds();

            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.3, longitude: 50.7, bearingDegrees: null })]} />);
            rafCallbacks.forEach((callback) => callback(1_000_000_000));

            expect(moped.position).toEqual({ lat: 26.3, lng: 50.7 });
            expect(rotationOf(moped)).toBe(90);
            expect(moped.setIconCalls).toBe(0);
        });

        it("turns the short way round: from 350° to 10° it passes through north (+20°), never through south", () => {
            const nowSpy = jest.spyOn(performance, "now").mockReturnValue(1_000);
            try {
                const { rerender } = render(<CourierTrackingMap couriers={[courier({ bearingDegrees: 350 })]} />);
                rerender(<CourierTrackingMap couriers={[courier({ bearingDegrees: 10 })]} />);

                const seen: number[] = [];
                for (const elapsed of [TURN_MS / 4, TURN_MS / 2, (TURN_MS * 3) / 4, TURN_MS]) {
                    rafCallbacks[rafCallbacks.length - 1](1_000 + elapsed);
                    seen.push(rotationOf(mopeds()[0]));
                }

                // The long way (-340°) would read 265, 180, 95, 10.
                expect(seen).toEqual([355, 0, 5, 10]);
            } finally {
                nowSpy.mockRestore();
            }
        });

        it("starts a turn that interrupts another from the heading on screen, so the moped never snaps", () => {
            const nowSpy = jest.spyOn(performance, "now").mockReturnValue(1_000);
            try {
                const { rerender } = render(<CourierTrackingMap couriers={[courier({ bearingDegrees: 0 })]} />);
                rerender(<CourierTrackingMap couriers={[courier({ bearingDegrees: 90 })]} />);
                rafCallbacks[rafCallbacks.length - 1](1_000 + TURN_MS / 2);
                expect(rotationOf(mopeds()[0])).toBe(45);

                nowSpy.mockReturnValue(1_500);
                rerender(<CourierTrackingMap couriers={[courier({ bearingDegrees: 180 })]} />);
                rafCallbacks[rafCallbacks.length - 1](1_500 + TURN_MS * 0.04);

                // 45° + 4% of the 135° left to turn. Starting from the abandoned 90° target instead
                // would read 94: a 45° jump in one frame.
                expect(rotationOf(mopeds()[0])).toBe(50);
                rafCallbacks[rafCallbacks.length - 1](1_500 + TURN_MS);
                expect(rotationOf(mopeds()[0])).toBe(180);
            } finally {
                nowSpy.mockRestore();
            }
        });

        it("keeps one marker per rider across polls that move, turn and repeat it, so it never flickers", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier({ bearingDegrees: 0 })]} />);
            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.23, bearingDegrees: 45 })]} />);
            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.24, bearingDegrees: null })]} />);
            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.24, bearingDegrees: null })]} />);

            expect(mockMarkers).toHaveLength(1);
            expect(mockMarkers[0].map).toBe(mockMapInstance);
        });

        it("lets a glide in flight finish when the next poll repeats the same fix, instead of jumping to its end", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} />);
            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.3, longitude: 50.7 })]} />);
            expect(rafCallbacks).toHaveLength(1);

            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.3, longitude: 50.7, positionAgeSeconds: 15 })]} />);

            expect(cancelledFrames).toEqual([]);
            expect(rafCallbacks).toHaveLength(1);
            rafCallbacks[0](1_000_000_000);
            expect(mopeds()[0].position).toEqual({ lat: 26.3, lng: 50.7 });
        });
    });

    describe("the customer's home", () => {
        const HOME: TrackingDestination = { latitude: 26.24, longitude: 50.6 };

        it("draws a home marker at the destination, labelled for accessibility, tip-anchored and beneath the moped", () => {
            render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);

            const home = homeMarker();
            expect(home?.map).toBe(mockMapInstance);
            expect(home?.position).toEqual({ lat: 26.24, lng: 50.6 });
            expect(home?.icon?.scaledSize).toEqual(new FakeSize(32, 42));
            expect(home?.icon?.anchor).toEqual(new FakePoint(16, 42));
            expect(home?.options.zIndex).toBeLessThan(mopeds()[0].options.zIndex ?? 0);
        });

        it("draws no home marker when the order has no pin", () => {
            render(<CourierTrackingMap couriers={[courier()]} destination={null} />);

            expect(homeMarker()).toBeUndefined();
            expect(mockMarkers).toHaveLength(1);
        });

        it("keeps a single home marker across polls, and moves it if the pin moves", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);
            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.23 })]} destination={{ ...HOME }} />);
            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.23 })]} destination={{ latitude: 26.25, longitude: 50.61 }} />);

            expect(mockMarkers.filter((marker) => marker.title === HOME_TITLE)).toHaveLength(1);
            expect(homeMarker()?.position).toEqual({ lat: 26.25, lng: 50.61 });
        });

        it("removes the home marker when the pin goes away", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);
            const home = homeMarker();

            rerender(<CourierTrackingMap couriers={[courier()]} destination={null} />);

            expect(home?.map).toBeNull();
        });

        it("removes the home marker with the riders, and on unmount", () => {
            const first = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);
            const emptied = homeMarker();
            first.rerender(<CourierTrackingMap couriers={[]} destination={HOME} />);
            expect(emptied?.map).toBeNull();
            first.unmount();

            mockMarkers = [];
            const second = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);
            const unmounted = homeMarker();
            second.unmount();
            expect(unmounted?.map).toBeNull();
        });
    });

    describe("framing with a home pin", () => {
        const HOME: TrackingDestination = { latitude: 26.24, longitude: 50.6 };
        const RIDER_START = { lat: 26.2285, lng: 50.586 };
        const HOME_POINT = { lat: 26.24, lng: 50.6 };

        it("glance map: frames the moped and home together on the first fix, and does not follow the moped", () => {
            render(<CourierTrackingMap couriers={[courier()]} destination={HOME} keepInFrame />);

            expect(mockFitBoundsCalls).toHaveLength(1);
            expect(mockFitBoundsCalls[0].points).toEqual([RIDER_START, HOME_POINT]);
            expect(mockSetCenterCalls).toEqual([]);
        });

        it("glance map: re-frames on every poll, around both ends of the glide and home", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} keepInFrame />);

            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.235, longitude: 50.59 })]} destination={{ ...HOME }} keepInFrame />);

            expect(mockFitBoundsCalls).toHaveLength(2);
            expect(mockFitBoundsCalls[1].points).toEqual([RIDER_START, { lat: 26.235, lng: 50.59 }, HOME_POINT]);
            rafCallbacks.forEach((callback) => callback(1_000_000_000));
            expect(mockSetCenterCalls).toEqual([]);
        });

        it("glance map: keeps both riders of a split order and home in frame", () => {
            render(
                <CourierTrackingMap
                    couriers={[courier(), courier({ name: "Sara", latitude: 26.23, longitude: 50.59, partIndex: 2 })]}
                    destination={HOME}
                    keepInFrame
                />
            );

            expect(mockFitBoundsCalls[0].points).toEqual([RIDER_START, { lat: 26.23, lng: 50.59 }, HOME_POINT]);
        });

        it("status-page map: frames riders and home when tracking starts, then leaves the camera to the customer", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);
            expect(mockFitBoundsCalls).toHaveLength(1);
            expect(mockFitBoundsCalls[0].points).toEqual([RIDER_START, HOME_POINT]);

            rerender(<CourierTrackingMap couriers={[courier({ latitude: 26.235, longitude: 50.59 })]} destination={{ ...HOME }} />);
            rafCallbacks.forEach((callback) => callback(1_000_000_000));

            expect(mockFitBoundsCalls).toHaveLength(1);
            expect(mockSetCenterCalls).toEqual([]);
            expect(mockSetZoomCalls).toEqual([]);
        });

        it("status-page map: re-frames when a rider joins", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);

            rerender(
                <CourierTrackingMap
                    couriers={[courier(), courier({ name: "Sara", latitude: 26.23, longitude: 50.59, partIndex: 2 })]}
                    destination={{ ...HOME }}
                />
            );

            expect(mockFitBoundsCalls).toHaveLength(2);
            expect(mockFitBoundsCalls[1].points).toEqual([RIDER_START, { lat: 26.23, lng: 50.59 }, HOME_POINT]);
        });

        it("status-page map: frames again when tracking restarts after the riders left the map", () => {
            const { rerender } = render(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);
            rerender(<CourierTrackingMap couriers={[]} destination={HOME} />);

            rerender(<CourierTrackingMap couriers={[courier()]} destination={HOME} />);

            expect(mockFitBoundsCalls).toHaveLength(2);
        });

        it("caps the zoom when the rider is at the door, so the map does not zoom all the way in", () => {
            mockZoomAfterFitBounds = 20;
            render(<CourierTrackingMap couriers={[courier()]} destination={{ latitude: 26.2285, longitude: 50.586 }} />);

            // Framed with home and then capped, not the no-home follow path's centre-and-zoom.
            expect(mockFitBoundsCalls).toHaveLength(1);
            expect(mockSetCenterCalls).toEqual([]);
            expect(mockSetZoomCalls).toEqual([16]);
        });
    });
});
