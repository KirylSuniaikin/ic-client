// Covers DELIVERY_COVERAGE_MATRIX.md D9. The Maps JS SDK is never loaded under jsdom, so
// `useJsApiLoader` reports `isLoaded: false` forever and the hook short-circuits to null — which
// is why the picker suite's prefill silently no-opped and proved nothing. Both halves are faked
// here: the loader flag, and the `google.maps.Geocoder` the hook constructs.
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook } from "@testing-library/react";

// Name starts with `mock` so babel-jest lets the hoisted factory close over it. A plain arrow, not
// a jest.fn — CRA's `resetMocks: true` would otherwise wipe the implementation between cases.
let mockLoaded = true;
jest.mock("@react-google-maps/api", () => ({
    useJsApiLoader: () => ({ isLoaded: mockLoaded }),
}));

import { useReverseGeocode } from "./useReverseGeocode";

type FakeComponent = { long_name: string; types: string[] };
type FakeResult = { address_components: FakeComponent[] };

let geocodeResults: FakeResult[] = [];
let geocodeError: Error | null = null;
let geocodeRequests: unknown[] = [];

class FakeGeocoder {
    async geocode(request: unknown): Promise<{ results: FakeResult[] }> {
        geocodeRequests.push(request);
        if (geocodeError !== null) throw geocodeError;
        return { results: geocodeResults };
    }
}

/** One Google address component, in the shape `address_components` actually carries. */
function part(long_name: string, ...types: string[]): FakeComponent {
    return { long_name, types };
}

// The Maps SDK installs itself as a bare `window.google` global, so a fake has to be installed the
// same way. The cast is the only way to write a vendor global that no lib.dom type describes as
// writable — the shape below is exactly the slice `useReverseGeocode` reaches for.
function installGoogle(): void {
    (globalThis as unknown as { google: unknown }).google = { maps: { Geocoder: FakeGeocoder } };
}

function removeGoogle(): void {
    delete (globalThis as unknown as { google?: unknown }).google;
}

beforeEach(() => {
    mockLoaded = true;
    geocodeResults = [];
    geocodeError = null;
    geocodeRequests = [];
    installGoogle();
});

afterEach(() => {
    removeGoogle();
});

function geocoder(): (latitude: number, longitude: number) => Promise<{
    block: string | null; road: string | null; building: string | null;
} | null> {
    const { result } = renderHook(() => useReverseGeocode());
    return result.current;
}

/**
 * A pin on its own left the courier's card reading "No address". This turns it into something a
 * rider can find a door with — a guess, which is why it only ever prefills.
 */
describe("useReverseGeocode", () => {
    it("maps Google's components onto the Bahrain address parts", async () => {
        geocodeResults = [{
            address_components: [
                part("Seef", "neighborhood", "political"),
                part("Road 3801", "route"),
                part("12", "street_number"),
            ],
        }];

        await expect(geocoder()(26.2285, 50.586)).resolves.toEqual({
            block: "Seef", road: "Road 3801", building: "12",
        });
    });

    /** Google does not always call a Bahraini block a neighborhood; sublocality is the same thing. */
    it("accepts sublocality for the block and premise for the building", async () => {
        geocodeResults = [{
            address_components: [part("Manama", "sublocality"), part("Tower A", "premise")],
        }];

        await expect(geocoder()(26.2285, 50.586)).resolves.toEqual({
            block: "Manama", road: null, building: "Tower A",
        });
    });

    it("asks about the point it was given", async () => {
        geocodeResults = [{ address_components: [] }];

        await geocoder()(26.2285, 50.586);

        expect(geocodeRequests).toEqual([{ location: { lat: 26.2285, lng: 50.586 } }]);
    });

    it("answers null when Google knows nothing about the point", async () => {
        geocodeResults = [];

        await expect(geocoder()(0, 0)).resolves.toBeNull();
    });

    /** Never fatal: the pin still routes the courier, and a failed guess must not block a save. */
    it("answers null instead of throwing when the geocoder fails", async () => {
        // The hook logs the failure on purpose; silenced so a real error still stands out here.
        const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
        geocodeError = new Error("OVER_QUERY_LIMIT");

        await expect(geocoder()(26.2285, 50.586)).resolves.toBeNull();

        expect(logged).toHaveBeenCalled();
        logged.mockRestore();
    });

    /** Asking before the SDK script has finished loading would throw on `new google.maps…`. */
    it("answers null while the Maps script is still loading", async () => {
        mockLoaded = false;
        geocodeResults = [{ address_components: [part("Seef", "neighborhood")] }];

        await expect(geocoder()(26.2285, 50.586)).resolves.toBeNull();
        expect(geocodeRequests).toEqual([]);
    });

    /**
     * No key configured means no SDK on the page at all, which is today's production state. The
     * `typeof google` guard is what makes that a quiet no-answer rather than a reported failure:
     * without it the constructor throws a ReferenceError into the catch below and every pin
     * capture logs an error for a feature that was simply never switched on. The absence of that
     * log is the only thing separating the two, so it is what is asserted.
     */
    it("answers null quietly, with nothing logged, when the Maps SDK is not on the page", async () => {
        const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
        removeGoogle();

        await expect(geocoder()(26.2285, 50.586)).resolves.toBeNull();

        expect(logged).not.toHaveBeenCalled();
        logged.mockRestore();
    });
});
