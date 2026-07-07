import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { isWithinWorkingHours } from "../utils/isWithinWorkingHours";
import { getTimeUntilNextOpening } from "../utils/getTimeUntilNextOpening";
import { getClosingTime } from "../utils/getClosingTime";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import type { IBranch } from "../../management/inventory/types";

const POLL_INTERVAL_MS = 60_000;
const FALLBACK_BRANCH_NAME = "IC Pizza";

interface BranchScheduleHeaderProps {
    branches: IBranch[];
}

function resolveBranchName(branches: IBranch[]): string {
    const branch = branches.find((b) => String(b.id) === DEFAULT_BRANCH_ID);
    return branch?.branchName ?? FALLBACK_BRANCH_NAME;
}

export default function BranchScheduleHeader({ branches }: BranchScheduleHeaderProps): JSX.Element {
    const { t } = useTranslation("schedule");
    const [open, setOpen] = useState<boolean>(() => isWithinWorkingHours());

    useEffect(() => {
        const update = (): void => setOpen(isWithinWorkingHours());
        update();
        const interval = setInterval(update, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const branchName = resolveBranchName(branches);

    // When open, show the closing time ("Closes at 23:00"); fall back to "Open now"
    // only if no active interval can be resolved.
    // When closed, mirror ClosedPopup's next-opening formatting: a special
    // nextOpeningMessage (e.g. the Monday case) wins outright, otherwise hours/minutes
    // render, falling back to "less than a minute" when both are zero.
    let scheduleText: string;
    if (open) {
        const closingTime = getClosingTime();
        scheduleText = closingTime
            ? t("header.closesAt", { time: closingTime })
            : t("header.openNow");
    } else {
        const { hours, minutes, nextOpeningMessage } = getTimeUntilNextOpening();
        scheduleText = nextOpeningMessage
            ?? (hours === 0 && minutes === 0
                ? t("closed.lessThanMinute")
                : t("header.opensIn", { hours, minutes }));
    }

    return (
        <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 2 }}>
            <Typography
                sx={{
                    fontFamily: "'Baloo Bhaijaan 2', sans-serif",
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "#fff",
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    lineHeight: 1.2,
                }}
            >
                {branchName}
            </Typography>
            <Typography
                sx={{
                    fontSize: "0.75rem",
                    color: "#fff",
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                }}
            >
                {scheduleText}
            </Typography>
        </Box>
    );
}
