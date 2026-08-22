import { useCallback, useEffect, useState } from "react";
import { logger } from "../../../../shared/utils/logger";
import { getStaffAdminList, hireStaff } from "../../../../shared/api/management";
import type { HireStaffRequest, HiredStaffTO, StaffAdminTO } from "../types";

export interface UseStaffRegisterResult {
    staff: StaffAdminTO[];
    loading: boolean;
    error: string | null;
    create: (request: HireStaffRequest) => Promise<HiredStaffTO>;
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
        }]);
        return hired;
    }, []);

    const refresh = useCallback((): void => setRefreshToken(prev => prev + 1), []);

    return { staff, loading, error, create, refresh };
}
