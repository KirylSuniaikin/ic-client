import {useEffect, useRef, useState} from "react";
import alertSound from "../../../assets/close-shift-alert-blr.mp3";
import dayjs from "dayjs";
import {getClosingTime} from "../getClosingTime";


const useClosingAlarm = (audioAllowed) => {
    const playedRef = useRef(false);
    const [audioRef] = useState(new Audio(alertSound));

    useEffect(() => {
        if (!audioAllowed) return;

        const interval = setInterval(() => {
            const now = dayjs().tz("Asia/Bahrain");
            const closingTime = getClosingTime(now);
            if (!closingTime) return;

            const alarmTime = closingTime.subtract(2, "hour");

            const diff = Math.abs(now.diff(alarmTime, "minute"));

            if (diff < 1 && !playedRef.current) {
                audioRef.loop = false;
                audioRef.play().then(() => {
                    playedRef.current = true;
                    console.log("⏰ Alarm triggered");
                }).catch(console.error);
            }

            if (now.hour() === 6 && now.minute() === 0) {
                playedRef.current = false;
            }

        }, 30 * 1000);

        return () => clearInterval(interval);
    }, [audioAllowed, audioRef]);
};

export default useClosingAlarm;

