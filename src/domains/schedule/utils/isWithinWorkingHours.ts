import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = "Asia/Bahrain";

export function isWithinWorkingHours(
    schedule: WorkingHoursSchedule | null | undefined
): boolean {
    if (schedule == null) return true;

    const now = dayjs().tz(tz);
    const dayNames: (keyof WorkingHoursSchedule)[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const checkInterval = (baseDate: dayjs.Dayjs, [start, end]: [string, string]): boolean => {
        const [startH, startM] = start.split(":").map(Number);
        const [endH, endM] = end.split(":").map(Number);

        const startTime = baseDate.clone().hour(startH).minute(startM).second(0);
        let endTime = baseDate.clone().hour(endH).minute(endM).second(0);

        if (endTime.isBefore(startTime)) {
            endTime = endTime.add(1, "day");
        }

        return now.isAfter(startTime) && now.isBefore(endTime);
    };

    const todaySchedule = schedule[dayNames[now.day()]];
    // A day is open only when isOpen is true and at least one shift covers the current moment.
    const isOpenToday = todaySchedule != null && todaySchedule.isOpen && todaySchedule.shifts.length > 0
        ? todaySchedule.shifts.some(interval => checkInterval(now, interval))
        : false;

    if (isOpenToday) return true;

    // Check overnight shift from the previous day (end <= start spans midnight).
    const prevDayIndex = (now.day() + 6) % 7;
    const prevDaySchedule = schedule[dayNames[prevDayIndex]];
    const yesterday = now.subtract(1, "day");

    const isOpenFromYesterday = prevDaySchedule != null && prevDaySchedule.isOpen && prevDaySchedule.shifts.length > 0
        ? prevDaySchedule.shifts.some(interval => checkInterval(yesterday, interval))
        : false;

    return isOpenFromYesterday;
}
