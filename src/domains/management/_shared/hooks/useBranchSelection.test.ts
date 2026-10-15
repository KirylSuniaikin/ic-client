import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react";
import { fetchAllBranches, getBranchInfo } from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";
import { StaffRoles } from "../../../auth/types";
import { useAdminBranchInit } from "./useBranchSelection";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockFetchAllBranches = jest.mocked(fetchAllBranches);
const mockGetBranchInfo = jest.mocked(getBranchInfo);

function makeBranch(overrides: Partial<IBranch> = {}): IBranch {
    return {
        id: "branch-1",
        externalId: "ext-1",
        branchNo: 1,
        branchName: "Adliya",
        locale: "adl",
        ...overrides,
    };
}

// useAdminBranchInit is the load-bearing fix from the OWNER rollout: the branch-scoping
// check used to compare a raw 'SUPER_MANAGER' string literal, which would have silently
// left a new role (like OWNER) branch-locked. These tests pin the behavior via
// hasCityAccess so a future reintroduction of that literal fails loudly here.
describe("useAdminBranchInit", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it.each([
        [StaffRoles.MANAGER],
        [StaffRoles.COOK],
    ])("locks %s to their own branch via getBranchInfo, not the city-wide branch list", async (role) => {
        const own = makeBranch({ id: "branch-9", branchNo: 9 });
        mockGetBranchInfo.mockResolvedValue(own);

        const { result } = renderHook(() => useAdminBranchInit("branch-9", role));

        await waitFor(() => {
            expect(result.current.selectedBranch).not.toBeNull();
        });

        expect(mockGetBranchInfo).toHaveBeenCalledWith("branch-9");
        expect(mockFetchAllBranches).not.toHaveBeenCalled();
        expect(result.current.availableBranches).toEqual([own]);
        expect(result.current.selectedBranch).toEqual(own);
        expect(result.current.branchError).toBeNull();
    });

    it.each([
        [StaffRoles.SUPER_MANAGER],
        [StaffRoles.OWNER],
    ])("does NOT branch-lock %s — fetches the full city-wide branch list instead", async (role) => {
        const all = [makeBranch({ id: "branch-1", branchNo: 1 }), makeBranch({ id: "branch-2", branchNo: 2 })];
        mockFetchAllBranches.mockResolvedValue(all);

        const { result } = renderHook(() => useAdminBranchInit("branch-1", role));

        await waitFor(() => {
            expect(result.current.selectedBranch).not.toBeNull();
        });

        expect(mockFetchAllBranches).toHaveBeenCalledTimes(1);
        expect(mockGetBranchInfo).not.toHaveBeenCalled();
        expect(result.current.availableBranches).toEqual(all);
        // branchNo === 1 is preferred as the default selection when present.
        expect(result.current.selectedBranch).toEqual(all[0]);
    });

    it("takes the city-wide path when branchId is 'NONE', even for a branch-locked role like MANAGER", async () => {
        const all = [makeBranch({ id: "branch-1", branchNo: 1 })];
        mockFetchAllBranches.mockResolvedValue(all);

        const { result } = renderHook(() => useAdminBranchInit("NONE", StaffRoles.MANAGER));

        await waitFor(() => {
            expect(result.current.selectedBranch).not.toBeNull();
        });

        expect(mockFetchAllBranches).toHaveBeenCalledTimes(1);
        expect(mockGetBranchInfo).not.toHaveBeenCalled();
        expect(result.current.availableBranches).toEqual(all);
    });

    it("falls back to the first branch when none has branchNo === 1", async () => {
        const all = [makeBranch({ id: "branch-5", branchNo: 5 }), makeBranch({ id: "branch-6", branchNo: 6 })];
        mockFetchAllBranches.mockResolvedValue(all);

        const { result } = renderHook(() => useAdminBranchInit("branch-5", StaffRoles.OWNER));

        await waitFor(() => {
            expect(result.current.selectedBranch).not.toBeNull();
        });

        expect(result.current.selectedBranch).toEqual(all[0]);
    });

    it("surfaces a branchError and leaves selectedBranch null when the request fails", async () => {
        mockGetBranchInfo.mockRejectedValue(new Error("network"));

        const { result } = renderHook(() => useAdminBranchInit("branch-1", StaffRoles.MANAGER));

        await waitFor(() => {
            expect(result.current.branchError).toBe("Failed to fetch branches");
        });

        expect(result.current.selectedBranch).toBeNull();
    });
});
