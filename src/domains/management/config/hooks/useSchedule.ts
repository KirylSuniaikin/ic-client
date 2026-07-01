import { useState, useEffect } from "react";
import {
    getWorkingHours,
    putWorkingHours,
} from "../../../../shared/api/management";
import type {
    WorkingHoursSchedule,
    WorkingHoursRequest,
} from "../../../../shared/api/management";

export type UseScheduleResult = {
    schedule: WorkingHoursSchedule | null;
    loading: boolean;
    error: string | null;
    localSchedule: WorkingHoursSchedule | null;
    setLocalSchedule: (s: WorkingHoursSchedule) => void;
    dirty: boolean;
    save: () => Promise<void>;
    reset: () => void;
};

// Sent when no schedule has been configured yet — all days default to closed.
const EMPTY_SCHEDULE: WorkingHoursSchedule = {
    Sunday: { isOpen: false, shifts: [] },
    Monday: { isOpen: false, shifts: [] },
    Tuesday: { isOpen: false, shifts: [] },
    Wednesday: { isOpen: false, shifts: [] },
    Thursday: { isOpen: false, shifts: [] },
    Friday: { isOpen: false, shifts: [] },
    Saturday: { isOpen: false, shifts: [] },
};

export function useSchedule(branchId: string): UseScheduleResult {
    // Initialize loading to true — first render always shows loading until the fetch resolves.
    const [schedule, setSchedule] = useState<WorkingHoursSchedule | null>(null);
    const [localSchedule, setLocalSchedule] = useState<WorkingHoursSchedule | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError(null);

        void (async (): Promise<void> => {
            try {
                const response = await getWorkingHours(branchId);
                if (!cancelled) {
                    const fetched = response ? response.schedule : null;
                    setSchedule(fetched);
                    setLocalSchedule(fetched);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load schedule");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [branchId]);

    // Reference equality — setLocalSchedule always replaces the object, so === suffices.
    const dirty = localSchedule !== schedule;

    const save = async (): Promise<void> => {
        // localSchedule can be null if no schedule was ever fetched; send an all-closed schedule.
        const payload: WorkingHoursRequest = {
            branchId,
            schedule: localSchedule ?? EMPTY_SCHEDULE,
        };
        setError(null);
        try {
            await putWorkingHours(payload);
            // On success, align server truth with the edit copy — dirty becomes false.
            setSchedule(localSchedule);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save schedule");
        }
    };

    const reset = (): void => {
        setLocalSchedule(schedule);
    };

    return {
        schedule,
        loading,
        error,
        localSchedule,
        setLocalSchedule,
        dirty,
        save,
        reset,
    };
}
