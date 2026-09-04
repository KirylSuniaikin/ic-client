import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSavedAddresses } from "./useSavedAddresses";
import { createAddress, listAddresses, updateAddress } from "../../../shared/api/delivery";
import { DeliveryApiError } from "../types";
import type { CustomerAddress } from "../types";

jest.mock("../../../shared/api/delivery");

// Read at call time, not at factory time, so a test can log the customer in or out between
// renders. The `mock` prefix is what lets babel-jest hoist the factory over this declaration.
let mockToken: string | null = "tok-1";
jest.mock("../../customer-auth/context/CustomerAuthProvider", () => ({
    useCustomerAuth: () => ({ token: mockToken }),
}));

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const mockList = jest.mocked(listAddresses);
const mockCreate = jest.mocked(createAddress);
const mockUpdate = jest.mocked(updateAddress);

function address(id: string, block: string): CustomerAddress {
    return {
        id, label: "Home", block, road: "3801", building: "12", flat: null, note: null,
        latitude: 26.2285, longitude: 50.586,
    };
}

const HOME = address("a1", "338");

const NEW_BODY = {
    label: null, block: null, road: null, building: null, flat: null, note: null,
    latitude: 26.2285, longitude: 50.586,
};

const EDIT_BODY = {
    label: null, block: null, road: null, building: null, flat: null, note: null,
};

beforeEach(() => {
    mockToken = "tok-1";
    mockList.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockList.mockResolvedValue([HOME]);
});

describe("useSavedAddresses — loading the address book", () => {
    it("loads the customer's saved addresses once a token exists", async () => {
        const { result } = renderHook(() => useSavedAddresses());

        await waitFor(() => expect(result.current.addresses).toEqual([HOME]));
        expect(mockList).toHaveBeenCalledWith("tok-1");
        expect(result.current.error).toBeNull();
    });

    /**
     * The endpoint is account-scoped, so a guest has nothing to ask for. Asking anyway would spend
     * a round trip on a guaranteed 401 at the exact moment the customer is trying to check out.
     */
    it("asks for nothing at all while there is no token", async () => {
        mockToken = null;
        const { result } = renderHook(() => useSavedAddresses());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(mockList).not.toHaveBeenCalled();
        expect(result.current.addresses).toEqual([]);
    });

    /**
     * §12.7: a session lapsing mid-checkout must fall back to entering an address by hand, not
     * dead-end. So a 401 is "no saved addresses", NOT an error — an error message here would stop
     * the customer on the one screen they cannot get past any other way.
     */
    it("treats a lapsed session as an empty address book, not an error", async () => {
        mockList.mockRejectedValue(new DeliveryApiError("Unauthorized", 401));
        const { result } = renderHook(() => useSavedAddresses());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.addresses).toEqual([]);
        expect(result.current.error).toBeNull();
    });

    /** Any other failure IS an error — silently showing an empty list would invite a duplicate. */
    it("surfaces a real failure rather than pretending the customer has no addresses", async () => {
        mockList.mockRejectedValue(new DeliveryApiError("Service unavailable", 503));
        const { result } = renderHook(() => useSavedAddresses());

        await waitFor(() => expect(result.current.error).toBe("Service unavailable"));
        expect(result.current.addresses).toEqual([]);
    });

    /** A logout must not leave the previous customer's addresses on screen. */
    it("clears the list when the customer logs out", async () => {
        const { result, rerender } = renderHook(() => useSavedAddresses());
        await waitFor(() => expect(result.current.addresses).toEqual([HOME]));

        mockToken = null;
        rerender();

        await waitFor(() => expect(result.current.addresses).toEqual([]));
    });
});

describe("useSavedAddresses — saving", () => {
    /**
     * The server folds a re-save of the same doorstep onto the existing row and answers 200 with
     * it. Prepending unconditionally would put the duplicate on screen that the dedupe exists to
     * prevent.
     */
    it("replaces a re-saved address in place instead of adding a second row", async () => {
        const older = address("a0", "111");
        mockList.mockResolvedValue([HOME, older]);
        mockCreate.mockResolvedValue({ ...HOME, building: "14" });
        const { result } = renderHook(() => useSavedAddresses());
        await waitFor(() => expect(result.current.addresses).toHaveLength(2));

        await act(async () => { await result.current.save(NEW_BODY); });

        expect(result.current.addresses).toHaveLength(2);
        expect(result.current.addresses[0]).toMatchObject({ id: "a1", building: "14" });
        expect(result.current.addresses[1].id).toBe("a0");
    });

    /** A genuinely new address is the one the customer just typed — it belongs at the top. */
    it("puts a genuinely new address at the front of the list", async () => {
        mockCreate.mockResolvedValue(address("a2", "500"));
        const { result } = renderHook(() => useSavedAddresses());
        await waitFor(() => expect(result.current.addresses).toHaveLength(1));

        let saved: CustomerAddress | null = null;
        await act(async () => { saved = await result.current.save(NEW_BODY); });

        expect(result.current.addresses.map((a) => a.id)).toEqual(["a2", "a1"]);
        expect(saved).toMatchObject({ id: "a2" });
    });

    it("reports why a save failed instead of pretending it worked", async () => {
        mockCreate.mockRejectedValue(new DeliveryApiError("You already have this address saved", 409));
        const { result } = renderHook(() => useSavedAddresses());
        await waitFor(() => expect(result.current.addresses).toHaveLength(1));

        let saved: CustomerAddress | null = HOME;
        await act(async () => { saved = await result.current.save(NEW_BODY); });

        expect(saved).toBeNull();
        expect(result.current.error).toBe("You already have this address saved");
        expect(result.current.addresses).toEqual([HOME]);
    });

    it("will not save an address without a session", async () => {
        mockToken = null;
        const { result } = renderHook(() => useSavedAddresses());

        let saved: CustomerAddress | null = HOME;
        await act(async () => { saved = await result.current.save(NEW_BODY); });

        expect(saved).toBeNull();
        expect(mockCreate).not.toHaveBeenCalled();
    });
});

describe("useSavedAddresses — editing", () => {
    /**
     * An edit must keep its place. Moving a corrected address to the top would reshuffle the list
     * under the customer's finger on the screen where they are choosing one.
     */
    it("keeps an edited address where it was in the list", async () => {
        const older = address("a0", "111");
        mockList.mockResolvedValue([HOME, older]);
        mockUpdate.mockResolvedValue({ ...older, building: "99" });
        const { result } = renderHook(() => useSavedAddresses());
        await waitFor(() => expect(result.current.addresses).toHaveLength(2));

        await act(async () => { await result.current.update("a0", EDIT_BODY); });

        expect(result.current.addresses.map((a) => a.id)).toEqual(["a1", "a0"]);
        expect(result.current.addresses[1]).toMatchObject({ building: "99" });
    });

    it("will not edit an address without a session", async () => {
        mockToken = null;
        const { result } = renderHook(() => useSavedAddresses());

        let edited: CustomerAddress | null = HOME;
        await act(async () => { edited = await result.current.update("a1", EDIT_BODY); });

        expect(edited).toBeNull();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("reports a rejected edit and leaves the stored address alone", async () => {
        mockUpdate.mockRejectedValue(new DeliveryApiError("You already have this address saved", 409));
        const { result } = renderHook(() => useSavedAddresses());
        await waitFor(() => expect(result.current.addresses).toHaveLength(1));

        let edited: CustomerAddress | null = HOME;
        await act(async () => { edited = await result.current.update("a1", EDIT_BODY); });

        expect(edited).toBeNull();
        expect(result.current.error).toBe("You already have this address saved");
        expect(result.current.addresses).toEqual([HOME]);
    });
});
