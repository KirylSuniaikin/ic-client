import { describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import type { IBranch } from "../../management/inventory/types";
import { writeChosenBranch } from "../utils/customerBranch";
import { useBranchResolution } from "./useBranchResolution";

const BRANCH: IBranch = {
    id: "branch-uuid-1",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Seef",
    locale: "en",
    latitude: 26.2285,
    longitude: 50.586,
};

// A branch with no coordinates must survive resolution unchanged — it is still a fully valid,
// selectable branch (task-spec.md §7 item 2), never dropped or coerced to 0,0.
const BRANCH_NO_COORDS: IBranch = {
    id: "branch-uuid-2",
    externalId: "ext-2",
    branchNo: 2,
    branchName: "Karlin",
    locale: "en",
    latitude: null,
    longitude: null,
};

describe("useBranchResolution", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("returns the stored branch and its id when one is chosen", () => {
        writeChosenBranch(BRANCH);

        const { result } = renderHook(() => useBranchResolution());

        expect(result.current.chosenBranch).toEqual(BRANCH);
        expect(result.current.chosenBranchId).toBe(BRANCH.id);
    });

    it("falls back to DEFAULT_BRANCH_ID when no branch is stored", () => {
        const { result } = renderHook(() => useBranchResolution());

        expect(result.current.chosenBranch).toBeNull();
        expect(result.current.chosenBranchId).toBe(DEFAULT_BRANCH_ID);
    });

    it("returns a stored branch with null latitude/longitude unchanged (never dropped, never 0,0)", () => {
        writeChosenBranch(BRANCH_NO_COORDS);

        const { result } = renderHook(() => useBranchResolution());

        expect(result.current.chosenBranch).toEqual(BRANCH_NO_COORDS);
        expect(result.current.chosenBranch?.latitude).toBeNull();
        expect(result.current.chosenBranch?.longitude).toBeNull();
        expect(result.current.chosenBranchId).toBe(BRANCH_NO_COORDS.id);
    });

    it("re-reads localStorage on every render (no cached state)", () => {
        const { result, rerender } = renderHook(() => useBranchResolution());

        expect(result.current.chosenBranchId).toBe(DEFAULT_BRANCH_ID);

        writeChosenBranch(BRANCH);
        rerender();

        expect(result.current.chosenBranchId).toBe(BRANCH.id);
    });
});
