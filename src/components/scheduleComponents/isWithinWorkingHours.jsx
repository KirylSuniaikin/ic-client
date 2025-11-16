import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {workingHours} from "./workingHours";

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = "Asia/Bahrain";

export function isWithinWorkingHours() {
    const now = dayjs().tz(tz);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[now.day()];
    const hours = workingHours[currentDayName];

    function parseTime(base, timeStr) {
        const [h, m] = timeStr.split(":").map(Number);
        return base.clone().hour(h).minute(m).second(0);
    }

    if (hours) {
        const [start, end] = hours;
        const startTime = parseTime(now, start);
        let endTime = parseTime(now, end);

        if (endTime.isBefore(startTime)) endTime = endTime.add(1, "day");

        if (now.isAfter(startTime) && now.isBefore(endTime)) return true;
    }

    if (now.hour() < 6) {
        const prevDayIndex = (now.day() + 6) % 7;
        const prevDayName = dayNames[prevDayIndex];
        const prevHours = workingHours[prevDayName];

        if (prevHours) {
            const [start, end] = prevHours;

            const prevBase = now.clone().subtract(1, "day");

            const startTime = parseTime(prevBase, start);
            let endTime = parseTime(prevBase, end);

            if (endTime.isBefore(startTime)) {
                endTime = endTime.add(1, "day");
            }

            if (now.isAfter(startTime) && now.isBefore(endTime)) return true;
        }
    }


    return false;
}