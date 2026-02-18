import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {ramadanHours, workingHours} from "./workingHours";

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = "Asia/Bahrain";

export function isWithinWorkingHours() {
    const now = dayjs().tz(tz);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const checkInterval = (baseDate, [start, end]) => {
        const [startH, startM] = start.split(":").map(Number);
        const [endH, endM] = end.split(":").map(Number);

        const startTime = baseDate.clone().hour(startH).minute(startM).second(0);
        let endTime = baseDate.clone().hour(endH).minute(endM).second(0);

        if (endTime.isBefore(startTime)) {
            endTime = endTime.add(1, "day");
        }

        return now.isAfter(startTime) && now.isBefore(endTime);
    };

    const currentDayHours = ramadanHours[dayNames[now.day()]] || [];
    if(currentDayHours ===null) return false;
    const isOpenToday = currentDayHours.some(interval => checkInterval(now, interval));

    if (isOpenToday) return true;

    const prevDayIndex = (now.day() + 6) % 7;
    const prevDayHours = ramadanHours[dayNames[prevDayIndex]] || [];
    const yesterday = now.subtract(1, "day");

    const isOpenFromYesterday = prevDayHours.some(interval => checkInterval(yesterday, interval));

    return isOpenFromYesterday;
}