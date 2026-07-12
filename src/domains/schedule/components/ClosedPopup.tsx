import React from "react";
import {Box, Button, Modal, Typography} from "@mui/material";
import Lottie from "lottie-react";
import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import sadManData from "../../../assets/animations/сrying-emoji-onclose.json";
import {getTimeUntilNextOpening} from "../utils/getTimeUntilNextOpening";
import {formatWeeklyHours} from "../utils/formatWeeklyHours";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

// cast is needed because lottie-react expects AnimationConfigWithData['animationData']
// but JSON modules are typed as `unknown` per global.d.ts
const sadMan = sadManData as object;

interface ClosedPopupProps {
    open: boolean;
    onClose: () => void;
    workingHours?: WorkingHoursSchedule | null;
}

export default function ClosedPopup({ open, onClose, workingHours }: ClosedPopupProps): JSX.Element {
    const { t } = useTranslation("schedule");
    const [timeLeft, setTimeLeft] = useState("");
    const [nextOpeningMessage, setNextOpeningMessage] = useState<string | null>(null);
    // Derived from the branch's real schedule — these used to be hardcoded strings, so editing
    // a branch's hours in the admin panel left this popup advertising the old ones.
    const weeklyHours = useMemo(() => formatWeeklyHours(workingHours), [workingHours]);

    useEffect(() => {
        if (!open) return;
        const { hours, minutes, nextOpeningDay, nextOpeningTime } = getTimeUntilNextOpening(workingHours);
        // Across a day boundary a raw countdown is unreadable ("22h 30m"), so name the day the
        // branch actually reopens; the countdown is kept for a reopening later the same day.
        setNextOpeningMessage(
            nextOpeningDay && nextOpeningTime
                ? t("header.opensOnDay", { day: t(`days.${nextOpeningDay}`), time: nextOpeningTime })
                : null
        );
        setTimeLeft(hours === 0 && minutes === 0 ? t("closed.lessThanMinute") : `${hours}h ${minutes}m`);
    }, [open, t, workingHours]);

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, #fff 0%, #FBFAF6 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 3,
                    textAlign: "center",
                }}
            >
                <Box sx={{ width: 260 }}>
                    <Lottie animationData={sadMan} loop={false} autoplay/>
                </Box>

                <Typography variant="h6" sx={{ mt: -2, fontWeight: "bold", color: "#E44B4C" }}>
                    {t("closed.title")}
                </Typography>

                {!nextOpeningMessage && (
                <Typography sx={{ mt: 1.5, fontSize: 16 }}>
                    {t("closed.enjoyIn")}
                </Typography>
                )}

                {!nextOpeningMessage && (
                    <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: "bold" }}>
                        {timeLeft}
                    </Typography>
                )}

                {nextOpeningMessage && (
                    <Typography sx={{ mt: 1.5, fontSize: 16 }}>
                        {nextOpeningMessage}
                    </Typography>
                )}

                <Typography sx={{ mt: 3, fontSize: 14, color: "#888", fontWeight: 500 }}>
                    {t("closed.workingHours")}
                </Typography>

                <Box sx={{ mt: 1, fontSize: 14, lineHeight: 1.6 }}>
                    {weeklyHours.map((row) => (
                        <Typography key={row.days.join(",")}>
                            {`${row.days.map((day) => t(`daysShort.${day}`)).join(", ")} — ${row.shifts ? row.shifts.join(", ") : t("closed.closedDay")}`}
                        </Typography>
                    ))}
                </Box>

                <Button
                    variant="outlined"
                    onClick={onClose}
                    sx={{
                        mt: 3,
                        borderColor: "#E44B4C",
                        color: "#E44B4C",
                        borderRadius: 16,
                        fontWeight: "bold",
                        "&:hover": {
                            borderColor: "#d13b3c",
                            backgroundColor: "#fff5f5",
                        }
                    }}
                >
                    {t("closed.seeYouSoon")}
                </Button>
            </Box>
        </Modal>
    );
}
