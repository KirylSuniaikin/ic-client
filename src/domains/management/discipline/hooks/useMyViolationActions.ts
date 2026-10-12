import { useCallback, useState } from "react";
import { disputeViolation, submitExplanation } from "../../../../shared/api/management";

export type UseMyViolationActionsResult = {
    explain: (id: number, text: string) => Promise<boolean>;
    dispute: (id: number, reason: string) => Promise<boolean>;
    busyIds: ReadonlySet<number>;
    error: string | null;
};

// Resolves true on success and false on failure, so a form can stay open on a rejection without
// the error ever being thrown into render.
export function useMyViolationActions(onDone: () => void): UseMyViolationActionsResult {
    const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(
        async (id: number, call: () => Promise<unknown>): Promise<boolean> => {
            setError(null);
            setBusyIds((prev) => new Set(prev).add(id));
            try {
                await call();
                onDone();
                return true;
            } catch (err) {
                setError(err instanceof Error ? err.message : "Request failed");
                // The record may have moved on (e.g. the explanation window closed).
                onDone();
                return false;
            } finally {
                setBusyIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        },
        [onDone],
    );

    const explain = useCallback(
        (id: number, text: string): Promise<boolean> => run(id, () => submitExplanation(id, { text })),
        [run],
    );
    const dispute = useCallback(
        (id: number, reason: string): Promise<boolean> => run(id, () => disputeViolation(id, { reason })),
        [run],
    );

    return { explain, dispute, busyIds, error };
}
