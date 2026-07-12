import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

export type NextOpeningResult = {
    hours: number;
    minutes: number;
    // Both non-null when the branch next opens on a LATER calendar day. A bare countdown reads
    // as nonsense across a day boundary ("opens in 22h" on a closed Sunday), so callers render
    // "Opens on Monday at 15:30" instead. Null when the next opening is later the same day, in
    // which case the countdown is the useful thing.
    nextOpeningDay: DayName | null;
    nextOpeningTime: string | null;
};

export type DayName = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

const DAY_INDEX_TO_NAME: DayName[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CLOSED: NextOpeningResult = { hours: 0, minutes: 0, nextOpeningDay: null, nextOpeningTime: null };

export function getTimeUntilNextOpening(
    schedule: WorkingHoursSchedule | null | undefined
): NextOpeningResult {
    if (schedule == null) {
        return CLOSED;
    }

    const now = dayjs().tz("Asia/Bahrain");

    for (let i = 0; i < 7; i++) {
        const dayName = DAY_INDEX_TO_NAME[(now.day() + i) % 7];
        const daySchedule = schedule[dayName];
        // Skip days that are closed or have no shifts configured.
        if (!daySchedule || !daySchedule.isOpen || daySchedule.shifts.length === 0) continue;

        for (const [start] of daySchedule.shifts) {
            const startHour = +start.split(":")[0];
            const startMinute = +start.split(":")[1];
            const nextOpen = now.add(i, "day").hour(startHour).minute(startMinute).second(0).millisecond(0);

            // A shift that already started today is behind us — but a later one the same day
            // (a split shift) is still a valid next opening, so keep scanning rather than
            // jumping straight to tomorrow.
            if (!nextOpen.isAfter(now)) continue;

            const dur = dayjs.duration(nextOpen.diff(now));
            const opensToday = i === 0;
            return {
                // asHours(), not hours(): duration components are modular, so a 28-hour gap
                // reports hours() === 4 and silently drops the day.
                hours: Math.floor(dur.asHours()),
                minutes: dur.minutes(),
                nextOpeningDay: opensToday ? null : dayName,
                nextOpeningTime: opensToday ? null : start,
            };
        }
    }

    return CLOSED;
}
