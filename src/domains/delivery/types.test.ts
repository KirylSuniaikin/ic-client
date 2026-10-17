import { describe, it, expect } from "@jest/globals";
import { DeliveryApiError, formatAddressLine } from "./types";
import type { CustomerAddress } from "./types";

/**
 * `formatAddressLine` is the courier-facing address line. Bahrain addressing is
 * Block / Road / Building / Flat rather than a street line (§1.4), and Google's reverse-geocode is
 * unreliable at building level here — which is why the parts are composed by hand.
 *
 * It had no test of its own: it was exercised only through `AddressCard` and `OneLastCheckDrawer`,
 * both of which pass a fully-populated address, so neither the ordering nor the empty-string
 * result was observed anywhere. The empty string is load-bearing — it is what both of those
 * components fall back to `pinOnlyAddress` on.
 */
function address(parts: Partial<CustomerAddress>): CustomerAddress {
    return {
        id: "a1", label: null, block: null, road: null, building: null, flat: null, note: null,
        latitude: 26.2285, longitude: 50.586,
        ...parts,
    };
}

describe("formatAddressLine", () => {
    it("composes the Bahrain parts in the order a courier reads them", () => {
        expect(formatAddressLine(address({ block: "338", road: "3801", building: "12", flat: "4" })))
            .toBe("Block 338, Road 3801, Building 12, Flat 4");
    });

    it("omits the parts the customer did not give rather than printing empty labels", () => {
        expect(formatAddressLine(address({ block: "338", building: "12" })))
            .toBe("Block 338, Building 12");
    });

    /**
     * The pin-only case. A customer who used "use my current location" and typed nothing has an
     * address with a real pin and no text at all — the courier gets a map point, and the UI must
     * say so rather than render a blank line. Both address surfaces branch on exactly this "".
     */
    it("returns an empty string when there is nothing but a pin", () => {
        expect(formatAddressLine(address({}))).toBe("");
    });

    /** An empty string is a missing part, not a part called "". */
    it("treats a blank field as absent rather than printing a bare label", () => {
        expect(formatAddressLine(address({ block: "", road: "3801" }))).toBe("Road 3801");
    });

    it("keeps a flat-only address readable", () => {
        expect(formatAddressLine(address({ flat: "12A" }))).toBe("Flat 12A");
    });
});

describe("DeliveryApiError", () => {
    /**
     * `useSavedAddresses` branches on `err instanceof DeliveryApiError && err.status === 401` to
     * treat a lapsed session as an empty address book. Both halves of that check have to hold for
     * a real Error subclass, which is not free across the transpilation targets this repo builds.
     */
    it("is a real Error carrying the status callers branch on", () => {
        const err = new DeliveryApiError("Unauthorized", 401);

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(DeliveryApiError);
        expect(err.status).toBe(401);
        expect(err.message).toBe("Unauthorized");
    });
});
