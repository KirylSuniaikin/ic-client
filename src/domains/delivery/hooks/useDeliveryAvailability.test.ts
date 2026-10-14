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

    it("forwards the pin and the basket when both are given", async () => {
        mockGet.mockResolvedValueOnce(AVAILABLE);
        const { result } = renderHook(() => useDeliveryAvailability());
        const basket = [{ id: 7, quantity: 9, isThinDough: false }];

        await act(async () => { await result.current.check({ latitude: 26.2, longitude: 50.5 }, basket); });

        expect(mockGet).toHaveBeenCalledWith({ latitude: 26.2, longitude: 50.5 }, basket);
    });

    it("stays fail-open when a basket check errors", async () => {
        mockGet.mockRejectedValueOnce(new Error("network down"));
        const { result } = renderHook(() => useDeliveryAvailability());

        let outcome;
        await act(async () => { outcome = await result.current.check(undefined, [{ id: 7, quantity: 9, isThinDough: false }]); });

        expect(outcome).toMatchObject({ available: true, reason: null });
    });

    it("does not let a slow earlier answer overwrite a later one in the shared state", async () => {
        let resolveSlow: (v: typeof AVAILABLE) => void = () => undefined;
        mockGet.mockReturnValueOnce(new Promise<typeof AVAILABLE>((resolve) => { resolveSlow = resolve; }));
        mockGet.mockResolvedValueOnce({ ...AVAILABLE, available: false, reason: "INSUFFICIENT_COURIERS" });
        const { result } = renderHook(() => useDeliveryAvailability());

        let slow: Promise<unknown> = Promise.resolve();
        await act(async () => { slow = result.current.check(); });
        await act(async () => { await result.current.check(); });
        await act(async () => { resolveSlow(AVAILABLE); await slow; });

        expect(result.current.availability).toMatchObject({ reason: "INSUFFICIENT_COURIERS" });
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
