import React, { useState } from "react";
import { Box, Typography, CircularProgress, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { useSchedule } from "../hooks/useSchedule";
import EditScheduleDialog from "./EditScheduleDialog";
import { toDisplayClosing } from "../../../schedule/utils/getClosingTime";

interface ScheduleViewProps {
    branchId: string;
}

const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
] as const;

function formatShift(start: string, end: string): string {
    return `${start} - ${toDisplayClosing(end)}`;
}

export default function ScheduleView({ branchId }: ScheduleViewProps): JSX.Element {
    // The branch selector lives on the Menu tab (ConfigComponent's ManagementTopBar slot);
    // this view just reads whatever branch is currently scoped there so both tabs agree.
    const [editOpen, setEditOpen] = useState(false);

    const scheduleHook = useSchedule(branchId);
    const { schedule, loading, error } = scheduleHook;

    return (
        <Box>
            <Box
                sx={{
                    backgroundColor: "#fff",
                    borderRadius: 2,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                    p: 2,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 2,
                    }}
                >
                    <Typography variant="h6" fontWeight="bold">
                        Regular schedule
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={() => setEditOpen(true)}
                        aria-label="Edit schedule"
                    >
                        <EditIcon />
                    </IconButton>
                </Box>

                {loading && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}

                {!loading && error != null && (
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                )}

                {!loading && error == null &&
                    DAYS.map(day => {
                        const daySchedule = schedule?.[day];
                        // A day is closed when not in schedule, isOpen is false, or has no shifts.
                        const isClosed = daySchedule == null || !daySchedule.isOpen || daySchedule.shifts.length === 0;

                        return (
                            <Box
                                key={day}
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    borderBottom: "1px solid #eee",
                                    py: 1,
                                }}
                            >
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {day}
                                </Typography>
                                <Box sx={{ textAlign: "right" }}>
                                    {isClosed ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Closed
                                        </Typography>
                                    ) : (
                                        daySchedule.shifts.map((shift, i) => (
                                            <Typography key={i} variant="body2">
                                                {formatShift(shift[0], shift[1])}
                                            </Typography>
                                        ))
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
            </Box>

            <EditScheduleDialog
                open={editOpen}
                onClose={() => setEditOpen(false)}
                scheduleHook={scheduleHook}
            />
        </Box>
    );
}
