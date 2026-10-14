import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useTranslation } from "react-i18next";
import { isWithinWorkingHours } from "../utils/isWithinWorkingHours";
import { getTimeUntilNextOpening } from "../utils/getTimeUntilNextOpening";
import { getClosingTime } from "../utils/getClosingTime";
import { useBranchResolution } from "../../branch/hooks/useBranchResolution";
import type { IBranch } from "../../management/inventory/types";
import type { WorkingHoursSchedule } from "../../../shared/api/management";

const POLL_INTERVAL_MS = 60_000;
const FALLBACK_BRANCH_NAME = "IC Pizza";

interface BranchScheduleHeaderProps {
    branches: IBranch[];
    workingHours: WorkingHoursSchedule | null | undefined;
    /** Makes the branch name reopen the picker. Omitted on kiosk and admin, where the branch is
     *  not the customer's to change. */
    onBranchClick?: () => void;
}

// chosenBranchId already carries the DEFAULT_BRANCH_ID fallback (see useBranchResolution) — this
// only matches against whichever id it resolved to, so DEFAULT_BRANCH_ID survives here only as
// that hook's last-resort fallback, never as a first-choice match.
function resolveBranchName(branches: IBranch[], chosenBranchId: string): string {
    const branch = branches.find((b) => String(b.id) === chosenBranchId);
    return branch?.branchName ?? FALLBACK_BRANCH_NAME;
}

export default function BranchScheduleHeader({ branches, workingHours , onBranchClick }: BranchScheduleHeaderProps): JSX.Element {
    const { t } = useTranslation("schedule");
    const { chosenBranchId } = useBranchResolution();
    const [open, setOpen] = useState<boolean>(() => isWithinWorkingHours(workingHours));

    useEffect(() => {
        const update = (): void => setOpen(isWithinWorkingHours(workingHours));
        update();
        const interval = setInterval(update, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [workingHours]);

    const branchName = resolveBranchName(branches, chosenBranchId);

    // When open, show the closing time ("Closes at 23:00"); fall back to "Open now"
    // only if no active interval can be resolved.
    // When closed, a countdown only makes sense within the same day — across a day boundary
    // ("opens in 22h" on a closed Sunday) it is unreadable, so name the day instead.
    let scheduleText: string;
    if (open) {
        const closingTime = getClosingTime(workingHours);
        scheduleText = closingTime
            ? t("header.closesAt", { time: closingTime })
            : t("header.openNow");
    } else {
        const { hours, minutes, nextOpeningDay, nextOpeningTime } = getTimeUntilNextOpening(workingHours);
        if (nextOpeningDay && nextOpeningTime) {
            scheduleText = t("header.opensOnDay", { day: t(`days.${nextOpeningDay}`), time: nextOpeningTime });
        } else {
            scheduleText = hours === 0 && minutes === 0
                ? t("closed.lessThanMinute")
                : t("header.opensIn", { hours, minutes });
        }
    }

    return (
        <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 2 }}>
            {/* The branch name IS the way back to the picker — there is deliberately no second
                chip beneath it. Two labels showing the same branch, one of them tappable, read as
                a bug rather than an affordance. Without a handler (kiosk, admin) it stays a plain
                label. */}
            <Typography
                component={onBranchClick ? "button" : "div"}
                onClick={onBranchClick}
                aria-label={onBranchClick ? t("header.changeBranch", { branchName }) : undefined}
                sx={{
                    fontFamily: "'Baloo Bhaijaan 2', sans-serif",
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "#fff",
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    lineHeight: 1.2,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                    ...(onBranchClick
                        ? {
                              background: "none",
                              border: "none",
                              p: 0,
                              cursor: "pointer",
                              font: "inherit",
                          }
                        : {}),
                }}
            >
                {branchName}
                {onBranchClick && <KeyboardArrowDownIcon sx={{ fontSize: "1.1rem" }} />}
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
