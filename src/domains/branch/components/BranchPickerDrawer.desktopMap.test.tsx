import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { BranchPickerDrawer } from "./BranchPickerDrawer";
import { BranchMapView } from "./BranchMapView";
import type { BranchMapViewProps } from "./BranchMapView";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import type { BaseAppInfoResponse } from "../../order/types";
import type { IBranch } from "../../management/inventory/types";

// Map mode on PC: the list column beside the map in one wide dialog. In its own file because the
// Maps key mock is module-wide.

jest.mock("../utils/mapsConfig", () => ({ GOOGLE_MAPS_API_KEY: "test-key" }));
jest.mock("./BranchMapView");
jest.mock("../../../shared/api/public");

const mockMapView = jest.mocked(BranchMapView);

const SMICHOV: IBranch = {
    id: "b1", externalId: "ext-1", branchNo: 1, branchName: "Smichov",
    locale: "en", latitude: 50.07, longitude: 14.4, address: "Plzenska 8",
};

function baseInfo(): BaseAppInfoResponse {
    return {
        menu: [] as unknown as BaseAppInfoResponse["menu"],
        extraIngr: [], toppings: [], isSDoughAvailable: true, userInfo: null, workingHours: null,
    };
}

function lastMapProps(): BranchMapViewProps {
    const calls = mockMapView.mock.calls;
    if (calls.length === 0) throw new Error("the map was never rendered");
    return calls[calls.length - 1][0];
}

beforeEach(() => {
    stubMatchMedia(true);
    jest.mocked(fetchBaseAppInfo).mockResolvedValue(baseInfo());
    // CRA's resetMocks clears the manual mock's implementation before every test.
    mockMapView.mockImplementation((props: BranchMapViewProps) => (
        <div data-testid="branch-map-view-mock">
            {props.branches.map((branch) => (
                <button key={branch.id} onClick={() => props.onSelectBranch(branch)}>
                    {branch.branchName}
                </button>
            ))}
        </div>
    ));
});

afterEach(() => {
    clearMatchMedia();
});

describe("BranchPickerDrawer on PC with a map", () => {
    it("shows the list beside the map in a wide dialog, and the map follows the open details", async () => {
        render(
            <I18nextProvider i18n={i18n}>
                <BranchPickerDrawer open branches={[SMICHOV]} onSelect={jest.fn()} dismissable onClose={jest.fn()} />
            </I18nextProvider>
        );

        const paper = document.querySelector(".MuiDialog-paper");
        expect(paper).toBeTruthy();
        const rules = emotionRulesFor(paper as Element);
        expect(rules).toContain("width:min(1080px, 92vw)");
        expect(rules).toContain("height:min(720px, 90vh)");

        const map = screen.getByTestId("branch-map-view-mock");
        expect(screen.getByTestId("branch-option-b1")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Show branch list" })).toBeNull();
        expect(lastMapProps().layout).toBe("dialog");
        expect(lastMapProps().activeBranchId).toBeNull();

        fireEvent.click(within(map).getByRole("button", { name: "Smichov" }));

        expect(lastMapProps().activeBranchId).toBe("b1");
        expect(screen.getByRole("button", { name: "All branches" })).toBeTruthy();
        expect(screen.getByTestId("branch-map-view-mock")).toBeTruthy();
        expect(await screen.findByText("Open now")).toBeTruthy();
    });
});
