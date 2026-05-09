import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ramadanHours, workingHours } from "../scheduleComponents/workingHours";

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = "Asia/Bahrain";

export function getClosingTime(now?: Dayjs): Dayjs | null {
    const currentNow = now ?? dayjs().tz(tz);
    const dayName = currentNow.format("dddd");

    const shifts = ramadanHours[dayName];

    if (!shifts || shifts.length === 0) return null;

    let targetClosingTime: Dayjs | null = null;

    for (const [start, end] of shifts) {
        if (typeof start !== "string" || typeof end !== "string") continue;

        const [startH, startM] = start.split(":").map(Number);
        const [endH, endM] = end.split(":").map(Number);

        let startTime = currentNow.clone().hour(startH).minute(startM).second(0).millisecond(0);
        let closingTime = currentNow.clone().hour(endH).minute(endM).second(0).millisecond(0);

        if (closingTime.isBefore(startTime)) {
            closingTime = closingTime.add(1, "day");
        }

        if (currentNow.isBefore(closingTime)) {
            targetClosingTime = closingTime;
            break;
        }
    }

    return targetClosingTime;
}
