import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { BranchPickerDrawer } from "./BranchPickerDrawer";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import type { BaseAppInfoResponse } from "../../order/types";
import type { IBranch } from "../../management/inventory/types";

// The PC picker: one centred dialog, the real branch list in it, the details replacing the list
// in the same column. No Maps key under test, so this is the list-only dialog; the map column has
// its own suite (BranchPickerDrawer.desktopMap.test.tsx) because its key mock is module-wide.

jest.mock("./BranchMapView");
jest.mock("../../../shared/api/public");

const mockFetch = jest.mocked(fetchBaseAppInfo);

const SMICHOV: IBranch = {
    id: "b1", externalId: "ext-1", branchNo: 1, branchName: "Smichov",
    locale: "en", latitude: 50.07, longitude: 14.4, address: "Plzenska 8",
};
const KARLIN: IBranch = {
    id: "b2", externalId: "ext-2", branchNo: 2, branchName: "Karlin",
    locale: "en", latitude: null, longitude: null, address: null,
};

function baseInfo(): BaseAppInfoResponse {
    return {
        menu: [] as unknown as BaseAppInfoResponse["menu"],
        extraIngr: [], toppings: [], isSDoughAvailable: true, userInfo: null, workingHours: null,
    };
}

type GeoSuccess = (position: { coords: { latitude: number; longitude: number } }) => void;

let savedGeolocation: unknown;

function mockGeolocation(impl: (ok: GeoSuccess) => void): void {
    Object.defineProperty(global.navigator, "geolocation", {
        value: { getCurrentPosition: (ok: GeoSuccess) => impl(ok) },
        configurable: true,
    });
}

function renderPicker(props: Partial<React.ComponentProps<typeof BranchPickerDrawer>> = {}) {
    const onSelect = jest.fn<void, [IBranch]>();
    const onClose = jest.fn<void, []>();
    render(
        <I18nextProvider i18n={i18n}>
            <BranchPickerDrawer open branches={[SMICHOV, KARLIN]} onSelect={onSelect} dismissable onClose={onClose} {...props} />
        </I18nextProvider>
    );
    return { onSelect, onClose };
}

function dialogRoot(): HTMLElement {
    const root = document.querySelector<HTMLElement>(".MuiDialog-root");
    if (root === null) throw new Error("no dialog root");
    return root;
}

function pressEscape(): void {
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
}

function clickBackdrop(): void {
    // MUI's Dialog closes on a click that both starts and ends on its container, outside the paper.
    const container = dialogRoot().querySelector(".MuiDialog-container");
    if (container === null) throw new Error("no dialog container");
    fireEvent.mouseDown(container);
    fireEvent.click(container);
}

beforeEach(() => {
    stubMatchMedia(true);
    mockFetch.mockResolvedValue(baseInfo());
    savedGeolocation = (global.navigator as { geolocation?: unknown }).geolocation;
});

afterEach(() => {
    clearMatchMedia();
    Object.defineProperty(global.navigator, "geolocation", { value: savedGeolocation, configurable: true });
});

describe("BranchPickerDrawer on PC", () => {
    it("is a 480px dialog above the cart that shows the list with no toggle", () => {
        renderPicker();

        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        expect(Number(window.getComputedStyle(dialogRoot()).zIndex)).toBe(1301);
        const paper = dialogRoot().querySelector(".MuiDialog-paper");
        expect(paper).toBeTruthy();
        expect(emotionRulesFor(paper as Element)).toContain("width:min(480px, 92vw)");

        expect(screen.getByRole("heading", { name: "Choose your branch" })).toBeTruthy();
        expect(screen.getByTestId("branch-option-b1")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Show branch list" })).toBeNull();
    });

    it("shows a branch's details in the same dialog, and All branches steps back to its row", async () => {
        renderPicker();

        fireEvent.click(screen.getByTestId("branch-option-b1"));

        const heading = screen.getByRole("heading", { name: "Smichov" });
        expect(document.activeElement).toBe(heading);
        expect(screen.queryByTestId("branch-option-b1")).toBeNull();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        expect(await screen.findByText("Open now")).toBeTruthy();
        expect(mockFetch).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "All branches" }));

        expect(screen.getByRole("heading", { name: "Choose your branch" })).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByTestId("branch-option-b1"));
    });

    it("goes back to the list on Esc from the details instead of closing", () => {
        const { onClose } = renderPicker();

        fireEvent.click(screen.getByTestId("branch-option-b1"));
        pressEscape();

        expect(screen.getByTestId("branch-option-b1")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();

        pressEscape();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("cannot be dismissed when it is the first-visit gate", () => {
        const { onClose } = renderPicker({ dismissable: false });

        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
        pressEscape();
        clickBackdrop();
        expect(screen.getByTestId("branch-option-b1")).toBeTruthy();

        // Esc on the details step of the gate still only goes back.
        fireEvent.click(screen.getByTestId("branch-option-b1"));
        pressEscape();
        expect(screen.getByTestId("branch-option-b1")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("closes from its close button", () => {
        const { onClose } = renderPicker();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("chooses the branch from Order here in the details", () => {
        const { onSelect } = renderPicker();

        fireEvent.click(screen.getByTestId("branch-option-b1"));
        fireEvent.click(screen.getByRole("button", { name: /order here/i }));

        expect(onSelect).toHaveBeenCalledWith(SMICHOV);
        expect(screen.getByTestId("branch-option-b1")).toBeTruthy();
    });

    it("opens the nearest branch in the details once the position resolves", async () => {
        mockGeolocation((ok) => ok({ coords: { latitude: 50.0, longitude: 14.0 } }));
        renderPicker();

        fireEvent.click(screen.getByRole("button", { name: "Use nearest branch" }));

        expect(screen.getByRole("heading", { name: "Smichov" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "All branches" })).toBeTruthy();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        expect(await screen.findByText("Open now")).toBeTruthy();
    });
});
