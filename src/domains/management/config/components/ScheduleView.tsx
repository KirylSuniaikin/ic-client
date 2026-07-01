import React, { useState } from "react";
import { Box, Typography, CircularProgress, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { StaffRoles } from "../../../auth/types";
import { BranchSelectorComponent } from "../../_shared/components/BranchSelectorComponent";
import { useBranchSelection } from "../../_shared/hooks/useBranchSelection";
import { useSchedule } from "../hooks/useSchedule";
import EditScheduleDialog from "./EditScheduleDialog";

interface SelectedBranch {
    id: string;
    name?: string;
    [key: string]: unknown;
}

interface ScheduleViewProps {
    selectedBranch: SelectedBranch;
    role: StaffRoles | null;
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
    return `${start} - ${end}`;
}

export default function ScheduleView({ selectedBranch, role }: ScheduleViewProps): JSX.Element {
    // useBranchSelection is always called (hooks must not be conditional).
    // The result is only used when role === SUPER_MANAGER.
    const { branches, selectedBranch: smBranch, onBranchChange } = useBranchSelection();
    const [editOpen, setEditOpen] = useState(false);

    // SUPER_MANAGER gets a branch picker; MANAGER uses the branch prop directly.
    const activeBranchId =
        role === StaffRoles.SUPER_MANAGER && smBranch != null
            ? String(smBranch.id)
            : selectedBranch.id;

    const scheduleHook = useSchedule(activeBranchId);
    const { schedule, loading, error } = scheduleHook;

    return (
        <Box>
            {role === StaffRoles.SUPER_MANAGER && branches.length > 0 && smBranch != null && (
                <Box sx={{ mb: 2 }}>
                    <BranchSelectorComponent
                        branches={branches}
                        selectedBranch={smBranch}
                        onBranchChange={onBranchChange}
                    />
                </Box>
            )}

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
