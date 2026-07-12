import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = "Asia/Bahrain";

// The schedule stores an end-of-day closing as "23:59" (the inclusive last minute).
// ClosedPopup already presents that boundary as "00:00", so mirror it for a consistent look.
export function toDisplayClosing(end: string): string {
    return (end === "23:59" || end === "24:00") ? "00:00" : end;
}

// Returns the closing time ("HH:MM") of the shift currently in progress, or null when closed
// (or when no schedule is available). Mirrors isWithinWorkingHours: checks today's shifts first,
// then an overnight shift that started yesterday (e.g. Thu 16:30–01:30 still running after midnight on Fri).
export function getClosingTime(
    schedule: WorkingHoursSchedule | null | undefined
): string | null {
    if (schedule == null) return null;

    const now = dayjs().tz(tz);
    const dayNames: (keyof WorkingHoursSchedule)[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const intervalEndIfActive = (baseDate: dayjs.Dayjs, [start, end]: [string, string]): string | null => {
        const [startH, startM] = start.split(":").map(Number);
        const [endH, endM] = end.split(":").map(Number);

        const startTime = baseDate.clone().hour(startH).minute(startM).second(0);
        let endTime = baseDate.clone().hour(endH).minute(endM).second(0);
        if (endTime.isBefore(startTime)) {
            endTime = endTime.add(1, "day");
        }

        return now.isAfter(startTime) && now.isBefore(endTime) ? end : null;
    };

    const todaySchedule = schedule[dayNames[now.day()]];
    if (todaySchedule != null && todaySchedule.isOpen) {
        for (const interval of todaySchedule.shifts) {
            const end = intervalEndIfActive(now, interval);
            if (end) return toDisplayClosing(end);
        }
    }

    const prevDayIndex = (now.day() + 6) % 7;
    const prevDaySchedule = schedule[dayNames[prevDayIndex]];
    const yesterday = now.subtract(1, "day");
    if (prevDaySchedule != null && prevDaySchedule.isOpen) {
        for (const interval of prevDaySchedule.shifts) {
            const end = intervalEndIfActive(yesterday, interval);
            if (end) return toDisplayClosing(end);
        }
    }

    return null;
}
