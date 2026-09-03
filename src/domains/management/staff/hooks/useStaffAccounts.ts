import { useCallback, useEffect, useState } from "react";
import { logger } from "../../../../shared/utils/logger";
import { getStaffAdminList, hireStaff, resetStaffPassword, setStaffBranch, setStaffEnabled, updateStaffDetails, updateStaffPayroll } from "../../../../shared/api/management";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO, UpdateStaffDetailsRequest, UpdateStaffPayrollRequest } from "../types";

export interface UseStaffAccountsResult {
    staff: StaffAdminTO[];
    loading: boolean;
    error: string | null;
    create: (request: HireStaffRequest) => Promise<HiredStaffTO>;
    resetPassword: (id: number, password: string) => Promise<void>;
    setEnabled: (id: number, enabled: boolean) => Promise<StaffAdminTO>;
    changeBranch: (id: number, branchId: string) => Promise<StaffAdminTO>;
    updatePayroll: (id: number, payload: UpdateStaffPayrollRequest) => Promise<StaffAdminTO>;
    updateDetails: (id: number, payload: UpdateStaffDetailsRequest) => Promise<StaffAdminTO>;
    refresh: () => void;
}

// Fetch-on-mount + refetch-on-demand, matching the useBoardOwners.ts/useDough.ts idiom already
// in this codebase.
export function useStaffAccounts(branchId?: string): UseStaffAccountsResult {
    const [staff, setStaff] = useState<StaffAdminTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        void (async (): Promise<void> => {
            try {
                const response = await getStaffAdminList(branchId);
                if (!cancelled) setStaff(response);
            } catch (err) {
                if (!cancelled) {
                    logger.error("Failed to load staff list:", err);
                    setError(err instanceof Error ? err.message : "Failed to load staff list");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [branchId, refreshToken]);

    // The create call itself is not swallowed here -- callers (HireStaffDrawer) need the
    // rejection to surface a form-level error without clearing entered fields.
    const create = useCallback(async (request: HireStaffRequest): Promise<HiredStaffTO> => {
        const hired = await hireStaff(request);
        setStaff(prev => [...prev, {
            id: hired.id,
            username: hired.username,
            fullName: hired.fullName,
            role: hired.role,
            branchId: hired.branchId,
            pricePerHour: hired.pricePerHour,
            // A hire is always active; the endpoint has no way to create a disabled account.
            enabled: true,
            // CPR can be captured at hire time, so it comes back on the response. The salary
            // figures cannot -- those are OWNER-only and this form is also used by a MANAGER --
            // so they stay null until the payroll PATCH sets them.
            cprNumber: hired.cprNumber,
            basicSalary: null,
            housingAllowance: null,
            transportAllowance: null,
        }]);
        return hired;
    }, []);

    // Touches no state: a reset changes nothing the roster displays. Like create, it lets the
    // rejection through -- the drawer needs it to show a form-level error.
    const resetPassword = useCallback(async (id: number, password: string): Promise<void> => {
        await resetStaffPassword(id, password);
    }, []);

    // Writes back the row the server returned rather than flipping the flag locally, so a
    // rejected request leaves the roster untouched instead of showing a state that never landed.
    const setEnabled = useCallback(async (id: number, enabled: boolean): Promise<StaffAdminTO> => {
        const updated = await setStaffEnabled(id, enabled);
        setStaff(prev => prev.map(s => (s.id === updated.id ? updated : s)));
        return updated;
    }, []);

    // Moving someone OUT of the branch in scope removes them from this roster rather than
    // updating the row: the list is one branch's staff, and a row for somebody who is no longer
    // there would be a lie the caller could still click actions on.
    const changeBranch = useCallback(async (id: number, targetBranchId: string): Promise<StaffAdminTO> => {
        const updated = await setStaffBranch(id, targetBranchId);
        setStaff(prev => (
            branchId !== undefined && updated.branchId !== branchId
                ? prev.filter(s => s.id !== updated.id)
                : prev.map(s => (s.id === updated.id ? updated : s))
        ));
        return updated;
    }, [branchId]);

    // Same reconcile-from-the-server-response idiom as setEnabled/changeBranch: the payroll
    // block is redacted for non-OWNER callers, so writing back the response (rather than the
    // submitted payload) is also what keeps a non-OWNER caller from ever holding un-redacted data.
    const updatePayroll = useCallback(async (id: number, payload: UpdateStaffPayrollRequest): Promise<StaffAdminTO> => {
        const updated = await updateStaffPayroll(id, payload);
        setStaff(prev => prev.map(s => (s.id === updated.id ? updated : s)));
        return updated;
    }, []);

    // Same reconcile-from-the-server-response idiom as updatePayroll: fullName/role are visible to
    // any administering caller, but pricePerHour is OWNER-gated server-side, so writing back the
    // response (rather than the submitted payload) is what keeps a non-OWNER caller from ever
    // holding a value the backend would have redacted.
    const updateDetails = useCallback(async (id: number, payload: UpdateStaffDetailsRequest): Promise<StaffAdminTO> => {
        const updated = await updateStaffDetails(id, payload);
        setStaff(prev => prev.map(s => (s.id === updated.id ? updated : s)));
        return updated;
    }, []);

    const refresh = useCallback((): void => setRefreshToken(prev => prev + 1), []);

    return { staff, loading, error, create, resetPassword, setEnabled, changeBranch, updatePayroll, updateDetails, refresh };
}
