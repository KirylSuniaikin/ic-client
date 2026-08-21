import { useState } from "react";
import type { IBranch } from "../../inventory/types";
import { useManagementBranchScope } from "../context/ManagementBranchScope";

export type BranchScopeResult = {
    branches: IBranch[];
    branch: IBranch;
    setBranch: (branch: IBranch) => void;
    canSwitch: boolean;
};

export type MultiBranchScopeResult = {
    branches: IBranch[];
    selected: IBranch[];
    setSelected: (branches: IBranch[]) => void;
    canSwitch: boolean;
};

// canSwitch is deliberately branches.length > 1, NOT a role check -- useAdminBranchInit
// already hands non-city roles a one-element availableBranches array, so this is the
// role gate for free (see MULTIBRANCH_SPEC.md Part 1, "why canSwitch instead of a role check").
export function useBranchScope(fallback: IBranch): BranchScopeResult {
    const { branches, homeBranch } = useManagementBranchScope();
    const [branch, setBranch] = useState<IBranch>(homeBranch ?? fallback);

    return { branches, branch, setBranch, canSwitch: branches.length > 1 };
}

export function useMultiBranchScope(fallback: IBranch): MultiBranchScopeResult {
    const { branches, homeBranch } = useManagementBranchScope();
    const [selected, setSelected] = useState<IBranch[]>([homeBranch ?? fallback]);

    return { branches, selected, setSelected, canSwitch: branches.length > 1 };
}
