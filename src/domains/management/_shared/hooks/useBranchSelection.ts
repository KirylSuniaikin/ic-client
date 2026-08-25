import { logger } from "../../../../shared/utils/logger";
import { useState, useEffect } from "react";
import { fetchAllBranches, getBranchInfo } from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";
import { StaffRoles, hasCityAccess } from "../../../auth/types";

type BranchSelectionResult = {
    branches: IBranch[];
    selectedBranch: IBranch | undefined;
    onBranchChange: (branch: IBranch) => void;
};

export function useBranchSelection(): BranchSelectionResult {
    const [branches, setBranches] = useState<IBranch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<IBranch | undefined>(undefined);

    useEffect(() => {
        fetchAllBranches()
            .then(bs => {
                setBranches(bs);
                setSelectedBranch(bs[0]);
            })
            .catch(() => {});
    }, []);

    return { branches, selectedBranch, onBranchChange: setSelectedBranch };
}

export type AdminBranchInitResult = {
    availableBranches: IBranch[] | null;
    selectedBranch: IBranch | null;
    setSelectedBranch: React.Dispatch<React.SetStateAction<IBranch | null>>;
    branchError: string | null;
};

export function useAdminBranchInit(
    branchId: string | null,
    role: StaffRoles | null,
): AdminBranchInitResult {
    const [availableBranches, setAvailableBranches] = useState<IBranch[] | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<IBranch | null>(null);
    const [branchError, setBranchError] = useState<string | null>(null);

    useEffect(() => {
        async function initBranches(): Promise<void> {
            try {
                if (branchId !== 'NONE' && !hasCityAccess(role)) {
                    const info = await getBranchInfo(branchId ?? '');
                    setAvailableBranches([info]);
                    setSelectedBranch(info);
                } else {
                    const all = await fetchAllBranches();
                    setAvailableBranches(all);
                    if (all.length > 0) {
                        setSelectedBranch(all.find(b => b.branchNo === 1) ?? all[0]);
                    }
                }
            } catch (err) {
                logger.error('Failed to fetch branches:', err);
                setBranchError('Failed to fetch branches');
            }
        }
        initBranches();
        // `role` decides WHICH branch list is fetched -- one branch for a branch-level caller,
        // all of them for a city-level one. Leaving it out of the deps meant that whenever role
        // resolved after branchId, a SUPER_MANAGER or OWNER was left holding the single-branch
        // result forever: no switcher on any screen, and a one-entry list wherever branches are
        // offered. eslint's exhaustive-deps had been flagging exactly this.
    }, [branchId, role]);

    return { availableBranches, selectedBranch, setSelectedBranch, branchError };
}
