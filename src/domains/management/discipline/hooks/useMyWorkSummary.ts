import { fetchMyWorkSummary } from "../../../../shared/api/management";
import type { MyWorkSummaryTO } from "../types";
import { useAsyncResource } from "./useAsyncResource";

export type UseMyWorkSummaryResult = {
    summary: MyWorkSummaryTO | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

const MY_WORK_SUMMARY_KEY = "me-work-summary";

export function useMyWorkSummary(enabled: boolean): UseMyWorkSummaryResult {
    const { data, loading, error, refresh } = useAsyncResource(
        enabled ? MY_WORK_SUMMARY_KEY : null,
        fetchMyWorkSummary,
    );
    return { summary: data, loading, error, refresh };
}
