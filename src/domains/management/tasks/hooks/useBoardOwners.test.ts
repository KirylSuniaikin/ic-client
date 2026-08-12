import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react";
import { fetchBoardOwners } from "../../../../shared/api/management";
import type { BoardOwner } from "../types";
import { StaffRoles } from "../../../auth/types";
import { useBoardOwners } from "./useBoardOwners";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockFetchBoardOwners = jest.mocked(fetchBoardOwners);

function makeOwner(overrides: Partial<BoardOwner> = {}): BoardOwner {
    return {
        id: 12,
        username: "avery.super",
        role: StaffRoles.SUPER_MANAGER,
        ...overrides,
    };
}

describe("useBoardOwners", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("does not call fetchBoardOwners when enabled=false and returns the empty/idle shape", () => {
        const { result } = renderHook(() => useBoardOwners(false));

        expect(mockFetchBoardOwners).not.toHaveBeenCalled();
        expect(result.current).toEqual({ owners: [], loading: false, error: null });
    });

    it("calls fetchBoardOwners exactly once and returns its result in owners when enabled=true", async () => {
        const owners = [makeOwner({ id: 12 }), makeOwner({ id: 4, username: "casey.manager", role: StaffRoles.MANAGER })];
        mockFetchBoardOwners.mockResolvedValue(owners);

        const { result } = renderHook(() => useBoardOwners(true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetchBoardOwners).toHaveBeenCalledTimes(1);
        expect(result.current.owners).toEqual(owners);
        expect(result.current.error).toBeNull();
    });

    it("sets error and leaves owners as [] when fetchBoardOwners rejects", async () => {
        mockFetchBoardOwners.mockRejectedValue(new Error("HTTP 500"));

        const { result } = renderHook(() => useBoardOwners(true));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("HTTP 500");
        expect(result.current.owners).toEqual([]);
    });

    it("reflects loading=true while the fetch is in flight", () => {
        mockFetchBoardOwners.mockImplementation(() => new Promise(() => {}));

        const { result } = renderHook(() => useBoardOwners(true));

        expect(result.current.loading).toBe(true);
        expect(result.current.owners).toEqual([]);
    });
});
