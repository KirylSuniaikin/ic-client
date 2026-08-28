import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { AddressPickerDrawer } from "./AddressPickerDrawer";
import type {
    CreateCustomerAddressRequest, CustomerAddress, UpdateCustomerAddressRequest,
} from "../types";

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

    describe("edit mode (the pencil)", () => {
        const SAVED: CustomerAddress = {
            id: "a1", label: "Home", block: "338", road: "3801", building: "12", flat: "4",
            note: "gate code 1234", latitude: 26.2285, longitude: 50.586,
        };

        function renderEditor() {
            const onUpdate = jest.fn<void, [string, UpdateCustomerAddressRequest]>();
            render(
                <I18nextProvider i18n={i18n}>
                    <AddressPickerDrawer
                        open
                        onClose={jest.fn()}
                        onSave={jest.fn()}
                        editing={SAVED}
                        onUpdate={onUpdate}
                    />
                </I18nextProvider>
            );
            return { onUpdate };
        }

        it("seeds every text field from the address being edited", () => {
            mockGeolocation(() => undefined);
            renderEditor();

            expect((screen.getByLabelText(/block/i) as HTMLInputElement).value).toBe("338");
            expect((screen.getByLabelText(/building/i) as HTMLInputElement).value).toBe("12");
            expect((screen.getByLabelText(/flat/i) as HTMLInputElement).value).toBe("4");
            expect((screen.getByLabelText(/label/i) as HTMLInputElement).value).toBe("Home");
        });

        /**
         * Latitude and longitude drive nearest-branch routing, the radius check and the ETA, and
         * the row may already be attached to an order a courier is running. The pencil says the
         * pin is fixed rather than offering to move it.
         */
        it("replaces the pin capture with a note that the pin stays put", () => {
            mockGeolocation(() => undefined);
            renderEditor();

            expect(screen.queryByRole("button", { name: /use my current location/i })).toBeNull();
            expect(screen.getByText(/pin stays where it is/i)).toBeTruthy();
        });

        it("sends only text, and only to the address being edited", () => {
            mockGeolocation(() => undefined);
            const { onUpdate } = renderEditor();

            fireEvent.change(screen.getByLabelText(/building/i), { target: { value: "14" } });
            fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

            expect(onUpdate).toHaveBeenCalledWith("a1", {
                label: "Home", block: "338", road: "3801", building: "14", flat: "4",
                note: "gate code 1234",
            });
        });

        /** An edit already has a pin, so nothing gates the button but the request in flight. */
        it("enables save immediately, with no pin capture needed", () => {
            mockGeolocation(() => undefined);
            renderEditor();

            const button = screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement;
            expect(button.disabled).toBe(false);
        });

        /** Clearing a field must clear the column, not leave the old value in place. */
        it("sends null for a field the customer emptied", () => {
            mockGeolocation(() => undefined);
            const { onUpdate } = renderEditor();

            fireEvent.change(screen.getByLabelText(/delivery note/i), { target: { value: "  " } });
            fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

            expect(onUpdate).toHaveBeenCalledWith("a1", expect.objectContaining({ note: null }));
        });
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
