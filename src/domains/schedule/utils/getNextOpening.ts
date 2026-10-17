import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { WorkingHoursSchedule } from "../../../shared/api/management";
import type { DayName } from "./getTimeUntilNextOpening";

dayjs.extend(utc);
dayjs.extend(timezone);

export interface NextOpening {
    /** 0 = later today, 1 = tomorrow, up to 7 = the same weekday next week. */
    daysAhead: number;
    day: DayName;
    /** The shift's start exactly as stored, "HH:mm". */
    time: string;
}

const DAY_INDEX_TO_NAME: DayName[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * When a closed branch next opens, for the branch details sheet's "Closed · opens …" line.
 *
 * A sibling of getTimeUntilNextOpening rather than a new export of it: BranchScheduleHeader's
 * tests replace that whole module with a manual mock, under which a second export would be
 * undefined. It uses the same `dayjs().tz("Asia/Bahrain")` call as getClosingTime, so the sheet's
 * "open" and "next opening" can never disagree with each other.
 *
 * Scans eight days (today through the same weekday next week), not seven: a branch whose only
 * open day is today, checked after today's shift has ended, next opens a week from now.
 */
export function getNextOpening(schedule: WorkingHoursSchedule | null | undefined): NextOpening | null {
    if (schedule == null) return null;

    const now = dayjs().tz("Asia/Bahrain");

    for (let i = 0; i <= 7; i++) {
        const day = DAY_INDEX_TO_NAME[(now.day() + i) % 7];
        const daySchedule = schedule[day];
        // Closed days, missing day keys and days with no shifts configured never open.
        if (!daySchedule || !daySchedule.isOpen || daySchedule.shifts.length === 0) continue;

        for (const [start] of daySchedule.shifts) {
            const [startHour, startMinute] = start.split(":").map(Number);
            const opensAt = now.add(i, "day").hour(startHour).minute(startMinute).second(0).millisecond(0);

            // A shift that already started today is behind us, but a later one the same day (a
            // split shift) still counts, so keep scanning instead of jumping to tomorrow.
            if (!opensAt.isAfter(now)) continue;

            return { daysAhead: i, day, time: start };
        }
    }

    return null;
}
