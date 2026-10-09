import { useMemo } from "react";
import { fetchRosterScores } from "../../../../shared/api/management";
import type { RosterScoreTO } from "../types";
import { useAsyncResource } from "./useAsyncResource";

export type UseRosterScoresResult = {
    scores: ReadonlyMap<number, RosterScoreTO>;
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

export function useRosterScores(branchId: string): UseRosterScoresResult {
    const { data, loading, error, refresh } = useAsyncResource(branchId, () => fetchRosterScores(branchId));
    const scores = useMemo(
        (): ReadonlyMap<number, RosterScoreTO> => new Map((data ?? []).map((s) => [s.staffId, s])),
        [data],
    );
    return { scores, loading, error, refresh };
}
