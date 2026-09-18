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

let mockMarkers: FakeMarker[] = [];
let mockSetCenterCalls: LatLng[] = [];
let mockSetZoomCalls: number[] = [];

const mockMapInstance = {
    setCenter: (position: LatLng): void => {
        mockSetCenterCalls.push(position);
    },
    setZoom: (zoom: number): void => {
        mockSetZoomCalls.push(zoom);
    },
};

function installGoogleStub(): void {
    (globalThis as unknown as { google: unknown }).google = {
        maps: { Marker: FakeMarker },
    };
}

// Captures every queued frame so a test can drive the interpolation to completion manually,
// rather than depending on a real animation clock.
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
    rafCallbacks = [];
    rafCallCount = 0;
    cancelledFrames = [];
});

describe("CourierTrackingMap", () => {
    it("renders nothing when courier is null", () => {
        const { container } = render(<CourierTrackingMap courier={null} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing when the mocked loader reports isLoaded: false", () => {
        mockLoaderState.isLoaded = false;
        const { container } = render(<CourierTrackingMap courier={courier()} />);
        expect(container.firstChild).toBeNull();
        expect(mockMarkers).toHaveLength(0);
    });

    it("renders nothing when GOOGLE_MAPS_API_KEY is mocked falsy", () => {
        mockMapsKey.value = undefined;
        const { container } = render(<CourierTrackingMap courier={courier()} />);
        expect(container.firstChild).toBeNull();
        expect(mockMarkers).toHaveLength(0);
    });

    it("creates exactly one marker bound to the onLoad map instance, at the courier's position, with no animation on the first fix", () => {
        render(<CourierTrackingMap courier={courier()} />);

        expect(mockMarkers).toHaveLength(1);
        expect(mockMarkers[0].map).toBe(mockMapInstance);
        expect(mockMarkers[0].position).toEqual({ lat: 26.2285, lng: 50.586 });
        expect(rafCallbacks).toHaveLength(0);
        expect(mockSetCenterCalls).toEqual([{ lat: 26.2285, lng: 50.586 }]);
        expect(mockSetZoomCalls).toEqual([16]);
    });

    it("requests an animation frame on a coordinate change and ends at the new position", () => {
        const { rerender } = render(<CourierTrackingMap courier={courier()} />);
        expect(rafCallbacks).toHaveLength(0);

        rerender(<CourierTrackingMap courier={courier({ latitude: 26.3, longitude: 50.7 })} />);

        expect(rafCallbacks).toHaveLength(1);
        // Drive the single queued frame straight to completion — a timestamp far past the
        // animation's duration collapses the interpolation fraction to 1 in one call.
        rafCallbacks[0](1_000_000_000);

        expect(mockMarkers[0].position).toEqual({ lat: 26.3, lng: 50.7 });
    });

    it("requests no animation frame on an identical-coordinate update", () => {
        const { rerender } = render(<CourierTrackingMap courier={courier()} />);

        rerender(<CourierTrackingMap courier={courier({ positionAgeSeconds: 25 })} />);

        expect(rafCallbacks).toHaveLength(0);
        expect(mockMarkers[0].position).toEqual({ lat: 26.2285, lng: 50.586 });
    });

    it("detaches the marker when the courier prop becomes null", () => {
        const { rerender, container } = render(<CourierTrackingMap courier={courier()} />);
        const marker = mockMarkers[0];
        expect(marker.map).not.toBeNull();

        rerender(<CourierTrackingMap courier={null} />);

        expect(marker.map).toBeNull();
        expect(container.firstChild).toBeNull();
    });

    it("detaches the marker on unmount", () => {
        const { unmount } = render(<CourierTrackingMap courier={courier()} />);
        const marker = mockMarkers[mockMarkers.length - 1];

        unmount();

        expect(marker.map).toBeNull();
    });

    it("always shows the courier's name", () => {
        render(<CourierTrackingMap courier={courier({ name: "Fatima" })} />);
        expect(screen.getByText(/Fatima/)).toBeTruthy();
    });

    it('shows "Updated 1 min ago" once positionAgeSeconds reaches the 60-second threshold', () => {
        render(<CourierTrackingMap courier={courier({ positionAgeSeconds: 60 })} />);
        expect(screen.getByText(/Updated 1 min ago/)).toBeTruthy();
    });

    it("shows no age text below the 60-second threshold", () => {
        render(<CourierTrackingMap courier={courier({ positionAgeSeconds: 30 })} />);
        expect(screen.queryByText(/Updated/)).toBeNull();
    });
});
