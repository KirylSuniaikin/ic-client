import { toDisplayClosing } from "./getClosingTime";
import type { DayName } from "./getTimeUntilNextOpening";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

// Monday-first, matching how the hours were previously written out by hand.
const DISPLAY_ORDER: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type WeeklyHoursRow = {
    days: DayName[];
    // null when the branch is closed all day — the caller renders its own localized "Closed".
    shifts: string[] | null;
};

/**
 * Collapses a weekly schedule into display rows, grouping days that share identical hours
 * ("Mon, Tue, Wed, Sat — 14:00–00:00") the way the hand-written copy used to. Rows appear in
 * Monday-first order of each group's earliest day.
 *
 * Shift ends run through toDisplayClosing, so the stored end-of-day marker ("24:00"/"23:59")
 * shows as "00:00" here exactly as it does in the header.
 */
export function formatWeeklyHours(schedule: WorkingHoursSchedule | null | undefined): WeeklyHoursRow[] {
    if (schedule == null) return [];

    const rows: WeeklyHoursRow[] = [];
    // Keyed by the rendered hours (or "closed"), so days with identical hours share one row.
    const rowBySignature = new Map<string, WeeklyHoursRow>();

    for (const day of DISPLAY_ORDER) {
        const daySchedule = schedule[day];
        const isClosed = !daySchedule || !daySchedule.isOpen || daySchedule.shifts.length === 0;
        const shifts = isClosed
            ? null
            : daySchedule.shifts.map(([start, end]) => `${start}–${toDisplayClosing(end)}`);

        const signature = shifts === null ? "closed" : shifts.join(", ");
        const existing = rowBySignature.get(signature);
        if (existing) {
            existing.days.push(day);
            continue;
        }

        const row: WeeklyHoursRow = { days: [day], shifts };
        rowBySignature.set(signature, row);
        rows.push(row);
    }

    return rows;
}
