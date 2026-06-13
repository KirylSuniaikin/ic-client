import { useState, useEffect } from "react";
import { fetchAllBranches, getBranchInfo } from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";

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
    role: string | null,
): AdminBranchInitResult {
    const [availableBranches, setAvailableBranches] = useState<IBranch[] | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<IBranch | null>(null);
    const [branchError, setBranchError] = useState<string | null>(null);

    useEffect(() => {
        async function initBranches(): Promise<void> {
            try {
                if (branchId !== 'NONE' && role !== 'SUPER_MANAGER') {
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
                console.error('Failed to fetch branches:', err);
                setBranchError('Failed to fetch branches');
            }
        }
        initBranches();
    }, [branchId]);

    return { availableBranches, selectedBranch, setSelectedBranch, branchError };
}
