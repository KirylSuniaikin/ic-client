import * as React from "react";
import { createContext, useContext } from "react";
import type { IBranch } from "../../inventory/types";

export type ManagementBranchScopeValue = {
    branches: IBranch[];
    homeBranch: IBranch | null;
};

// Deliberate non-throwing default: this IS the graceful-fallback value consumers get
// when no ManagementBranchScopeProvider is mounted (every existing screen test renders
// bare with no provider — see MULTIBRANCH_SPEC.md Part 1).
const DEFAULT_SCOPE: ManagementBranchScopeValue = { branches: [], homeBranch: null };

const ManagementBranchScopeContext = createContext<ManagementBranchScopeValue>(DEFAULT_SCOPE);

type ManagementBranchScopeProviderProps = {
    branches: IBranch[];
    homeBranch: IBranch | null;
    children: React.ReactNode;
};

// Mounted once in AdminHomePage, fed from the existing useAdminBranchInit result --
// no new fetch is introduced here.
export function ManagementBranchScopeProvider({ branches, homeBranch, children }: ManagementBranchScopeProviderProps): React.JSX.Element {
    const value: ManagementBranchScopeValue = { branches, homeBranch };
    return (
        <ManagementBranchScopeContext.Provider value={value}>
            {children}
        </ManagementBranchScopeContext.Provider>
    );
}

export function useManagementBranchScope(): ManagementBranchScopeValue {
    return useContext(ManagementBranchScopeContext);
}
