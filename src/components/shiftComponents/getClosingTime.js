import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { workingHours } from "../scheduleComponents/workingHours";

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = "Asia/Bahrain";

export function getClosingTime(now = dayjs().tz(tz)) {
    const dayName = now.format("dddd");
    const hours = workingHours[dayName];

    if (!hours) return null;
    const [start, end] = hours;

    const [endH, endM] = end.split(":").map(Number);
    let closingTime = now.clone().hour(endH).minute(endM).second(0).millisecond(0);

    const [startH, startM] = start.split(":").map(Number);
    const startTime = now.clone().hour(startH).minute(startM).second(0);

    if (closingTime.isBefore(startTime)) {
        closingTime = closingTime.add(1, "day");
    }

    return closingTime;
}