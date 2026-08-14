import { useEffect, useState } from "react";
import { logger } from "../../../../shared/utils/logger";
import { fetchBoardOwners } from "../../../../shared/api/management";
import type { BoardOwner } from "../types";

export interface UseBoardOwnersResult {
    owners: BoardOwner[];
    loading: boolean;
    error: string | null;
}

// Fetch-on-mount, matching the useTaskBoard.ts pattern. `enabled=false` is a no-op --
// gate with a disabled seam rather than a conditional hook call (Rules of Hooks), same
// idiom as `useDough(isReviewer ? null : selectedBranchIdStr, ...)` in AdminHomePage.tsx.
export function useBoardOwners(enabled: boolean): UseBoardOwnersResult {
    const [owners, setOwners] = useState<BoardOwner[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!enabled) {
            setOwners([]);
            setLoading(false);
            setError(null);
            return () => {
                cancelled = true;
            };
        }

        setLoading(true);
        setError(null);

        void (async (): Promise<void> => {
            try {
                const response = await fetchBoardOwners();
                if (!cancelled) {
                    setOwners(response);
                }
            } catch (err) {
                if (!cancelled) {
                    logger.error("Failed to load board owners:", err);
                    setError(err instanceof Error ? err.message : "Failed to load board owners");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return { owners, loading, error };
}
