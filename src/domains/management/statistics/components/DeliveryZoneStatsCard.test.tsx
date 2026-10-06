import {jest, describe, it, expect, beforeAll, beforeEach} from "@jest/globals";
import React from "react";
import {act, render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {DeliveryZoneStatsCard} from "./DeliveryZoneStatsCard";
import {NO_DATA_COLOR, rampColor} from "../utils/deliveryZoneScale";
import {emotionRulesFor} from "../../couriers/components/emotionRules.testutil";
import type {
    DeliveryZoneCell,
    DeliveryZoneCellMeters,
    DeliveryZonePoint,
    DeliveryZoneStats,
    LostDemandZoneCell,
    LostDemandZoneStats,
} from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../shared/api/management");

import {fetchDeliveryZoneStats, fetchLostDemandZoneStats} from "../../../../shared/api/management";

const mockFetchZones = jest.mocked(fetchDeliveryZoneStats);
const mockFetchLostZones = jest.mocked(fetchLostDemandZoneStats);

// ONE hoisted mock with mutable state, the shape OrderRouteMap.test.tsx and DeliveryZoneMap.test.tsx
// settled on: jest.doMock + resetModules + require pulls a SECOND copy of React while `render`
// drives the first. The `mock` prefix lets the hoisted factories close over these.
const mockLoaderState: { isLoaded: boolean } = {isLoaded: true};

// The key is a module const read from process.env at import time, so it is exposed through a
// getter: the no-key fallback is chosen at render time and a plain factory value would freeze it.
const mockMapsKey: { value: string | undefined } = {value: "test-key"};
jest.mock("../../../branch/utils/mapsConfig", () => ({
    get GOOGLE_MAPS_API_KEY(): string | undefined { return mockMapsKey.value; },
    GOOGLE_MAPS_MAP_ID: undefined,
    LIGHT_MAP_STYLES: [],
}));

type MockGoogleMapProps = { onLoad?: (map: unknown) => void };

// The map creates its polygons against the instance onLoad hands it, so the fake map is handed
// over the same way — a mock that only rendered children would exercise nothing.
jest.mock("@react-google-maps/api", () => {
    // Required inside the factory: babel-plugin-jest-hoist lifts this above the imports.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {useEffect} = require("react") as typeof import("react");
    return {
        useJsApiLoader: () => mockLoaderState,
        GoogleMap: ({onLoad}: MockGoogleMapProps) => {
            useEffect(() => {
                onLoad?.(mockMapInstance);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return <div data-testid="google-map"/>;
        },
    };
});

type LatLng = { lat: number; lng: number };

type FakePolygonOptions = {
    map?: unknown;
    paths?: LatLng[];
    fillColor?: string;
    strokeColor?: string;
    strokeWeight?: number;
    zIndex?: number;
    clickable?: boolean;
};

const mockPolygons: FakePolygon[] = [];

/**
 * A real class rather than a stubbed <Polygon> element: the bug this pattern guards against is an
 * overlay bound to the WRONG map instance, and the selection is applied with setOptions on the
 * existing overlay — neither of which a mocked React element would show.
 */
class FakePolygon {
    map: unknown;
    options: FakePolygonOptions;
    readonly handlers = new Map<string, Array<() => void>>();

    constructor(options: FakePolygonOptions) {
        this.options = {...options};
        this.map = options.map;
        mockPolygons.push(this);
    }

    setMap(map: unknown): void { this.map = map; }

    setOptions(options: FakePolygonOptions): void {
        this.options = {...this.options, ...options};
    }

    addListener(event: string, handler: () => void): { remove: () => void } {
        const handlers = this.handlers.get(event) ?? [];
        handlers.push(handler);
        this.handlers.set(event, handlers);
        return {remove: () => undefined};
    }

    click(): void {
        for (const handler of this.handlers.get("click") ?? []) handler();
    }
}

const mockExtended: LatLng[] = [];
let mockFitBoundsCalls = 0;

const mockMapInstance = {
    fitBounds: (): void => {
        mockFitBoundsCalls += 1;
    },
    getZoom: (): number => 14,
    setZoom: (): void => {},
};

// The map reaches for the `google` global; under test the mocked loader reports isLoaded with no
// script behind it, so the global is stubbed here.
function installGoogleStub(): void {
    (globalThis as unknown as { google: unknown }).google = {
        maps: {
            LatLngBounds: class {
                extend(position: LatLng): void {
                    mockExtended.push(position);
                }
            },
            Polygon: FakePolygon,
            event: {
                addListenerOnce: (): Record<string, never> => ({}),
                removeListener: (): void => {},
                clearInstanceListeners: (): void => {},
            },
        },
    };
}

beforeAll(installGoogleStub);

// A hexagon's six corners around a centre, close enough to the real grid for the map's purposes.
function hexagon(center: DeliveryZonePoint): DeliveryZonePoint[] {
    return Array.from({length: 6}, (_, i) => ({
        latitude: center.latitude + 0.004 * Math.sin((Math.PI / 3) * i),
        longitude: center.longitude + 0.004 * Math.cos((Math.PI / 3) * i),
    }));
}

function cell(id: string, center: DeliveryZonePoint, overrides: Partial<DeliveryZoneCell>): DeliveryZoneCell {
    return {
        id,
        center,
        vertices: hexagon(center),
        orders: 1,
        revenue: 0,
        avgTotalMinutes: null,
        p90TotalMinutes: null,
        avgRoadMinutes: null,
        lateShare: null,
        lateSampleSize: 0,
        ...overrides,
    };
}

/** The busiest cell, quickest on average, 2 of its 8 promised orders late. */
const BUSY = cell("12:-7", {latitude: 26.2, longitude: 50.58}, {
    orders: 12,
    revenue: 41.25,
    avgTotalMinutes: 30,
    p90TotalMinutes: 44,
    avgRoadMinutes: 12.1,
    lateShare: 0.25,
    lateSampleSize: 8,
});

/** The quietest and slowest cell — and only three orders with a promise, too few to colour. */
const SMALL = cell("13:-7", {latitude: 26.21, longitude: 50.59}, {
    orders: 3,
    revenue: 9.5,
    avgTotalMinutes: 45.2,
    p90TotalMinutes: 52,
    avgRoadMinutes: 20,
    lateShare: 0.667,
    lateSampleSize: 3,
});

/** A cell with no measured time at all, and every promised order on time. */
const UNTIMED = cell("12:-6", {latitude: 26.19, longitude: 50.6}, {
    orders: 6,
    revenue: 20,
    lateShare: 0,
    lateSampleSize: 6,
});

function zones(overrides: Partial<DeliveryZoneStats> = {}): DeliveryZoneStats {
    return {
        cellMeters: 500,
        totalOrders: 21,
        unlocatedOrders: 0,
        cells: [BUSY, SMALL, UNTIMED],
        ...overrides,
    };
}

const SCOPE = {startDate: "2026-08-01", finishDate: "2026-08-30"};

function toLatLng(point: DeliveryZonePoint): LatLng {
    return {lat: point.latitude, lng: point.longitude};
}

/** Overlays still on the map — a metric switch rebuilds them, and the old set is detached. */
function livePolygons(): FakePolygon[] {
    return mockPolygons.filter((polygon) => polygon.map === mockMapInstance);
}

function polygonOf(target: { id: string; vertices: DeliveryZonePoint[] }): FakePolygon {
    const first = toLatLng(target.vertices[0]);
    const found = livePolygons().find((polygon) =>
        polygon.options.paths?.[0]?.lat === first.lat && polygon.options.paths?.[0]?.lng === first.lng);
    if (found === undefined) throw new Error(`no live polygon for cell ${target.id}`);
    return found;
}

function fillOf(target: { id: string; vertices: DeliveryZonePoint[] }): string | undefined {
    return polygonOf(target).options.fillColor;
}

/**
 * A toggle click can start a fetch whose answer lands on a later microtask; awaiting it inside act
 * lets that update happen where React expects it instead of between two waitFor polls.
 */
async function clickAndSettle(buttonName: string): Promise<void> {
    await act(async () => {
        userEvent.click(screen.getByRole("button", {name: buttonName}));
    });
}

async function renderLoaded(stats: DeliveryZoneStats = zones()): Promise<void> {
    mockFetchZones.mockResolvedValue(stats);
    render(<DeliveryZoneStatsCard scope={SCOPE}/>);
    await screen.findByTestId("zone-stats-summary");
}

beforeEach(() => {
    mockLoaderState.isLoaded = true;
    mockMapsKey.value = "test-key";
    mockPolygons.length = 0;
    mockExtended.length = 0;
    mockFitBoundsCalls = 0;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("DeliveryZoneStatsCard", () => {
    it("asks for the applied range on the default 500 m grid, chain-wide", async () => {
        await renderLoaded();

        expect(mockFetchZones).toHaveBeenCalledTimes(1);
        // Exactly three arguments: a fourth would be a branch filter, and this card is read
        // chain-wide like the estimate-accuracy card it is reconciled against.
        expect(mockFetchZones.mock.calls[0]).toEqual(["2026-08-01", "2026-08-30", 500]);
        expect(screen.getByTestId("zone-stats-scope").textContent)
            .toBe("All branches · Aug 1, 2026 — Aug 30, 2026");
        expect(screen.getByTestId("zone-stats-summary").textContent)
            .toBe("21 delivered orders across 3 cells of 500 m");
    });

    it("draws one polygon per cell from its vertices, bound to the map onLoad supplied", async () => {
        await renderLoaded();

        expect(livePolygons()).toHaveLength(3);
        for (const target of [BUSY, SMALL, UNTIMED]) {
            expect(polygonOf(target).options.paths).toEqual(target.vertices.map(toLatLng));
        }
        for (const polygon of mockPolygons) expect(polygon.map).toBe(mockMapInstance);
    });

    it("fits the map to every cell's corners on load", async () => {
        await renderLoaded();

        expect(mockFitBoundsCalls).toBe(1);
        for (const target of [BUSY, SMALL, UNTIMED]) {
            for (const vertex of target.vertices) expect(mockExtended).toContainEqual(toLatLng(vertex));
        }
    });

    it("colours by orders first, darkest where the most orders went, with the range in the legend", async () => {
        await renderLoaded();

        expect(fillOf(BUSY)).toBe(rampColor(1));
        expect(fillOf(SMALL)).toBe(rampColor(0));
        expect(fillOf(UNTIMED)).toBe(rampColor(3 / 9));
        expect(screen.getByTestId("zone-legend-min").textContent).toBe("3");
        expect(screen.getByTestId("zone-legend-max").textContent).toBe("12");
    });

    // A bar running the other way from the fills would turn the busiest area into the quietest.
    it("draws the legend bar in the same direction as the fills, min on the left", async () => {
        await renderLoaded();

        const parts = within(screen.getByTestId("zone-legend")).getAllByTestId(/^zone-legend-(min|bar|max)$/);
        expect(parts.map((part) => part.getAttribute("data-testid")))
            .toEqual(["zone-legend-min", "zone-legend-bar", "zone-legend-max"]);
        expect(emotionRulesFor(screen.getByTestId("zone-legend-bar")))
            .toContain(`linear-gradient(to right, ${fillOf(SMALL)}, ${rampColor(0.5)}, ${fillOf(BUSY)})`);
    });

    /**
     * Every coloured cell is the mid-ramp shade when they all share one value. A full light-to-dark
     * bar beside them would read that shade as "half way up" — every area 0% late as moderately late.
     */
    it("shows one swatch with the shared value, not a scale, when every coloured cell is the same", async () => {
        const allOnTime = {orders: 4, lateShare: 0, lateSampleSize: 8};
        await renderLoaded(zones({
            totalOrders: 12,
            cells: [{...BUSY, ...allOnTime}, {...SMALL, orders: 4}, {...UNTIMED, ...allOnTime}],
        }));

        expect(screen.queryByTestId("zone-legend-bar")).toBeNull();
        expect(screen.getByTestId("zone-legend-single").textContent).toBe("4 in every cell");

        await clickAndSettle("Late %");

        const midRamp = rampColor(0.5);
        expect(fillOf(BUSY)).toBe(midRamp);
        expect(fillOf(UNTIMED)).toBe(midRamp);
        expect(fillOf(SMALL)).toBe(NO_DATA_COLOR);
        expect(screen.queryByTestId("zone-legend-bar")).toBeNull();
        expect(screen.queryByTestId("zone-legend-min")).toBeNull();
        expect(screen.getByTestId("zone-legend-single").textContent).toBe("0.0% in every coloured cell");
        expect(emotionRulesFor(screen.getByTestId("zone-legend-swatch"))).toContain(`background-color:${midRamp}`);
    });

    it("recolours the cells when the metric changes, and greys a cell with no measured time", async () => {
        await renderLoaded();

        await clickAndSettle("Avg time");

        // The busiest cell is the quickest: the scale is per metric, not a fixed ranking of cells.
        expect(fillOf(BUSY)).toBe(rampColor(0));
        expect(fillOf(SMALL)).toBe(rampColor(1));
        expect(fillOf(UNTIMED)).toBe(NO_DATA_COLOR);
        expect(screen.getByTestId("zone-legend-min").textContent).toBe("30.0 min");
        expect(screen.getByTestId("zone-legend-max").textContent).toBe("45.2 min");
        expect(within(screen.getByTestId("zone-legend")).getByText("no measured time")).toBeTruthy();
    });

    /**
     * Two of three promised orders late is "66.7%", which would otherwise be the darkest cell on the
     * map and the first one anybody looked at. Below five orders with a promise the cell is grey,
     * and it does not stretch the scale for the cells that are coloured either.
     */
    it("treats a cell with fewer than five promised orders as no data in Late %", async () => {
        await renderLoaded();

        await clickAndSettle("Late %");

        expect(fillOf(SMALL)).toBe(NO_DATA_COLOR);
        expect(fillOf(BUSY)).toBe(rampColor(1));
        expect(fillOf(UNTIMED)).toBe(rampColor(0));
        expect(screen.getByTestId("zone-legend-min").textContent).toBe("0.0%");
        expect(screen.getByTestId("zone-legend-max").textContent).toBe("25.0%");
        expect(within(screen.getByTestId("zone-legend")).getByText("fewer than 5 orders with a promise"))
            .toBeTruthy();
    });

    it("shows a tapped cell's numbers and outlines it on the map", async () => {
        await renderLoaded();
        expect(screen.queryByTestId("zone-details")).toBeNull();

        act(() => polygonOf(BUSY).click());

        expect(screen.getByTestId("zone-detail-orders").textContent).toBe("12");
        expect(screen.getByTestId("zone-detail-revenue").textContent).toBe("BHD 41.250");
        expect(screen.getByTestId("zone-detail-avg-total").textContent).toBe("30.0 min");
        expect(screen.getByTestId("zone-detail-p90-total").textContent).toBe("44.0 min");
        expect(screen.getByTestId("zone-detail-avg-road").textContent).toBe("12.1 min");
        expect(screen.getByTestId("zone-detail-late").textContent).toBe("25.0% (2 of 8)");
        expect(polygonOf(BUSY).options.strokeWeight).toBe(3);
        expect(polygonOf(SMALL).options.strokeWeight).toBe(1);
    });

    // A missing sample is an em dash, never "0 min" — "instant" and "unmeasured" are opposites.
    it("prints dashes, not zeros, for a cell with no measured time", async () => {
        await renderLoaded();

        act(() => polygonOf(UNTIMED).click());

        expect(screen.getByTestId("zone-detail-avg-total").textContent).toBe("—");
        expect(screen.getByTestId("zone-detail-p90-total").textContent).toBe("—");
        expect(screen.getByTestId("zone-detail-avg-road").textContent).toBe("—");
        expect(screen.getByTestId("zone-detail-late").textContent).toBe("0.0% (0 of 6)");
    });

    it("refetches with the chosen cell size, keeping the viewport the manager zoomed into", async () => {
        await renderLoaded();
        const fitsOnLoad = mockFitBoundsCalls;

        mockFetchZones.mockResolvedValue(zones({cellMeters: 1000, cells: [BUSY]}));
        await clickAndSettle("1 km");

        await waitFor(() => expect(mockFetchZones).toHaveBeenCalledTimes(2));
        expect(mockFetchZones.mock.calls[1]).toEqual(["2026-08-01", "2026-08-30", 1000]);
        await waitFor(() => expect(screen.getByTestId("zone-stats-summary").textContent)
            .toBe("21 delivered orders across 1 cell of 1 km"));
        expect(livePolygons()).toHaveLength(1);
        expect(mockFitBoundsCalls).toBe(fitsOnLoad);
    });

    // "12:-7" exists at every cell size and names a different area at each.
    it("drops the selection when the grid changes under it", async () => {
        await renderLoaded();
        act(() => polygonOf(BUSY).click());
        expect(screen.getByTestId("zone-details")).toBeTruthy();

        // Fresh objects, as a parsed response always is — and the same ids, the case that matters.
        mockFetchZones.mockResolvedValue(zones({cellMeters: 250, cells: [BUSY, SMALL, UNTIMED].map((c) => ({...c}))}));
        await clickAndSettle("250 m");

        await waitFor(() => expect(screen.getByTestId("zone-stats-summary").textContent)
            .toBe("21 delivered orders across 3 cells of 250 m"));
        expect(screen.queryByTestId("zone-details")).toBeNull();
    });

    // A late answer for the grid the manager has already switched away from must not win.
    it("ignores a response for a cell size that is no longer selected", async () => {
        let resolveFirst: (stats: DeliveryZoneStats) => void = () => undefined;
        mockFetchZones.mockImplementation((_start: string, _finish: string, size: DeliveryZoneCellMeters) =>
            size === 500
                ? new Promise<DeliveryZoneStats>((resolve) => { resolveFirst = resolve; })
                : Promise.resolve(zones({cellMeters: 250, cells: [SMALL]})));

        render(<DeliveryZoneStatsCard scope={SCOPE}/>);
        await clickAndSettle("250 m");
        await screen.findByTestId("zone-stats-summary");

        await act(async () => resolveFirst(zones()));

        expect(screen.getByTestId("zone-stats-summary").textContent)
            .toBe("21 delivered orders across 1 cell of 250 m");
    });

    it("says how many delivered orders could not be placed", async () => {
        await renderLoaded(zones({unlocatedOrders: 4}));

        expect(screen.getByTestId("zone-stats-unlocated").textContent)
            .toBe("4 delivered orders have no coordinates and are not shown");
    });

    it("has no footnote when every order was placed", async () => {
        await renderLoaded();

        expect(screen.queryByTestId("zone-stats-unlocated")).toBeNull();
    });

    it("says so when nothing could be placed, and still counts the unplaced orders", async () => {
        mockFetchZones.mockResolvedValue(zones({totalOrders: 0, unlocatedOrders: 1, cells: []}));
        render(<DeliveryZoneStatsCard scope={SCOPE}/>);

        expect(await screen.findByText("No delivered orders to place on the map in this range")).toBeTruthy();
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(screen.getByTestId("zone-stats-unlocated").textContent)
            .toBe("1 delivered order has no coordinates and is not shown");
    });

    it("shows an error rather than an empty map when the request fails", async () => {
        mockFetchZones.mockRejectedValue(new Error("HTTP 500"));
        render(<DeliveryZoneStatsCard scope={SCOPE}/>);

        expect((await screen.findByTestId("zone-stats-error")).textContent)
            .toBe("Could not load the delivery zones for this range.");
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(screen.queryByTestId("zone-stats-scope")).toBeNull();
    });

    // The old figures, and the label naming their range, would sit over an error about a new one.
    it("drops the previous range's figures when a later request fails", async () => {
        mockFetchZones.mockResolvedValue(zones({unlocatedOrders: 4}));
        const {rerender} = render(<DeliveryZoneStatsCard scope={SCOPE}/>);
        await screen.findByTestId("zone-stats-summary");

        mockFetchZones.mockRejectedValue(new Error("HTTP 500"));
        rerender(<DeliveryZoneStatsCard scope={{startDate: "2026-09-01", finishDate: "2026-09-01"}}/>);

        await screen.findByTestId("zone-stats-error");
        expect(screen.queryByTestId("zone-stats-scope")).toBeNull();
        expect(screen.queryByTestId("zone-stats-summary")).toBeNull();
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(screen.queryByTestId("zone-stats-unlocated")).toBeNull();
    });

    // No applied range yet means nothing to ask for; the card keeps its shape and waits.
    it("fetches nothing and shows the skeleton until a range has been applied", () => {
        render(<DeliveryZoneStatsCard scope={null}/>);

        expect(mockFetchZones).not.toHaveBeenCalled();
        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(screen.queryByTestId("zone-stats-scope")).toBeNull();
    });

    // Unlike a cell-size switch, a new range can put the orders somewhere else entirely, so the
    // map is framed again — on the new cells, not the ones it was showing.
    it("refetches when a new range is applied, and frames the map on the new range's cells", async () => {
        mockFetchZones.mockResolvedValue(zones());
        const {rerender} = render(<DeliveryZoneStatsCard scope={SCOPE}/>);
        await screen.findByTestId("zone-stats-summary");
        expect(mockFitBoundsCalls).toBe(1);

        mockExtended.length = 0;
        mockFetchZones.mockResolvedValue(zones({totalOrders: 3, cells: [SMALL]}));
        rerender(<DeliveryZoneStatsCard scope={{startDate: "2026-09-01", finishDate: "2026-09-01"}}/>);

        await waitFor(() => expect(mockFetchZones).toHaveBeenLastCalledWith("2026-09-01", "2026-09-01", 500));
        await waitFor(() => expect(screen.getByTestId("zone-stats-scope").textContent)
            .toBe("All branches · Sep 1, 2026"));
        expect(mockFitBoundsCalls).toBe(2);
        expect(mockExtended).toEqual(SMALL.vertices.map(toLatLng));
    });

    /**
     * No key means no map at all, the way CourierDispatcherPanel falls back from OrderRouteMap: the
     * same cells as a table, busiest first, with every metric side by side since there is no colour
     * scale to switch.
     */
    it("lists the cells in a table when no Maps key is configured", async () => {
        mockMapsKey.value = undefined;
        await renderLoaded();

        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(screen.queryByRole("button", {name: "Late %"})).toBeNull();
        const rows = within(screen.getByTestId("zone-stats-table")).getAllByTestId(/^zone-row-/);
        expect(rows.map((row) => row.getAttribute("data-testid")))
            .toEqual(["zone-row-12:-7", "zone-row-12:-6", "zone-row-13:-7"]);
        expect(within(rows[0]).getByText("BHD 41.250")).toBeTruthy();
        expect(within(rows[0]).getByText("25.0% (2 of 8)")).toBeTruthy();
    });
});

/**
 * The fourth metric: where customers were turned away (M3). Its own list of cells — refusals mostly
 * happen where nothing was delivered — fetched only while it is the view.
 */
describe("DeliveryZoneStatsCard — Turned away", () => {
    function lostCell(id: string, center: DeliveryZonePoint, overrides: Partial<LostDemandZoneCell>): LostDemandZoneCell {
        return {
            id,
            center,
            vertices: hexagon(center),
            refusals: 0,
            refusalsByReason: [],
            abandonedLost: 0,
            total: 0,
            ...overrides,
        };
    }

    /** Far outside the delivered area — the cells this view exists to show. */
    const FAR = lostCell("30:-2", {latitude: 26.05, longitude: 50.5}, {
        refusals: 5,
        refusalsByReason: [{reason: "OUTSIDE_RADIUS", count: 4}, {reason: "OUTSIDE_ZONE", count: 1}],
        abandonedLost: 1,
        total: 6,
    });
    const NEAR = lostCell("12:-5", {latitude: 26.22, longitude: 50.61}, {
        refusals: 1,
        refusalsByReason: [{reason: "NO_COURIER", count: 1}],
        total: 1,
    });

    function lostZones(overrides: Partial<LostDemandZoneStats> = {}): LostDemandZoneStats {
        return {
            cellMeters: 500,
            refusalsDataSince: "2026-07-01T15:00:00",
            refusalsCoverage: "FULL",
            locatedRefusals: 6,
            unlocatedRefusals: 12,
            locatedAbandoned: 1,
            unlocatedAbandoned: 2,
            cells: [FAR, NEAR],
            ...overrides,
        };
    }

    async function showTurnedAway(stats: LostDemandZoneStats = lostZones()): Promise<void> {
        mockFetchLostZones.mockResolvedValue(stats);
        await clickAndSettle("Turned away");
        await screen.findByTestId("lost-zones-table");
    }

    it("asks for nothing about lost demand until Turned away is chosen", async () => {
        await renderLoaded();

        expect(mockFetchLostZones).not.toHaveBeenCalled();
    });

    it("fetches the turned-away cells for the applied range and grid, chain-wide", async () => {
        await renderLoaded();

        await showTurnedAway();

        expect(mockFetchLostZones.mock.calls[0]).toEqual(["2026-08-01", "2026-08-30", 500]);
        expect(screen.getByTestId("lost-zones-summary").textContent).toBe("7 turned away across 2 cells of 500 m");
    });

    it("draws the turned-away cells instead of the delivered ones, darkest where most were lost", async () => {
        await renderLoaded();

        await showTurnedAway();

        expect(livePolygons()).toHaveLength(2);
        expect(fillOf(FAR)).toBe(rampColor(1));
        expect(fillOf(NEAR)).toBe(rampColor(0));
        expect(screen.getByTestId("zone-legend-max").textContent).toBe("6");
    });

    it("lists each cell's refusals by reason and orders gone at payment", async () => {
        await renderLoaded();

        await showTurnedAway();

        const cells = within(screen.getByTestId("lost-zone-row-30:-2")).getAllByRole("cell").map((c) => c.textContent);
        expect(cells).toEqual([
            "26.0500, 50.5000", "6", "5Too far (radius or drive time) 4 · Outside the delivery zones 1", "1",
        ]);
    });

    it("shows a tapped cell's numbers", async () => {
        await renderLoaded();
        await showTurnedAway();

        act(() => polygonOf(FAR).click());

        expect(screen.getByTestId("lost-zone-detail-total").textContent).toBe("6");
        expect(screen.getByTestId("lost-zone-detail-refusals").textContent).toBe("5");
        expect(screen.getByTestId("lost-zone-detail-abandoned").textContent).toBe("1");
    });

    /** What the map cannot place is counted out loud, never silently dropped. */
    it("counts the refusals and orders it cannot place", async () => {
        await renderLoaded();

        await showTurnedAway();

        expect(screen.getByTestId("lost-zones-unlocated-refusals").textContent)
            .toBe("12 refusals came from the cart, before an address existed, and have no place on the map");
        expect(screen.getByTestId("lost-zones-unlocated-abandoned").textContent)
            .toBe("2 orders gone at payment had no pin and are not shown");
        expect(screen.queryByTestId("zone-stats-unlocated")).toBeNull();
    });

    it("refetches the turned-away cells with the chosen cell size", async () => {
        await renderLoaded();
        await showTurnedAway();

        mockFetchLostZones.mockResolvedValue(lostZones({cellMeters: 1000, cells: [FAR]}));
        await clickAndSettle("1 km");

        await waitFor(() => expect(mockFetchLostZones).toHaveBeenLastCalledWith("2026-08-01", "2026-08-30", 1000));
        await waitFor(() => expect(screen.getByTestId("lost-zones-summary").textContent)
            .toBe("6 turned away across 1 cell of 1 km"));
    });

    it("captions refusals recorded for only part of the range", async () => {
        await renderLoaded();

        await showTurnedAway(lostZones({refusalsCoverage: "PARTIAL", refusalsDataSince: "2026-08-20T15:00:00"}));

        expect(screen.getByTestId("lost-zones-coverage").textContent)
            .toBe("Refusals — Counted from 20 Aug 2026, 15:00. Earlier days in this range have no data.");
    });

    /** Before recording began, only abandoned orders can place a cell — and the card says so. */
    it("says refusals were not recorded yet, and still maps the abandoned orders", async () => {
        await renderLoaded();

        await showTurnedAway(lostZones({
            refusalsCoverage: "NONE", refusalsDataSince: "2026-10-06T15:00:00",
            locatedRefusals: 0, unlocatedRefusals: 0, locatedAbandoned: 1,
            cells: [lostCell("30:-2", FAR.center, {abandonedLost: 1, total: 1})],
        }));

        expect(screen.getByTestId("lost-zones-coverage").textContent)
            .toBe("Refusals — No data before 6 Oct 2026, 15:00. Only orders gone at payment are on the map.");
        expect(screen.queryByTestId("lost-zones-unlocated-refusals")).toBeNull();
        expect(livePolygons()).toHaveLength(1);
    });

    /** The server sends refusals=0 for every cell then; a printed 0 would read as "nobody refused here". */
    it("shows an unrecorded cell's refusals as a dash, never as 0", async () => {
        await renderLoaded();
        const abandonedOnly = lostCell("30:-2", FAR.center, {abandonedLost: 1, total: 1});

        await showTurnedAway(lostZones({
            refusalsCoverage: "NONE", refusalsDataSince: "2026-10-06T15:00:00",
            locatedRefusals: 0, unlocatedRefusals: 0, locatedAbandoned: 1,
            cells: [abandonedOnly],
        }));

        const row = within(screen.getByTestId("lost-zone-row-30:-2")).getAllByRole("cell").map((c) => c.textContent);
        expect(row).toEqual(["26.0500, 50.5000", "1", "—", "1"]);
        act(() => polygonOf(abandonedOnly).click());
        expect(screen.getByTestId("lost-zone-detail-refusals").textContent).toBe("—");
        expect(screen.getByTestId("lost-zone-detail-abandoned").textContent).toBe("1");
    });

    it("says nobody was turned away rather than drawing an empty map", async () => {
        await renderLoaded();
        mockFetchLostZones.mockResolvedValue(lostZones({cells: [], locatedRefusals: 0, unlocatedRefusals: 0,
            locatedAbandoned: 0, unlocatedAbandoned: 0}));

        await clickAndSettle("Turned away");

        expect(await screen.findByText("Nobody was turned away at a pinned address in this range")).toBeTruthy();
    });

    it("shows an error rather than an empty map when the request fails", async () => {
        await renderLoaded();
        mockFetchLostZones.mockRejectedValue(new Error("HTTP 500"));

        await clickAndSettle("Turned away");

        expect((await screen.findByTestId("lost-zones-error")).textContent)
            .toBe("Could not load where customers were turned away for this range.");
    });

    it("goes back to the delivered cells when another metric is chosen", async () => {
        await renderLoaded();
        await showTurnedAway();

        await clickAndSettle("Orders");

        await screen.findByTestId("zone-stats-summary");
        expect(screen.queryByTestId("lost-zones-table")).toBeNull();
        expect(livePolygons()).toHaveLength(3);
    });

    /** Without a key there is no colour scale: the choice is just which list of cells to read. */
    it("offers Delivered or Turned away as tables when no Maps key is configured", async () => {
        mockMapsKey.value = undefined;
        await renderLoaded();
        expect(screen.getByRole("button", {name: "Delivered"})).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Avg time"})).toBeNull();

        await showTurnedAway();

        expect(screen.queryByTestId("google-map")).toBeNull();
        expect(within(screen.getByTestId("lost-zones-table")).getAllByTestId(/^lost-zone-row-/)).toHaveLength(2);
        expect(screen.queryByTestId("zone-stats-table")).toBeNull();
    });
});

