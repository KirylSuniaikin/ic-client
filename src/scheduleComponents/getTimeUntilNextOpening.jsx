import dayjs from "dayjs";
import {workingHours} from "./workingHours";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

export function getTimeUntilNextOpening() {
    const now = dayjs().tz("Asia/Bahrain");
    const dayIndexToName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    if (dayIndexToName[now.day()] === "Monday") {
        const [tuesdayStart] = workingHours["Tuesday"];
        const [startHour, startMinute] = tuesdayStart.split(":").map(Number);

        const nextOpen = now.add(1, "day").hour(startHour).minute(startMinute).second(0);
        const diff = nextOpen.diff(now);
        const dur = dayjs.duration(diff);

        return {
            hours: dur.hours(),
            minutes: dur.minutes(),
            nextOpeningMessage: "We open on Tuesday at 11:30"
        };
    }

    for (let i = 0; i < 7; i++) {
        const checkDay = (now.day() + i) % 7;
        const hours = workingHours[dayIndexToName[checkDay]];
        if (!hours) continue;

        const [start] = hours;
        const startHour = +start.split(":")[0];
        const startMinute = +start.split(":")[1];

        let nextOpen = now.add(i, "day").hour(startHour).minute(startMinute).second(0);
        if (i === 0 && nextOpen.isBefore(now)) continue;

        const diff = nextOpen.diff(now);
        const duration = dayjs.duration(diff);
        return {
            hours: duration.hours(),
            minutes: duration.minutes(),
            nextOpeningMessage: null
        };
    }

    return { hours: 0, minutes: 0, nextOpeningMessage: null };
}