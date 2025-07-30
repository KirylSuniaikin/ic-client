import { useEffect, useRef } from "react";
import { addMinutes, format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";

const schedule = {
    Tuesday: "22:19",
    Wednesday: "18:03",
    Thursday: "01:30",
    Friday: "01:30",
    Saturday: "00:00",
    Sunday: "00:00",
    Monday: null,
};

const getDayName = () => {
    return format(new Date(), "EEEE", { timeZone: "Asia/Bahrain" }); // e.g. 'Tuesday'
};

const useClosingAlarm = (audioAllowed) => {
    const playedTodayRef = useRef(false);
    const audioRef = useRef(null);

    useEffect(() => {
        audioRef.current = new Audio("/assets/close-shift-alert.mp3");
        console.log(audioRef.current);

        const checkAndPlay = () => {
            const day = getDayName();
            const closingTimeStr = schedule[day];

            if (!closingTimeStr) return;

            const [closingHour, closingMinute] = closingTimeStr.split(":").map(Number);

            // const now = new Date();
            // const nowBahrain = utcToZonedTime(now, "Asia/Bahrain");
            const nowBahrain = utcToZonedTime(new Date("2025-07-29T20:19:00"), "Asia/Bahrain");


            const closingDate = new Date(nowBahrain);
            closingDate.setHours(closingHour, closingMinute, 0, 0);

            const alarmTime = addMinutes(closingDate, -120);

            const formattedNow = format(nowBahrain, "HH:mm");
            const formattedAlarm = format(alarmTime, "HH:mm");

            if (formattedNow === formattedAlarm && !playedTodayRef.current) {
                playedTodayRef.current = true;
                audioRef.current.play();
                console.log('⏰ ALARM TRIGGERED');
            }

            // Reset the flag at midnight Bahrain time
            if (format(nowBahrain, "HH:mm") === "00:00") {
                playedTodayRef.current = false;
            }
        };
        console.log("sound")

        const intervalId = setInterval(checkAndPlay, 30 * 1000); // check every 30s
        return () => clearInterval(intervalId);
    }, [audioAllowed]);
};

export default useClosingAlarm;

