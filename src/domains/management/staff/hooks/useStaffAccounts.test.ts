import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getStaffAdminList, hireStaff, resetStaffPassword, setStaffBranch, setStaffEnabled, updateStaffDetails, updateStaffPayroll } from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO, UpdateStaffDetailsRequest, UpdateStaffPayrollRequest } from "../types";
import { useStaffAccounts } from "./useStaffAccounts";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockGetStaffAdminList = jest.mocked(getStaffAdminList);
const mockHireStaff = jest.mocked(hireStaff);
const mockResetStaffPassword = jest.mocked(resetStaffPassword);
const mockSetStaffEnabled = jest.mocked(setStaffEnabled);
const mockSetStaffBranch = jest.mocked(setStaffBranch);
const mockUpdateStaffPayroll = jest.mocked(updateStaffPayroll);
const mockUpdateStaffDetails = jest.mocked(updateStaffDetails);

function makeStaff(overrides: Partial<StaffAdminTO> = {}): StaffAdminTO {
    return {
        id: 1,
        username: "casey.cook",
        fullName: "Casey Cook",
        role: StaffRoles.COOK,
        branchId: "branch-1",
        pricePerHour: null,
        enabled: true,
        cprNumber: null,
        basicSalary: null,
        housingAllowance: null,
        transportAllowance: null,
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
        cprNumber: null,
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
        cprNumber: null,
        ...overrides,
    };
}

describe("useStaffAccounts", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("fetches the staff list on mount without a branchId when none is passed", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);

        const { result } = renderHook(() => useStaffAccounts());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockGetStaffAdminList).toHaveBeenCalledWith(undefined);
        expect(result.current.staff).toEqual([makeStaff()]);
        expect(result.current.error).toBeNull();
    });

    it("passes branchId through to getStaffAdminList when provided", async () => {
        mockGetStaffAdminList.mockResolvedValue([]);

        renderHook(() => useStaffAccounts("branch-9"));

        await waitFor(() => expect(mockGetStaffAdminList).toHaveBeenCalledWith("branch-9"));
    });

    it("sets error and leaves staff as [] when getStaffAdminList rejects", async () => {
        mockGetStaffAdminList.mockRejectedValue(new Error("HTTP 500"));

        const { result } = renderHook(() => useStaffAccounts());

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe("HTTP 500");
        expect(result.current.staff).toEqual([]);
    });

    it("create() calls hireStaff and appends the hired staff member to the list", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockHireStaff.mockResolvedValue(hiredResponse());

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        const request = hireRequest();
        await act(async () => {
            await result.current.create(request);
        });

        expect(mockHireStaff).toHaveBeenCalledWith(request);
        expect(result.current.staff).toEqual([
            makeStaff(),
            {
                id: 2, username: "new.cook", fullName: "New Cook", role: StaffRoles.COOK, branchId: "branch-1",
                pricePerHour: 3, enabled: true,
                cprNumber: null, basicSalary: null, housingAllowance: null, transportAllowance: null,
            },
        ]);
    });

    it("create() propagates the rejection when hireStaff fails, without mutating the list", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockHireStaff.mockRejectedValue(new Error("HTTP 409"));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await expect(act(async () => {
            await result.current.create(hireRequest());
        })).rejects.toThrow("HTTP 409");

        expect(result.current.staff).toEqual([makeStaff()]);
    });

    it("refresh() re-fetches the list", async () => {
        mockGetStaffAdminList.mockResolvedValue([]);

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.refresh());

        await waitFor(() => expect(mockGetStaffAdminList).toHaveBeenCalledTimes(2));
    });

    it("resetPassword() calls the endpoint and leaves the roster untouched", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockResetStaffPassword.mockResolvedValue(undefined);

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.resetPassword(1, "N3wPassw0rd");
        });

        expect(mockResetStaffPassword).toHaveBeenCalledWith(1, "N3wPassw0rd");
        expect(result.current.staff).toEqual([makeStaff()]);
    });

    it("resetPassword() propagates the rejection so the drawer can show it", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockResetStaffPassword.mockRejectedValue(new Error("Response: 403"));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await expect(act(async () => {
            await result.current.resetPassword(1, "N3wPassw0rd");
        })).rejects.toThrow("Response: 403");
    });

    it("setEnabled() replaces the row with the one the server returned", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff(), makeStaff({ id: 2, username: "sam" })]);
        mockSetStaffEnabled.mockResolvedValue(makeStaff({ enabled: false }));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.setEnabled(1, false);
        });

        expect(mockSetStaffEnabled).toHaveBeenCalledWith(1, false);
        expect(result.current.staff).toEqual([
            makeStaff({ enabled: false }),
            makeStaff({ id: 2, username: "sam" }),
        ]);
    });

    // A roster is one branch's staff, so somebody moved away must leave it -- a lingering row
    // would still offer actions the backend would then refuse.
    it("changeBranch() drops the row when the person leaves the branch in scope", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff({ id: 1 }), makeStaff({ id: 2, username: "sam" })]);
        mockSetStaffBranch.mockResolvedValue(makeStaff({ id: 1, branchId: "branch-9" }));

        const { result } = renderHook(() => useStaffAccounts("branch-1"));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.changeBranch(1, "branch-9");
        });

        expect(mockSetStaffBranch).toHaveBeenCalledWith(1, "branch-9");
        expect(result.current.staff).toEqual([makeStaff({ id: 2, username: "sam" })]);
    });

    it("changeBranch() keeps the row when the branch did not actually change", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff({ id: 1 })]);
        mockSetStaffBranch.mockResolvedValue(makeStaff({ id: 1, fullName: "Renamed" }));

        const { result } = renderHook(() => useStaffAccounts("branch-1"));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.changeBranch(1, "branch-1");
        });

        expect(result.current.staff).toEqual([makeStaff({ id: 1, fullName: "Renamed" })]);
    });

    it("changeBranch() propagates the rejection and leaves the roster untouched", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff({ id: 1 })]);
        mockSetStaffBranch.mockRejectedValue(new Error("Response: 403"));

        const { result } = renderHook(() => useStaffAccounts("branch-1"));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await expect(act(async () => {
            await result.current.changeBranch(1, "branch-9");
        })).rejects.toThrow("Response: 403");

        expect(result.current.staff).toEqual([makeStaff({ id: 1 })]);
    });

    it("setEnabled() leaves the row untouched when the request is rejected", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockSetStaffEnabled.mockRejectedValue(new Error("Response: 403"));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await expect(act(async () => {
            await result.current.setEnabled(1, false);
        })).rejects.toThrow("Response: 403");

        expect(result.current.staff).toEqual([makeStaff()]);
    });

    it("updatePayroll() replaces the row with the one the server returned", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff(), makeStaff({ id: 2, username: "sam" })]);
        mockUpdateStaffPayroll.mockResolvedValue(makeStaff({ cprNumber: "830101234", basicSalary: 240 }));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));
        const untouchedSibling = result.current.staff[1];

        const payload: UpdateStaffPayrollRequest = {
            cprNumber: "830101234",
            basicSalary: 240,
            housingAllowance: null,
            transportAllowance: null,
        };
        await act(async () => {
            await result.current.updatePayroll(1, payload);
        });

        expect(mockUpdateStaffPayroll).toHaveBeenCalledWith(1, payload);
        expect(result.current.staff).toEqual([
            makeStaff({ cprNumber: "830101234", basicSalary: 240 }),
            makeStaff({ id: 2, username: "sam" }),
        ]);
        // Identity-preserving patch: the sibling row that was not targeted keeps the exact same
        // object reference, which is what lets a memoized row skip re-rendering.
        const sibling = result.current.staff[1];
        expect(sibling).toBe(untouchedSibling);
    });

    it("updatePayroll() leaves the row untouched when the request is rejected", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockUpdateStaffPayroll.mockRejectedValue(new Error("Response: 403"));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        const beforeRow = result.current.staff[0];

        await expect(act(async () => {
            await result.current.updatePayroll(1, {
                cprNumber: null,
                basicSalary: null,
                housingAllowance: null,
                transportAllowance: null,
            });
        })).rejects.toThrow("Response: 403");

        expect(result.current.staff).toEqual([makeStaff()]);
        // A rejected write must never touch local state at all, not even by allocating a new
        // (equal-by-value) array or row.
        expect(result.current.staff[0]).toBe(beforeRow);
    });

    it("updateDetails() replaces the row with the one the server returned", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff(), makeStaff({ id: 2, username: "sam" })]);
        mockUpdateStaffDetails.mockResolvedValue(makeStaff({ fullName: "Casey Baker" }));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));
        const untouchedSibling = result.current.staff[1];

        const payload: UpdateStaffDetailsRequest = { fullName: "Casey Baker" };
        await act(async () => {
            await result.current.updateDetails(1, payload);
        });

        expect(mockUpdateStaffDetails).toHaveBeenCalledWith(1, payload);
        expect(result.current.staff).toEqual([
            makeStaff({ fullName: "Casey Baker" }),
            makeStaff({ id: 2, username: "sam" }),
        ]);
        // Identity-preserving patch, same as updatePayroll: an untouched sibling row keeps the
        // exact same object reference.
        expect(result.current.staff[1]).toBe(untouchedSibling);
    });

    it("updateDetails() leaves the row untouched when the request is rejected", async () => {
        mockGetStaffAdminList.mockResolvedValue([makeStaff()]);
        mockUpdateStaffDetails.mockRejectedValue(new Error("Response: 403"));

        const { result } = renderHook(() => useStaffAccounts());
        await waitFor(() => expect(result.current.loading).toBe(false));

        const beforeRow = result.current.staff[0];

        await expect(act(async () => {
            await result.current.updateDetails(1, { pricePerHour: 5 });
        })).rejects.toThrow("Response: 403");

        expect(result.current.staff).toEqual([makeStaff()]);
        expect(result.current.staff[0]).toBe(beforeRow);
    });
});
