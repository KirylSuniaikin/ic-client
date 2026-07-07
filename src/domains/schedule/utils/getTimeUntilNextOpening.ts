import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

type NextOpeningResult = {
    hours: number;
    minutes: number;
    nextOpeningMessage: string | null;
};

export function getTimeUntilNextOpening(
    schedule: WorkingHoursSchedule | null | undefined
): NextOpeningResult {
    if (schedule == null) {
        return { hours: 0, minutes: 0, nextOpeningMessage: null };
    }

    const now = dayjs().tz("Asia/Bahrain");
    const dayIndexToName: (keyof WorkingHoursSchedule)[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let i = 0; i < 7; i++) {
        const checkDay = (now.day() + i) % 7;
        const daySchedule = schedule[dayIndexToName[checkDay]];
        // Skip days that are closed or have no shifts configured.
        if (!daySchedule || !daySchedule.isOpen || daySchedule.shifts.length === 0) continue;

        const [firstShift] = daySchedule.shifts;
        const [start] = firstShift;
        const startHour = +start.split(":")[0];
        const startMinute = +start.split(":")[1];

        const nextOpen = now.add(i, "day").hour(startHour).minute(startMinute).second(0);
        if (i === 0 && nextOpen.isBefore(now)) continue;

        const diff = nextOpen.diff(now);
        const dur = dayjs.duration(diff);
        return {
            hours: dur.hours(),
            minutes: dur.minutes(),
            nextOpeningMessage: null
        };
    }

    return { hours: 0, minutes: 0, nextOpeningMessage: null };
}
