import { describe, it, expect } from "@jest/globals";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { useBranchScope, useMultiBranchScope } from "./useBranchScope";
import { ManagementBranchScopeProvider } from "../context/ManagementBranchScope";
import type { IBranch } from "../../inventory/types";

const branchA: IBranch = { id: "a", externalId: "ext-a", branchNo: 1, branchName: "Branch A", locale: "en" };
const branchB: IBranch = { id: "b", externalId: "ext-b", branchNo: 2, branchName: "Branch B", locale: "en" };
const fallbackBranch: IBranch = { id: "fallback", externalId: "ext-fallback", branchNo: 3, branchName: "Fallback Branch", locale: "en" };

function withProvider(branches: IBranch[], homeBranch: IBranch | null) {
    return ({ children }: { children: React.ReactNode }): React.JSX.Element => (
        <ManagementBranchScopeProvider branches={branches} homeBranch={homeBranch}>
            {children}
        </ManagementBranchScopeProvider>
    );
}

describe("useBranchScope", () => {
    it("falls back to the fallback prop with no provider mounted", () => {
        const { result } = renderHook(() => useBranchScope(fallbackBranch));

        expect(result.current.branch).toEqual(fallbackBranch);
        expect(result.current.branches).toEqual([]);
        expect(result.current.canSwitch).toBe(false);
    });

    it("seeds branch from homeBranch when a provider is mounted", () => {
        const { result } = renderHook(() => useBranchScope(fallbackBranch), {
            wrapper: withProvider([branchA, branchB], branchA),
        });

        expect(result.current.branch).toEqual(branchA);
    });

    it("falls back to the fallback prop when the provider has no homeBranch yet", () => {
        const { result } = renderHook(() => useBranchScope(fallbackBranch), {
            wrapper: withProvider([], null),
        });

        expect(result.current.branch).toEqual(fallbackBranch);
    });

    it("canSwitch is false when there is only one branch", () => {
        const { result } = renderHook(() => useBranchScope(fallbackBranch), {
            wrapper: withProvider([branchA], branchA),
        });

        expect(result.current.canSwitch).toBe(false);
    });

    it("canSwitch is true when there is more than one branch", () => {
        const { result } = renderHook(() => useBranchScope(fallbackBranch), {
            wrapper: withProvider([branchA, branchB], branchA),
        });

        expect(result.current.canSwitch).toBe(true);
    });

    it("setBranch updates the selected branch", () => {
        const { result } = renderHook(() => useBranchScope(fallbackBranch), {
            wrapper: withProvider([branchA, branchB], branchA),
        });

        act(() => {
            result.current.setBranch(branchB);
        });

        expect(result.current.branch).toEqual(branchB);
    });

    it("setBranch updates only the calling instance's local selection, leaving the shared scope and sibling instances untouched", () => {
        const wrapper = withProvider([branchA, branchB], branchA);
        const first = renderHook(() => useBranchScope(fallbackBranch), { wrapper });
        const second = renderHook(() => useBranchScope(fallbackBranch), { wrapper });

        act(() => {
            first.result.current.setBranch(branchB);
        });

        expect(first.result.current.branch).toEqual(branchB);
        expect(second.result.current.branch).toEqual(branchA);

        // A freshly mounted instance still seeds from the untouched shared homeBranch,
        // proving setBranch never wrote back into ManagementBranchScope itself.
        const third = renderHook(() => useBranchScope(fallbackBranch), { wrapper });
        expect(third.result.current.branch).toEqual(branchA);
    });
});

describe("useMultiBranchScope", () => {
    it("falls back to [fallback] with no provider mounted", () => {
        const { result } = renderHook(() => useMultiBranchScope(fallbackBranch));

        expect(result.current.selected).toEqual([fallbackBranch]);
        expect(result.current.branches).toEqual([]);
        expect(result.current.canSwitch).toBe(false);
    });

    it("seeds selected from homeBranch when a provider is mounted", () => {
        const { result } = renderHook(() => useMultiBranchScope(fallbackBranch), {
            wrapper: withProvider([branchA, branchB], branchA),
        });

        expect(result.current.selected).toEqual([branchA]);
    });

    it("setSelected updates the selected branches", () => {
        const { result } = renderHook(() => useMultiBranchScope(fallbackBranch), {
            wrapper: withProvider([branchA, branchB], branchA),
        });

        act(() => {
            result.current.setSelected([branchA, branchB]);
        });

        expect(result.current.selected).toEqual([branchA, branchB]);
    });

    it("canSwitch is true when there is more than one branch", () => {
        const { result } = renderHook(() => useMultiBranchScope(fallbackBranch), {
            wrapper: withProvider([branchA, branchB], branchA),
        });

        expect(result.current.canSwitch).toBe(true);
    });

    it("setSelected updates only the calling instance's local selection, leaving the shared scope and sibling instances untouched", () => {
        const wrapper = withProvider([branchA, branchB], branchA);
        const first = renderHook(() => useMultiBranchScope(fallbackBranch), { wrapper });
        const second = renderHook(() => useMultiBranchScope(fallbackBranch), { wrapper });

        act(() => {
            first.result.current.setSelected([branchA, branchB]);
        });

        expect(first.result.current.selected).toEqual([branchA, branchB]);
        expect(second.result.current.selected).toEqual([branchA]);

        // A freshly mounted instance still seeds from the untouched shared homeBranch,
        // proving setSelected never wrote back into ManagementBranchScope itself.
        const third = renderHook(() => useMultiBranchScope(fallbackBranch), { wrapper });
        expect(third.result.current.selected).toEqual([branchA]);
    });
});
