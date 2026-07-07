import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { workingHours } from "./workingHours";

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = "Asia/Bahrain";
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The schedule stores an end-of-day closing as "23:59" (the inclusive last minute).
// ClosedPopup already presents that boundary as "00:00", so mirror it for a consistent look.
function toDisplayClosing(end: string): string {
    return end === "23:59" ? "00:00" : end;
}

// Returns the closing time ("HH:MM") of the interval currently in progress, or null when closed.
// Mirrors isWithinWorkingHours: checks today's intervals first, then an overnight interval that
// started yesterday (e.g. Thu 16:30–01:30 still running after midnight on Fri).
export function getClosingTime(): string | null {
    const now = dayjs().tz(tz);

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

    const todayHours = workingHours[dayNames[now.day()]] ?? [];
    for (const interval of todayHours) {
        const end = intervalEndIfActive(now, interval);
        if (end) return toDisplayClosing(end);
    }

    const prevDayIndex = (now.day() + 6) % 7;
    const prevDayHours = workingHours[dayNames[prevDayIndex]] ?? [];
    const yesterday = now.subtract(1, "day");
    for (const interval of prevDayHours) {
        const end = intervalEndIfActive(yesterday, interval);
        if (end) return toDisplayClosing(end);
    }

    return null;
}
