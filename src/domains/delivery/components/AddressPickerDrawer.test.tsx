import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { AddressPickerDrawer } from "./AddressPickerDrawer";
import type { CreateCustomerAddressRequest } from "../types";

type GeoSuccess = (position: { coords: { latitude: number; longitude: number } }) => void;
type GeoFailure = () => void;

let savedGeolocation: unknown;

function mockGeolocation(impl: (ok: GeoSuccess, fail: GeoFailure) => void): void {
    Object.defineProperty(global.navigator, "geolocation", {
        value: { getCurrentPosition: (ok: GeoSuccess, fail: GeoFailure) => impl(ok, fail) },
        configurable: true,
    });
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

/** The repo does not use jest-dom, so disabled state is read off the element itself. */
function saveButton(): HTMLButtonElement {
    return screen.getByRole("button", { name: /save address/i }) as HTMLButtonElement;
}

function renderDrawer(props: Partial<React.ComponentProps<typeof AddressPickerDrawer>> = {}) {
    const onSave = jest.fn<void, [CreateCustomerAddressRequest]>();
    const onClose = jest.fn<void, []>();
    render(
        <I18nextProvider i18n={i18n}>
            <AddressPickerDrawer open onClose={onClose} onSave={onSave} {...props} />
        </I18nextProvider>
    );
    return { onSave, onClose };
}

describe("AddressPickerDrawer", () => {
    /**
     * The pin is the source of truth for routing, the radius check and the ETA (§1.4), and the
     * backend rejects a save without one rather than defaulting to 0,0 — a real coordinate in
     * the Gulf of Guinea. The form must enforce the same rule instead of relying on the 400.
     */
    it("keeps save disabled until a pin has been captured", () => {
        mockGeolocation(() => undefined);
        renderDrawer();

        expect(saveButton().disabled).toBe(true);
    });

    it("captures the pin from the browser and enables save", async () => {
        mockGeolocation((ok) => ok({ coords: { latitude: 26.2285, longitude: 50.586 } }));
        renderDrawer();

        fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

        await waitFor(() => {
            expect(saveButton().disabled).toBe(false);
        });
    });

    it("sends the pin and the Bahrain parts on save", async () => {
        mockGeolocation((ok) => ok({ coords: { latitude: 26.2285, longitude: 50.586 } }));
        const { onSave } = renderDrawer();

        fireEvent.change(screen.getByLabelText(/block/i), { target: { value: "338" } });
        fireEvent.change(screen.getByLabelText(/road/i), { target: { value: "3801" } });
        fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

        await waitFor(() => expect(saveButton().disabled).toBe(false));
        fireEvent.click(saveButton());

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ block: "338", road: "3801", latitude: 26.2285, longitude: 50.586 })
        );
    });

    /** Denied/unavailable/timed-out all read the same to the customer and have the same fix. */
    it("explains a denied location rather than failing silently", async () => {
        mockGeolocation((_ok, fail) => fail());
        renderDrawer();

        fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

        expect(await screen.findByText(/allow location access/i)).toBeTruthy();
        expect(saveButton().disabled).toBe(true);
    });

    /** Empty optional fields must go as null, not "", so the DB holds no blank strings. */
    it("normalises untouched optional fields to null", async () => {
        mockGeolocation((ok) => ok({ coords: { latitude: 26.2, longitude: 50.5 } }));
        const { onSave } = renderDrawer();

        fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));
        await waitFor(() => expect(saveButton().disabled).toBe(false));
        fireEvent.click(saveButton());

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ block: null, road: null, building: null, flat: null, note: null })
        );
    });
});
