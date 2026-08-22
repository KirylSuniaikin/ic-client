import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getStaffAdminList, hireStaff } from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO } from "../types";
import { useStaffRegister } from "./useStaffRegister";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockGetStaffAdminList = jest.mocked(getStaffAdminList);
const mockHireStaff = jest.mocked(hireStaff);

function makeStaff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 1,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.COOK,
        branchId: "branch-1",
        pricePerHour: null,
        ...overrides,
    };
}

function hireRequest(overrides: Partial<HireStaffRequest> = {}): HireStaffRequest {
    return {
        username: "new.cook",
        password: "pw",
        fullName: "New Cook",
        role: StaffRoles.COOK,
        pricePerHour: 3,
        branchId: "branch-1",
        ...overrides,
    };
}

function hiredResponse(overrides: Partial<HiredStaffTO> = {}): HiredStaffTO {
    return {
        id: 2,
        username: "new.cook",
        fullName: "New Cook",
        role: StaffRoles.COOK,
        pricePerHour: 3,
        branchId: "branch-1",
        ...overrides,
    };
}

describe("useStaffRegister", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("fetches the staff list on mount without a branchId when none is passed", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);

        const { result } = renderHook(() => useStaffRegister());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockGetStaffAdminList).toHaveBeenCalledWith(undefined);
        expect(result.current.staff).toEqual([makeStaff()]);
        expect(result.current.error).toBeNull();
    });

    it("passes branchId through to getStaffAdminList when provided", async () => {
        mockGetStaffAdminList.mockResolvedValue([]);

        renderHook(() => useStaffRegister("branch-9"));

        await waitFor(() => expect(mockGetStaffAdminList).toHaveBeenCalledWith("branch-9"));
    });

    it("sets error and leaves staff as [] when getStaffAdminList rejects", async () => {
        mockGetStaffAdminList.mockRejectedValue(new Error("HTTP 500"));

        const { result } = renderHook(() => useStaffRegister());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe("HTTP 500");
        expect(result.current.staff).toEqual([]);
    });

    it("create() calls hireStaff and appends the hired staff member to the list", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockHireStaff.mockResolvedValue(hiredResponse());

        const { result } = renderHook(() => useStaffRegister());
        await waitFor(() => expect(result.current.loading).toBe(false));

        const request = hireRequest();
        await act(async () => {
            await result.current.create(request);
        });

        expect(mockHireStaff).toHaveBeenCalledWith(request);
        expect(result.current.staff).toEqual([
            makeStaff(),
            { id: 2, username: "new.cook", fullName: "New Cook", role: StaffRoles.COOK, branchId: "branch-1", pricePerHour: 3 },
        ]);
    });

    it("create() propagates the rejection when hireStaff fails, without mutating the list", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockHireStaff.mockRejectedValue(new Error("HTTP 409"));

        const { result } = renderHook(() => useStaffRegister());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await expect(act(async () => {
            await result.current.create(hireRequest());
        })).rejects.toThrow("HTTP 409");

        expect(result.current.staff).toEqual([makeStaff()]);
    });

    it("refresh() re-fetches the list", async () => {
        mockGetStaffAdminList.mockResolvedValue([]);

        const { result } = renderHook(() => useStaffRegister());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.refresh());

        await waitFor(() => expect(mockGetStaffAdminList).toHaveBeenCalledTimes(2));
    });
});
