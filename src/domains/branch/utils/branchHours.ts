import type { WorkingHoursSchedule } from "../../../shared/api/management";
import { getClosingTime } from "../../schedule/utils/getClosingTime";
import { getNextOpening, type NextOpening } from "../../schedule/utils/getNextOpening";

/** What the branch details say about a branch's hours. */
export type BranchHours =
    | { state: "loading" }
    | { state: "unknown" }                               // the fetch failed
    | { state: "open"; closesAt: string | null }         // closesAt null = no schedule
    | { state: "closed"; nextOpening: NextOpening | null };

/** What the sheet says about a fetched schedule. Never "loading" or "unknown": those come from the fetch. */
export function describeBranchHours(
    schedule: WorkingHoursSchedule | null | undefined,
): Extract<BranchHours, { state: "open" } | { state: "closed" }> {
    // No schedule reads as open: the same answer isWithinWorkingHours(null) gives the header and
    // the order gate, so the sheet never calls a branch closed that the customer can order from.
    if (schedule == null) return { state: "open", closesAt: null };

    // Already display-formatted ("00:00" for an end-of-day close).
    const closesAt = getClosingTime(schedule);
    if (closesAt !== null) return { state: "open", closesAt };

    return { state: "closed", nextOpening: getNextOpening(schedule) };
}
