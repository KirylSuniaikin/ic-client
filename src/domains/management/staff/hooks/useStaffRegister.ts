import { useCallback, useEffect, useState } from "react";
import { logger } from "../../../../shared/utils/logger";
import { getStaffAdminList, hireStaff, resetStaffPassword, setStaffEnabled } from "../../../../shared/api/management";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO } from "../types";

export interface UseStaffRegisterResult {
    staff: StaffAdminTO[];
    loading: boolean;
    error: string | null;
    create: (request: HireStaffRequest) => Promise<HiredStaffTO>;
    resetPassword: (id: number, password: string) => Promise<void>;
    setEnabled: (id: number, enabled: boolean) => Promise<StaffAdminTO>;
    refresh: () => void;
}

// Fetch-on-mount + refetch-on-demand, matching the useBoardOwners.ts/useDough.ts idiom already
// in this codebase.
export function useStaffRegister(branchId?: string): UseStaffRegisterResult {
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

    const refresh = useCallback((): void => setRefreshToken(prev => prev + 1), []);

    return { staff, loading, error, create, resetPassword, setEnabled, refresh };
}
