import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

// The Maps JS SDK never loads under jsdom, so without this `useJsApiLoader` reports
// `isLoaded: false` forever and `useReverseGeocode` short-circuits to null — which is exactly why
// the prefill below used to no-op silently and this suite proved nothing about it
// (DELIVERY_COVERAGE_MATRIX.md D9). Names start with `mock` so babel-jest lets the hoisted factory
// close over them; plain values, not jest.fn()s, because CRA resets mocks between cases.
let mockGeocodeComponents: Array<{ long_name: string; types: string[] }> = [];
jest.mock("@react-google-maps/api", () => ({
    useJsApiLoader: () => ({ isLoaded: true }),
}));

import i18n from "../../../shared/i18n";
import { AddressPickerDrawer } from "./AddressPickerDrawer";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { sheetHandleCount } from "../../../shared/components/sheetHandle.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import type {
    CreateCustomerAddressRequest, CustomerAddress, UpdateCustomerAddressRequest,
} from "../types";

// The Maps SDK installs itself as a bare `window.google`, so the fake has to arrive the same way.
// The cast is the only way to write a vendor global lib.dom does not describe as writable; the
// shape is exactly the slice `useReverseGeocode` reaches for.
class FakeGeocoder {
    async geocode(): Promise<{ results: Array<{ address_components: typeof mockGeocodeComponents }> }> {
        return { results: [{ address_components: mockGeocodeComponents }] };
    }
}

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
    // Nothing to prefill unless a case says otherwise, so the existing cases keep the behaviour
    // they were written against.
    mockGeocodeComponents = [];
    (globalThis as unknown as { google: unknown }).google = { maps: { Geocoder: FakeGeocoder } };
});

afterEach(() => {
    Object.defineProperty(global.navigator, "geolocation", {
        value: savedGeolocation,
        configurable: true,
    });
    delete (globalThis as unknown as { google?: unknown }).google;
});

/** One Google address component, in the shape `address_components` actually carries. */
function geocodePart(long_name: string, ...types: string[]): { long_name: string; types: string[] } {
    return { long_name, types };
}

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

    /**
     * A browser with no Geolocation API at all is a different sentence from a refused permission:
     * "allow location access and try again" is advice the customer cannot act on when there is
     * nothing to allow. The distinction exists in the copy, and this is the only thing that reads
     * that branch.
     */
    it("says so when the browser cannot share a location at all", async () => {
        Object.defineProperty(global.navigator, "geolocation", { value: undefined, configurable: true });
        renderDrawer();

        fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

        expect(await screen.findByText(/can't share your location/i)).toBeTruthy();
        expect(screen.queryByText(/allow location access/i)).toBeNull();
        expect(saveButton().disabled).toBe(true);
    });

    /**
     * The button's own label changes once a pin exists, because "use my current location" on a
     * form that already has one reads as a required step the customer has not done.
     */
    it("offers to update the pin, not to capture one, once a pin exists", async () => {
        mockGeolocation((ok) => ok({ coords: { latitude: 26.2285, longitude: 50.586 } }));
        renderDrawer();

        fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

        await waitFor(() => expect(saveButton().disabled).toBe(false));
        expect(screen.getByRole("button", { name: /update location/i })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /use my current location/i })).toBeNull();
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

    /**
     * Reverse-geocode prefill (DELIVERY_COVERAGE_MATRIX.md D9). "Use my location" with nothing
     * typed used to save a pin and no text at all, so the courier's card read "No address" — the
     * pin routes them to the street but they still have to find a door.
     *
     * The rule the whole feature turns on: **never overwrite text the customer typed.** A reverse
     * geocode is a good guess at a building; it is not the truth about which flat someone lives in.
     */
    describe("the reverse-geocode prefill", () => {
        function pinAt(latitude = 26.2285, longitude = 50.586): void {
            mockGeolocation((ok) => ok({ coords: { latitude, longitude } }));
        }

        it("fills the Bahrain fields the customer left empty", async () => {
            pinAt();
            mockGeocodeComponents = [
                geocodePart("Seef", "neighborhood"),
                geocodePart("Road 3801", "route"),
                geocodePart("12", "street_number"),
            ];
            renderDrawer();

            fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

            await waitFor(() => {
                expect((screen.getByLabelText(/block/i) as HTMLInputElement).value).toBe("Seef");
            });
            expect((screen.getByLabelText(/road/i) as HTMLInputElement).value).toBe("Road 3801");
            expect((screen.getByLabelText(/building/i) as HTMLInputElement).value).toBe("12");
        });

        it("never overwrites text the customer typed", async () => {
            pinAt();
            mockGeocodeComponents = [
                geocodePart("Seef", "neighborhood"),
                geocodePart("Road 3801", "route"),
                geocodePart("12", "street_number"),
            ];
            const { onSave } = renderDrawer();

            fireEvent.change(screen.getByLabelText(/block/i), { target: { value: "338" } });
            fireEvent.change(screen.getByLabelText(/building/i), { target: { value: "villa 7" } });
            fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

            // The one field left blank is the one that moves — proof the prefill ran at all, so
            // the two that did not move cannot be explained by it having silently no-opped.
            await waitFor(() => {
                expect((screen.getByLabelText(/road/i) as HTMLInputElement).value).toBe("Road 3801");
            });
            expect((screen.getByLabelText(/block/i) as HTMLInputElement).value).toBe("338");
            expect((screen.getByLabelText(/building/i) as HTMLInputElement).value).toBe("villa 7");

            fireEvent.click(saveButton());
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({ block: "338", building: "villa 7", road: "Road 3801" })
            );
        });

        /** Whitespace is not an answer the customer gave, so it is still an empty field. */
        it("treats a field holding only spaces as empty", async () => {
            pinAt();
            mockGeocodeComponents = [geocodePart("Seef", "neighborhood")];
            renderDrawer();

            fireEvent.change(screen.getByLabelText(/block/i), { target: { value: "   " } });
            fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

            await waitFor(() => {
                expect((screen.getByLabelText(/block/i) as HTMLInputElement).value).toBe("Seef");
            });
        });

        /**
         * Google often knows the neighbourhood and nothing else. A partial answer fills only the
         * part it carries and still leaves typed text alone.
         *
         * The "Google returned nothing at all" case is deliberately NOT a test: its entire
         * observable consequence is that nothing changes, and the prefill is async, so any such
         * assertion reads the form before the guess lands and passes however the prefill behaves.
         * It is covered where it IS observable — `useReverseGeocode.test.ts` "answers null when
         * Google knows nothing about the point".
         */
        it("fills only the part the answer actually carries", async () => {
            pinAt();
            mockGeocodeComponents = [geocodePart("Seef", "neighborhood")];
            renderDrawer();

            fireEvent.change(screen.getByLabelText(/road/i), { target: { value: "3801" } });
            fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));

            // Waiting on the block is what proves the guess has landed — the two assertions
            // below would otherwise run before the prefill and pass on their own.
            await waitFor(() => {
                expect((screen.getByLabelText(/block/i) as HTMLInputElement).value).toBe("Seef");
            });
            expect((screen.getByLabelText(/road/i) as HTMLInputElement).value).toBe("3801");
            expect((screen.getByLabelText(/building/i) as HTMLInputElement).value).toBe("");
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

describe("AddressPickerDrawer on PC", () => {
    afterEach(() => {
        clearMatchMedia();
    });

    it("is a centred 520px dialog with no handle whose save still sends the pin", async () => {
        stubMatchMedia(true);
        mockGeolocation((ok) => ok({ coords: { latitude: 26.2285, longitude: 50.586 } }));
        const { onSave } = renderDrawer();

        const paper = document.querySelector(".MuiDialog-paper");
        expect(paper).toBeTruthy();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        expect(emotionRulesFor(paper as Element)).toContain("width:min(520px, 92vw)");
        expect(sheetHandleCount(paper as Element)).toBe(0);

        fireEvent.click(screen.getByRole("button", { name: /use my current location/i }));
        await waitFor(() => expect(saveButton().disabled).toBe(false));
        fireEvent.click(saveButton());

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ latitude: 26.2285, longitude: 50.586 }));
    });
});
