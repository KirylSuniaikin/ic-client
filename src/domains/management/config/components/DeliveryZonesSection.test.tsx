import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import DeliveryZonesSection from "./DeliveryZonesSection";
import {
    createDeliveryZone, deleteDeliveryZone, fetchDeliveryZones, updateDeliveryZone,
} from "../../../../shared/api/management";
import type { DeliveryZone } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

// The Maps key decides whether the section draws a map or falls back to a coordinate list, and it
// is a module const read from process.env at import time — so it is exposed through a getter here
// rather than a fixed value, which a plain object factory would freeze. The `mock` name prefix is
// what lets the hoisted factory close over it.
const mockMapsKey: { value: string | undefined } = { value: "test-key" };
jest.mock("../../../branch/utils/mapsConfig", () => ({
    get GOOGLE_MAPS_API_KEY(): string | undefined { return mockMapsKey.value; },
    GOOGLE_MAPS_MAP_ID: undefined,
    LIGHT_MAP_STYLES: [],
}));

/**
 * The map is a probe: it needs the real Google loader, and what these tests are about is the
 * draft, the validation gate and what reaches the API. Drawing is simulated by pushing a polygon
 * up through the same callback the real overlay uses.
 */
const mockDrawnPolygon: { value: number[][] } = { value: [] };
jest.mock("./DeliveryZoneMap", () => ({
    DeliveryZoneMap: (
        { onPolygonChange, radiusKm }: { onPolygonChange: (polygon: number[][]) => void; radiusKm: number | null }
    ) => (
        <>
            <button type="button" onClick={() => onPolygonChange(mockDrawnPolygon.value)}>
                draw
            </button>
            {/* The circle itself is covered by DeliveryZoneMap.test.tsx against a fake Google
                loader; what this suite can prove is that the radius reaches the map at all. */}
            <div data-testid="map-radius">{String(radiusKm)}</div>
        </>
    ),
}));

const mockFetch = jest.mocked(fetchDeliveryZones);
const mockCreate = jest.mocked(createDeliveryZone);
const mockUpdate = jest.mocked(updateDeliveryZone);
const mockDelete = jest.mocked(deleteDeliveryZone);

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const TRIANGLE: number[][] = [[50.57, 26.21], [50.59, 26.21], [50.58, 26.24]];

const ZONE: DeliveryZone = {
    id: "z1", branchId: "b1", branchName: "Manama", name: "North",
    polygon: TRIANGLE.map((point) => [...point]), active: true,
};

function renderSection(
    onDirtyChange = jest.fn<void, [boolean]>(),
    branchRadiusKm: number | null = 7,
    coords: { lat: number | null; lng: number | null } = { lat: 26.22, lng: 50.58 },
): { onDirtyChange: typeof onDirtyChange } {
    render(
        <DeliveryZonesSection
            branchId="b1"
            branchLatitude={coords.lat}
            branchLongitude={coords.lng}
            branchRadiusKm={branchRadiusKm}
            onDirtyChange={onDirtyChange}
        />
    );
    return { onDirtyChange };
}

beforeEach(() => {
    // resetMocks is on, so implementations set at module scope would already be gone.
    mockMapsKey.value = "test-key";
    mockDrawnPolygon.value = TRIANGLE;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue([ZONE]);
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(ZONE);
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(ZONE);
    mockDelete.mockReset();
    mockDelete.mockResolvedValue(undefined);
});

describe("DeliveryZonesSection", () => {
    it("loads the selected branch's zones", async () => {
        renderSection();

        await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("b1"));
        expect(await screen.findByText("North")).toBeTruthy();
        expect(screen.getByText("3 points")).toBeTruthy();
    });

    /**
     * Says which direction a zone acts in, because getting that backwards is the whole risk here:
     * drawing one does not extend the branch's reach, it restricts it.
     */
    it("states that a zone narrows coverage rather than extending it", async () => {
        renderSection();

        expect(await screen.findByText(/narrows where this kitchen delivers/)).toBeTruthy();
    });

    /**
     * The server returns an EMPTY polygon for a stored shape it could not parse. That row is the
     * one currently blocking delivery for the branch, so it has to be visible and named as broken
     * rather than rendered as a zone with no points.
     */
    it("flags a stored zone whose shape could not be read", async () => {
        mockFetch.mockResolvedValue([{ ...ZONE, polygon: [] }]);
        renderSection();

        expect(await screen.findByText(/Stored shape could not be read/)).toBeTruthy();
    });

    /**
     * The save gate. A polygon under three points parses as "covers nothing" server-side, and
     * since zones fail closed that save would stop this branch delivering anywhere.
     */
    it("will not send a polygon with fewer than three points", async () => {
        mockDrawnPolygon.value = [[50.57, 26.21], [50.59, 26.21]];
        renderSection();

        fireEvent.click(await screen.findByText("+ New zone"));
        fireEvent.change(screen.getByLabelText("Zone name"), { target: { value: "North" } });
        fireEvent.click(screen.getByText("draw"));

        expect(await screen.findByTestId("zone-validation")).toBeTruthy();
        const save = screen.getByRole("button", { name: "Save zone" });
        expect(save.hasAttribute("disabled")).toBe(true);

        fireEvent.click(save);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("will not send a zone with no name", async () => {
        renderSection();

        fireEvent.click(await screen.findByText("+ New zone"));
        fireEvent.click(screen.getByText("draw"));

        expect(screen.getByRole("button", { name: "Save zone" }).hasAttribute("disabled")).toBe(true);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    /** [longitude, latitude], never lat/lon: the swap draws the zone in the wrong hemisphere. */
    it("posts the drawn polygon in longitude, latitude order against the selected branch", async () => {
        renderSection();

        fireEvent.click(await screen.findByText("+ New zone"));
        fireEvent.change(screen.getByLabelText("Zone name"), { target: { value: " North " } });
        fireEvent.click(screen.getByText("draw"));
        fireEvent.click(screen.getByRole("button", { name: "Save zone" }));

        await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
            branchId: "b1",
            name: "North",
            polygon: TRIANGLE,
            active: true,
        }));
    });

    it("updates an existing zone in place rather than creating a second one", async () => {
        renderSection();

        fireEvent.click(await screen.findByText("Edit"));
        fireEvent.click(screen.getByRole("button", { name: "Save zone" }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("z1", {
            branchId: "b1", name: "North", polygon: TRIANGLE, active: true,
        }));
        expect(mockCreate).not.toHaveBeenCalled();
    });

    /**
     * Feeds ConfigComponent's branch-switch guard. Reported rather than inferred from "the editor
     * is open": opening a saved zone to look at it is not work to lose, and prompting for it
     * would train the manager to dismiss the prompt.
     */
    it("reports dirty only once the draft actually differs from what is stored", async () => {
        const onDirtyChange = jest.fn<void, [boolean]>();
        renderSection(onDirtyChange);

        fireEvent.click(await screen.findByText("Edit"));
        await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));

        fireEvent.change(screen.getByLabelText("Zone name"), { target: { value: "South" } });
        await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    });

    it("reports clean again once the draft is abandoned", async () => {
        const onDirtyChange = jest.fn<void, [boolean]>();
        renderSection(onDirtyChange);

        fireEvent.click(await screen.findByText("Edit"));
        fireEvent.change(screen.getByLabelText("Zone name"), { target: { value: "South" } });
        await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    });

    /** Deleting a zone widens coverage silently, so it goes through a confirmation. */
    it("confirms before deleting, and offers switching off as the reversible alternative", async () => {
        renderSection();

        fireEvent.click(await screen.findByText("Delete"));
        expect(await screen.findByText("Delete this zone?")).toBeTruthy();
        expect(screen.getByText(/switch it off instead/)).toBeTruthy();
        expect(mockDelete).not.toHaveBeenCalled();

        // The row's own Delete is aria-hidden behind the open dialog, so only the dialog's
        // remains reachable by role.
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("z1"));
    });

    it("keeps the zone when the confirmation is dismissed", async () => {
        renderSection();

        fireEvent.click(await screen.findByText("Delete"));
        fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(screen.queryByText("Delete this zone?")).toBeNull());
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it("says the zone was not changed when the save fails", async () => {
        mockCreate.mockRejectedValue(new Error("HTTP 400"));
        renderSection();

        fireEvent.click(await screen.findByText("+ New zone"));
        fireEvent.change(screen.getByLabelText("Zone name"), { target: { value: "North" } });
        fireEvent.click(screen.getByText("draw"));
        fireEvent.click(screen.getByRole("button", { name: "Save zone" }));

        expect(await screen.findByTestId("zone-error")).toBeTruthy();
        expect(screen.getByText(/has not been changed/)).toBeTruthy();
    });

    describe("with no Maps key configured", () => {
        beforeEach(() => { mockMapsKey.value = undefined; });

        /**
         * The same fallback BranchListView and the route drill-down use. Drawing is the one thing
         * genuinely impossible without a key, so it is the one thing withdrawn — the stored
         * shapes stay readable.
         */
        it("falls back to a coordinate list and offers no drawing", async () => {
            renderSection();

            expect(await screen.findByText(/No Google Maps key is configured/)).toBeTruthy();
            expect(await screen.findByText("50.57000, 26.21000")).toBeTruthy();
            expect(screen.queryByText("+ New zone")).toBeNull();
        });
    });

    /**
     * The section's copy already tells a manager that a zone narrows the radius and never extends
     * it. Handing the radius to the map is what turns that sentence into something they can see.
     */
    it("hands the branch's delivery radius to the map", async () => {
        mockFetch.mockResolvedValue([]);
        renderSection();

        fireEvent.click(await screen.findByText("+ New zone"));

        expect(screen.getByTestId("map-radius").textContent).toBe("7");
    });

    it("passes no radius through when the branch payload carried none", async () => {
        mockFetch.mockResolvedValue([]);
        renderSection(jest.fn<void, [boolean]>(), null);

        fireEvent.click(await screen.findByText("+ New zone"));

        expect(screen.getByTestId("map-radius").textContent).toBe("null");
    });

    /**
     * The map used to mount only inside the editor, so opening this screen showed a list and no
     * geography — and the radius, which is the area a zone is drawn INSIDE, stayed invisible until
     * the manager pressed "New zone". The coverage circle is the default view now.
     */
    it("shows the branch's delivery area before any zone is being edited", () => {
        renderSection(jest.fn<void, [boolean]>(), 3);

        // The stub stands in for the map; its presence is what proves one is mounted at all.
        expect(screen.getByTestId("map-radius").textContent).toBe("3");
        expect(screen.getByText(/Delivery radius: 3 km/)).toBeTruthy();
    });

    /**
     * A branch with no coordinates cannot have its area drawn at all. Saying so is the difference
     * between "the feature is broken" and "this branch is not set up yet" — the owner hit exactly
     * that confusion.
     */
    it("says why there is no map when the branch has no coordinates", () => {
        renderSection(jest.fn<void, [boolean]>(), 7, { lat: null, lng: null });

        expect(screen.getByText(/no coordinates saved/)).toBeTruthy();
        expect(screen.queryByTestId("map-radius")).toBeNull();
    });
});
