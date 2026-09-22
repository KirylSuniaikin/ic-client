import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import type { IBranch } from "../../management/inventory/types";
import { readChosenBranch } from "../utils/customerBranch";

export interface BranchResolution {
    chosenBranch: IBranch | null;
    /** chosenBranch.id if one is stored, else DEFAULT_BRANCH_ID (last-resort fallback, req. 13). */
    chosenBranchId: string;
}

/** Reads localStorage fresh on every call — no cached state, no subscription. Named with the
 * `use` prefix for call-site consistency with other domain hooks, but holds no React state, so
 * it re-reads correctly on every render without needing a storage-event listener. */
export function useBranchResolution(): BranchResolution {
    const chosenBranch = readChosenBranch();

    return {
        chosenBranch,
        chosenBranchId: chosenBranch?.id ?? DEFAULT_BRANCH_ID,
    };
}
