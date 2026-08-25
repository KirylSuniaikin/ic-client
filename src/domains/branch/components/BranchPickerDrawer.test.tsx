import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { BranchPickerDrawer } from "./BranchPickerDrawer";
import type { IBranch } from "../../management/inventory/types";

// Auto-loads components/__mocks__/BranchMapView.tsx — avoids ever touching the real
// @react-google-maps/api script in this orchestration-only suite.
jest.mock("./BranchMapView");

// The details sheet between a tap and the choice asks the branch's own base-app-info for its
// hours and menu. Auto-mocked so this orchestration suite never issues a real request.
jest.mock("../../../shared/api/public");

// Inline probe for BranchListView. Deliberately NOT jest.fn() here: a hoisted jest.mock()
// factory cannot reference `jest` when it's imported as a local value from @jest/globals (this
// repo's Jest Mock Factory Pattern) — a plain function has no such restriction.
type ListProbeProps = {
    branches: IBranch[];
    distances: Record<string, number | null> | null;
    nearestBranchId: string | null;
    onSelectBranch: (branch: IBranch) => void;
    onUseNearestBranch: () => void;
    locating: boolean;
    locationError: string | null;
};

jest.mock("./BranchListView", () => ({
    BranchListView: (props: ListProbeProps) => (
        <div data-testid="branch-list-view-probe">
            <button onClick={props.onUseNearestBranch}>nearest-probe</button>
            {props.locationError !== null && <span data-testid="location-error-probe">{props.locationError}</span>}
            {props.branches.map((branchItem) => (
                <div key={branchItem.id}>
                    <button onClick={() => props.onSelectBranch(branchItem)}>{branchItem.branchName}</button>
                    <span data-testid={`distance-${branchItem.id}`}>
                        {props.distances && props.distances[branchItem.id] !== null && props.distances[branchItem.id] !== undefined
                            ? props.distances[branchItem.id]
                            : "none"}
                    </span>
                </div>
            ))}
        </div>
    ),
}));

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

type GeoSuccess = (position: { coords: { latitude: number; longitude: number } }) => void;
type GeoFailure = () => void;

let savedGeolocation: unknown;

// Return type is inferred from jest.fn<...>(...) — never annotated, per this repo's no-@types/jest
// convention (never `let m: jest.Mock<...>`).
function mockGeolocation(impl: (ok: GeoSuccess, fail: GeoFailure) => void) {
    const spy = jest.fn<void, [GeoSuccess, GeoFailure]>((ok, fail) => impl(ok, fail));
    Object.defineProperty(global.navigator, "geolocation", {
        value: { getCurrentPosition: spy },
        configurable: true,
    });
    return spy;
}

beforeEach(() => {
    savedGeolocation = (global.navigator as { geolocation?: unknown }).geolocation;
});

afterEach(() => {
    Object.defineProperty(global.navigator, "geolocation", {
        value: savedGeolocation,
        configurable: true,
    });
});

// Tapping a branch now opens the details sheet; the choice is only made by its CTA.
function chooseFromDetailsSheet(): void {
    fireEvent.click(screen.getByRole("button", { name: /order here/i }));
}

function renderDrawer(props: Partial<React.ComponentProps<typeof BranchPickerDrawer>> = {}) {
    const onSelect = jest.fn<void, [IBranch]>();
    const branches = [branch(), branch({ id: "b2", branchName: "Karlin", latitude: null, longitude: null })];
    render(
        <I18nextProvider i18n={i18n}>
            <BranchPickerDrawer open branches={branches} onSelect={onSelect} {...props} />
        </I18nextProvider>
    );
    return { onSelect, branches };
}

describe("BranchPickerDrawer", () => {
    it("never requests geolocation on mount, and requests it exactly once after 'nearest' is clicked", () => {
        const getCurrentPositionSpy = mockGeolocation(() => undefined);
        renderDrawer();

        expect(getCurrentPositionSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("nearest-probe"));

        expect(getCurrentPositionSpy).toHaveBeenCalledTimes(1);
    });

    it("renders and is selectable with no Google Maps key set — the map is never mounted", () => {
        const { onSelect, branches } = renderDrawer();

        expect(screen.queryByTestId("branch-map-view-mock")).toBeNull();

        fireEvent.click(screen.getByText("Smichov"));

        chooseFromDetailsSheet();
        expect(onSelect).toHaveBeenCalledWith(branches[0]);
    });

    it("lists and keeps selectable a branch with null coordinates, never assigning it a distance", () => {
        mockGeolocation((ok) => ok({ coords: { latitude: 26.0, longitude: 50.0 } }));
        const { onSelect } = renderDrawer();

        fireEvent.click(screen.getByText("nearest-probe"));

        // Karlin (b2) has null lat/lng — it stays listed and selectable...
        expect(screen.getByTestId("distance-b2").textContent).toBe("none");
        fireEvent.click(screen.getByText("Karlin"));
        chooseFromDetailsSheet();
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "b2", latitude: null, longitude: null }));

        // ...while Smichov (b1), which has coordinates, gets a real distance.
        expect(screen.getByTestId("distance-b1").textContent).not.toBe("none");
    });

    it("dismissable=false renders no close affordance and never invokes onClose from backdrop/Esc", () => {
        mockGeolocation(() => undefined);
        const onClose = jest.fn<void, []>();
        renderDrawer({ dismissable: false, onClose });

        expect(screen.queryByRole("button", { name: /close/i })).toBeNull();

        const backdrop = document.querySelector(".MuiBackdrop-root");
        if (backdrop) fireEvent.click(backdrop);
        fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });

        expect(onClose).not.toHaveBeenCalled();
    });

    it("dismissable=true renders a close affordance and invokes onClose when tapped", () => {
        mockGeolocation(() => undefined);
        const onClose = jest.fn<void, []>();
        renderDrawer({ dismissable: true, onClose });

        fireEvent.click(screen.getByRole("button", { name: /close/i }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("surfaces a location error inline on denial without blocking selection", () => {
        mockGeolocation((_ok, fail) => fail());
        const { onSelect, branches } = renderDrawer();

        fireEvent.click(screen.getByText("nearest-probe"));

        expect(screen.getByTestId("location-error-probe")).toBeTruthy();

        fireEvent.click(screen.getByText("Smichov"));
        chooseFromDetailsSheet();
        expect(onSelect).toHaveBeenCalledWith(branches[0]);
    });
});
