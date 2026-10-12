import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react";
import { fetchCustomerMe } from "../../../shared/api/customerAuth";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { useCheckoutPrefetch } from "./useCheckoutPrefetch";
import type { CustomerMeResponse } from "../../customer-auth/types";

jest.mock("../../../shared/api/customerAuth");
jest.mock("../../../shared/api/management");

const mockMe = jest.mocked(fetchCustomerMe);
const mockBanned = jest.mocked(getAllBannedCstmrs);

const PROFILE: CustomerMeResponse = {
    id: "c1", phone: "97333111222", preferredBranchId: null, name: "Sara",
    address: null, amountOfOrders: 3, lastOrderDate: null,
};

const FAILURE_LABEL = "Test prefetch failed:";
const fetchEligibility = jest.fn<Promise<{ enabled: boolean }>, [string]>();
let warnSpy: ReturnType<typeof jest.spyOn>;

function usePrefetch(active: boolean, token: string | null): ReturnType<typeof useCheckoutPrefetch> {
    return useCheckoutPrefetch({ active, token, fetchEligibility, failureLabel: FAILURE_LABEL });
}

beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchEligibility.mockReset();
    fetchEligibility.mockResolvedValue({ enabled: true });
    mockMe.mockReset();
    mockMe.mockResolvedValue(PROFILE);
    mockBanned.mockReset();
    mockBanned.mockResolvedValue([]);
});

describe("useCheckoutPrefetch", () => {
    it("returns eligible data once everything resolves", async () => {
        const { result } = renderHook(() => usePrefetch(true, "t1"));

        await waitFor(() => expect(result.current).not.toBeNull());
        expect(result.current).toEqual({ eligible: true, profile: PROFILE, banned: false, forToken: "t1" });
    });

    it("reports ineligible", async () => {
        fetchEligibility.mockResolvedValue({ enabled: false });
        const { result } = renderHook(() => usePrefetch(true, "t1"));

        await waitFor(() => expect(result.current?.eligible).toBe(false));
    });

    it("flags a banned customer", async () => {
        mockBanned.mockResolvedValue([{ id: 1, telephoneNo: PROFILE.phone }]);
        const { result } = renderHook(() => usePrefetch(true, "t1"));

        await waitFor(() => expect(result.current?.banned).toBe(true));
    });

    it("fails closed (null) and logs with the caller's label when any fetch fails", async () => {
        mockMe.mockRejectedValue(new Error("boom"));
        const { result } = renderHook(() => usePrefetch(true, "t1"));

        await waitFor(() => expect(mockMe).toHaveBeenCalled());
        await waitFor(() => expect(warnSpy).toHaveBeenCalledWith(FAILURE_LABEL, "Error"));
        expect(result.current).toBeNull();
    });

    it("does not fetch while inactive or without a token", () => {
        renderHook(() => usePrefetch(false, "t1"));
        renderHook(() => usePrefetch(true, null));

        expect(fetchEligibility).not.toHaveBeenCalled();
    });

    it("discards stale data when the token changes", async () => {
        const { result, rerender } = renderHook(
            ({ token }: { token: string }) => usePrefetch(true, token),
            { initialProps: { token: "t1" } },
        );
        await waitFor(() => expect(result.current).not.toBeNull());
        fetchEligibility.mockReturnValue(new Promise(() => undefined));

        rerender({ token: "t2" });

        expect(result.current).toBeNull();
    });
});
