import { toEpochMsBahrain } from "../../../shared/utils/timeUtils";
import type { ViolationTO } from "./types";

// Pure mirrors of server rules; the server stays the authority.
export function partitionViolations(
    list: ReadonlyArray<ViolationTO>,
): { active: ViolationTO[]; pending: ViolationTO[] } {
    return {
        active: list.filter((v) => v.status === "ACTIVE" && !v.expired),
        pending: list.filter((v) => v.status === "PENDING_EXPLANATION"),
    };
}

export function isExplanationWindowOpen(v: ViolationTO, nowMs: number): boolean {
    return nowMs <= toEpochMsBahrain(v.explanationDueAt);
}

// The GM may confirm once the employee explained or once the 48h window has elapsed.
export function canConfirmNow(v: ViolationTO, nowMs: number): boolean {
    return v.explainedAt !== null || !isExplanationWindowOpen(v, nowMs);
}

export function canDispute(v: ViolationTO): boolean {
    return v.status === "ACTIVE" && !v.expired && v.violationClass !== "D" && v.dispute === null;
}

export function hasOpenDispute(v: ViolationTO): boolean {
    return v.dispute !== null && v.dispute.outcome === null;
}
