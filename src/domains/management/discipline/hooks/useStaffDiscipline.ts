import { fetchStaffDiscipline } from "../../../../shared/api/management";
import type { StaffDisciplineTO } from "../types";
import { useAsyncResource } from "./useAsyncResource";

export type UseStaffDisciplineResult = {
    record: StaffDisciplineTO | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

export function useStaffDiscipline(staffId: number | null): UseStaffDisciplineResult {
    const { data, loading, error, refresh } = useAsyncResource(staffId, () => {
        // Unreachable while staffId is null (idle): useAsyncResource never calls the loader then.
        if (staffId === null) return Promise.reject(new Error("No staff selected"));
        return fetchStaffDiscipline(staffId);
    });
    return { record: data, loading, error, refresh };
}
