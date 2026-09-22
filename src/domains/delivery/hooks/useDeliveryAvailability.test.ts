import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDeliveryAvailability } from "./useDeliveryAvailability";
import { getDeliveryAvailability } from "../../../shared/api/delivery";

jest.mock("../../../shared/api/delivery");

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const mockGet = jest.mocked(getDeliveryAvailability);

beforeEach(() => {
    mockGet.mockReset();
});

const AVAILABLE = { available: true, reason: null, branchId: "b1", etaMinutesMin: 20, etaMinutesMax: 30 };

describe("useDeliveryAvailability", () => {
    it("calls the gate without a pin for the early cart pass", async () => {
        mockGet.mockResolvedValueOnce(AVAILABLE);
        const { result } = renderHook(() => useDeliveryAvailability());

        await act(async () => { await result.current.check(); });

        expect(mockGet).toHaveBeenCalledWith(undefined);
        await waitFor(() => expect(result.current.availability?.available).toBe(true));
    });

    it("passes the pin on the Place-order pass", async () => {
        mockGet.mockResolvedValueOnce(AVAILABLE);
        const { result } = renderHook(() => useDeliveryAvailability());

        await act(async () => { await result.current.check({ latitude: 26.2, longitude: 50.5 }); });

        expect(mockGet).toHaveBeenCalledWith({ latitude: 26.2, longitude: 50.5 });
    });

    it("surfaces a refusal with its reason", async () => {
        mockGet.mockResolvedValueOnce({ available: false, reason: "NO_COURIER", branchId: "b1",
            etaMinutesMin: null, etaMinutesMax: null });
        const { result } = renderHook(() => useDeliveryAvailability());

        let outcome;
        await act(async () => { outcome = await result.current.check(); });

        expect(outcome).toMatchObject({ available: false, reason: "NO_COURIER" });
    });

    /**
     * Failing open is deliberate. The gate is a courtesy check, not the authorisation — the
     * server re-checks radius and couriers at order creation. Failing closed on a network blip
     * would push every customer to a competitor's app.
     */
    it("fails open when the gate itself errors", async () => {
        mockGet.mockRejectedValueOnce(new Error("network down"));
        const { result } = renderHook(() => useDeliveryAvailability());

        let outcome;
        await act(async () => { outcome = await result.current.check(); });

        expect(outcome).toMatchObject({ available: true, reason: null });
    });

    it("clears the last result on reset", async () => {
        mockGet.mockResolvedValueOnce(AVAILABLE);
        const { result } = renderHook(() => useDeliveryAvailability());
        await act(async () => { await result.current.check(); });

        act(() => { result.current.reset(); });

        expect(result.current.availability).toBeNull();
    });
});
