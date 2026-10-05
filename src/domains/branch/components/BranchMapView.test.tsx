import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import type { IBranch } from "../../management/inventory/types";

import { BranchMapView } from "./BranchMapView";

// ONE hoisted mock with mutable state, rather than jest.doMock + jest.resetModules + require.
//
// The reset-and-require shape looks equivalent and is not: resetModules clears the registry, so
// the re-required component pulls a SECOND copy of React while `render` still drives the first.
// Any MUI element then hits a null hooks dispatcher — "Cannot read properties of null (reading
// 'useContext')". It only shows up in the not-loaded branch, because that is the only one that
// renders MUI at all; the loaded branch renders the mocked GoogleMap and never notices.
//
// The `mock` name prefix is what lets a hoisted factory close over this without tripping
// babel-plugin-jest-hoist's out-of-scope check.
const mockLoaderState: { isLoaded: boolean; loadError: Error | undefined } = {
    isLoaded: true,
    loadError: undefined,
};

type MockGoogleMapProps = { onLoad?: (map: unknown) => void };

// The component creates its markers against the instance onLoad hands it, so the fake map has to
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
                // A fresh instance per mount. Google builds a new google.maps.Map every time the
                // container mounts, and markers bound to the previous one keep their listeners but
                // are attached to a map nobody is looking at -- pins that are visibly there and
                // dead to the touch. That is what this fake exists to be able to reproduce.
                onLoad?.(mockMapMounts++ === 0 ? mockMapInstance : mockSecondMapInstance);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return <div data-testid="google-map" />;
        },
    };
});

type FakePoint = { x: number; y: number };
type FakeMarkerOptions = {
    title?: string;
    map?: unknown;
    icon?: { url: string; scaledSize: { width: number; height: number }; anchor: FakePoint; labelOrigin: FakePoint };
};

/** Every marker the component builds during a test, in creation order. */
const mockCreatedMarkers: FakeMarker[] = [];

class FakeMarker {
    listeners: Record<string, () => void> = {};
    map: unknown;

    constructor(public options: FakeMarkerOptions) {
        this.map = options.map;
        mockCreatedMarkers.push(this);
    }

    animation: unknown = undefined;

    addListener(event: string, handler: () => void): void {
        this.listeners[event] = handler;
    }

    setAnimation(animation: unknown): void {
        this.animation = animation;
    }

    setMap(map: unknown): void {
        this.map = map;
    }
}

let mockMapMounts = 0;

const mockMapInstance = {
    setCenter: (): void => {},
    setZoom: (): void => {},
    getZoom: (): number => 12,
    fitBounds: (): void => {},
};

/** What the picker gets the second time it is opened. Deliberately a different object. */
const mockSecondMapInstance = { ...mockMapInstance };

// The component reaches for the `google` global — LatLngBounds to fit the view, Marker/Size/Point
// to draw the branded pins. In the app that global is guaranteed by the time it renders,
// because useJsApiLoader only reports isLoaded once the script is in place; under test the mocked
// loader reports isLoaded with no script behind it, so the global has to be stubbed here.
//
// Deliberately minimal: just enough shape for the calls the component makes. A fuller fake would
// start asserting on Google's internals rather than on our own behaviour.
function installGoogleStub(): void {
    (globalThis as unknown as { google: unknown }).google = {
        maps: {
            LatLngBounds: class {
                extend(): void {
                    /* positions are not asserted; fitBounds is called for its side effect only */
                }
            },
            Point: class {
                constructor(public x: number, public y: number) {}
            },
            Marker: FakeMarker,
            Animation: { BOUNCE: "BOUNCE" },
            Size: class {
                constructor(public width: number, public height: number) {}
            },
            event: {
                addListenerOnce: (): Record<string, never> => ({}),
                removeListener: (): void => {},
                clearInstanceListeners: (): void => {},
            },
        },
    };
}

beforeAll(installGoogleStub);

/** A PNG's pixel size, read from its IHDR chunk (big-endian width and height at bytes 16 and 20). */
function pngSize(path: string): { width: number; height: number } {
    const bytes = readFileSync(path);
    expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function branch(overrides: Partial<IBranch> = {}): IBranch {
    return {
        id: "b1",
        externalId: "ext-1",
        branchNo: 1,
        branchName: "Smichov",
        locale: "en",
        latitude: 50.07,
        longitude: 14.4,
        ...overrides,
    };
}

describe("BranchMapView", () => {
    beforeEach(() => {
        mockLoaderState.isLoaded = true;
        mockLoaderState.loadError = undefined;
        mockCreatedMarkers.length = 0;
        mockMapMounts = 0;
    });

    it("creates a marker for every branch with coordinates and none for a null-coordinate branch", () => {
        const branches = [branch(), branch({ id: "b2", branchName: "Karlin", latitude: null, longitude: null })];
        const onSelectBranch = jest.fn<void, [IBranch]>();

        render(<BranchMapView branches={branches} onSelectBranch={onSelectBranch} />);

        expect(mockCreatedMarkers.map((marker) => marker.options.title)).toEqual(["Smichov"]);
    });

    // The regression this file exists for: a marker bound to anything other than the map the
    // component was handed is invisible on screen, which is exactly how the missing-pins bug read.
    it("binds every marker to the map instance onLoad supplied", () => {
        const onSelectBranch = jest.fn<void, [IBranch]>();

        render(<BranchMapView branches={[branch()]} onSelectBranch={onSelectBranch} />);

        expect(mockCreatedMarkers).toHaveLength(1);
        expect(mockCreatedMarkers[0].map).toBe(mockMapInstance);
    });

    it("calls onSelectBranch when a marker is clicked", () => {
        const smichov = branch();
        const onSelectBranch = jest.fn<void, [IBranch]>();

        render(<BranchMapView branches={[smichov]} onSelectBranch={onSelectBranch} />);
        mockCreatedMarkers[0].listeners.click();

        expect(onSelectBranch).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
    });

    /**
     * The picker is mounted conditionally, so closing and reopening it builds a NEW
     * google.maps.Map. Markers left bound to the previous one are still drawn — the customer sees
     * pins — and their click listeners fire against a map nobody is looking at, so tapping a pin
     * does nothing at all. That is the reported shape exactly: no sheet, no dimmed screen, and a
     * page reload "fixes" it because a reload is the one thing that clears the leftovers.
     */
    it("rebuilds its markers against the new map when the picker is closed and reopened", () => {
        const smichov = branch();
        const onSelectBranch = jest.fn<void, [IBranch]>();

        // Arrange — first open, then the picker closes.
        const first = render(<BranchMapView branches={[smichov]} onSelectBranch={onSelectBranch} />);
        expect(mockCreatedMarkers[0].map).toBe(mockMapInstance);
        first.unmount();

        // Act — reopened, which is a fresh map instance.
        render(<BranchMapView branches={[smichov]} onSelectBranch={onSelectBranch} />);

        // Assert — the pin the customer can now see belongs to the map they can now see, and
        // tapping it still reaches the caller.
        const live = mockCreatedMarkers.filter((marker) => marker.map !== null);
        expect(live).toHaveLength(1);
        expect(live[0].map).toBe(mockSecondMapInstance);

        live[0].listeners.click();
        expect(onSelectBranch).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
    });

    it("detaches its markers when the branch set changes, so stale pins never linger", () => {
        const onSelectBranch = jest.fn<void, [IBranch]>();
        const { rerender } = render(<BranchMapView branches={[branch()]} onSelectBranch={onSelectBranch} />);

        const first = mockCreatedMarkers[0];
        rerender(
            <BranchMapView
                branches={[branch({ id: "b2", branchName: "Karlin", latitude: 50.09, longitude: 14.45 })]}
                onSelectBranch={onSelectBranch}
            />
        );

        expect(first.map).toBeNull();
        expect(mockCreatedMarkers[mockCreatedMarkers.length - 1].options.title).toBe("Karlin");
    });

    /**
     * The owner's report: a badge anchored at its centre "gives slightly false information, as if
     * the point is lower". The pin is now a head with a pointed tip, and the tip — the bottom
     * centre of the icon — is what sits on the branch, at every zoom. The name hangs 11px under it.
     */
    it("puts the pin's tip on the branch and the name's centre 11px under the tip", () => {
        render(<BranchMapView branches={[branch()]} onSelectBranch={jest.fn<void, [IBranch]>()} />);

        const icon = mockCreatedMarkers[0].options.icon;
        if (icon === undefined) throw new Error("the branch marker has no custom icon");
        // 52x68 is half the asset's 104x136: the head keeps the old badge's 52px.
        expect(icon.scaledSize).toEqual({ width: 52, height: 68 });
        // Both points are measured from the icon's top-left.
        expect(icon.anchor).toEqual({ x: icon.scaledSize.width / 2, y: icon.scaledSize.height });
        expect(icon.labelOrigin).toEqual({ x: icon.anchor.x, y: icon.anchor.y + 11 });
    });

    // The anchor is in CSS px of the scaledSize box, so it is only the tip if the shipped image has
    // that box's aspect: Google stretches the PNG to fit, and a regenerated asset of another aspect
    // would move the apex off the anchor with every option above still passing.
    it("ships the pin asset at 2x the icon's box, so the anchor stays on the tip", () => {
        render(<BranchMapView branches={[branch()]} onSelectBranch={jest.fn<void, [IBranch]>()} />);

        const icon = mockCreatedMarkers[0].options.icon;
        if (icon === undefined) throw new Error("the branch marker has no custom icon");
        expect(icon.url).toMatch(/\/branch-pin\.png$/);
        const asset = pngSize(join(__dirname, "..", "..", "..", "..", "public", "branch-pin.png"));
        expect(asset).toEqual({ width: icon.scaledSize.width * 2, height: icon.scaledSize.height * 2 });
    });

    // Tapping a pin now opens a details sheet; the bounce is what ties that sheet back to the pin
    // the customer actually hit, on a map where the two branches look identical.
    it("bounces only the pin whose details are open", () => {
        const onSelectBranch = jest.fn<void, [IBranch]>();
        const branches = [branch(), branch({ id: "b2", branchName: "Karlin", latitude: 50.09, longitude: 14.45 })];

        const { rerender } = render(
            <BranchMapView branches={branches} onSelectBranch={onSelectBranch} activeBranchId="b2" />
        );

        expect(mockCreatedMarkers.map((m) => m.animation)).toEqual([null, "BOUNCE"]);

        rerender(<BranchMapView branches={branches} onSelectBranch={onSelectBranch} activeBranchId={null} />);

        expect(mockCreatedMarkers.map((m) => m.animation)).toEqual([null, null]);
    });

    /**
     * Google's BOUNCE loops until it is cleared. Left running it reads as a pin that will not
     * settle, not as "this is the one you tapped" — the owner's words were that it "just jumps".
     * The single hop only exists because the loop is stopped, so that stop is the behaviour worth
     * pinning: without it this test finds the marker still bouncing a second later.
     */
    it("stops the bounce after one hop instead of looping", () => {
        jest.useFakeTimers();
        try {
            const branches = [branch()];

            render(
                <BranchMapView
                    branches={branches}
                    onSelectBranch={jest.fn<void, [IBranch]>()}
                    activeBranchId="b1"
                />
            );

            expect(mockCreatedMarkers[0].animation).toBe("BOUNCE");

            act(() => { jest.advanceTimersByTime(1000); });

            expect(mockCreatedMarkers[0].animation).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });


    it("shows a loading state while the script has not loaded yet", () => {
        mockLoaderState.isLoaded = false;
        const onSelectBranch = jest.fn<void, [IBranch]>();

        render(<BranchMapView branches={[branch()]} onSelectBranch={onSelectBranch} />);

        expect(screen.queryByTestId("google-map")).toBeNull();
    });
});
