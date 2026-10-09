import { fetchMyDiscipline } from "../../../../shared/api/management";
import type { UseStaffDisciplineResult } from "./useStaffDiscipline";
import { useAsyncResource } from "./useAsyncResource";

const MY_DISCIPLINE_KEY = "me";

export function useMyDiscipline(enabled: boolean): UseStaffDisciplineResult {
    const { data, loading, error, refresh } = useAsyncResource(
        enabled ? MY_DISCIPLINE_KEY : null,
        fetchMyDiscipline,
    );
    return { record: data, loading, error, refresh };
}
