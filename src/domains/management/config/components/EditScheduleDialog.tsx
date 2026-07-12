import React, { useState, useEffect } from "react";
import {
    Drawer,
    Button,
    IconButton,
    Switch,
    TextField,
    Typography,
    Box,
    Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import type { UseScheduleResult } from "../hooks/useSchedule";
import type { WorkingHoursSchedule, TimeRange, DaySchedule } from "../../../../shared/api/management";

interface EditScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    scheduleHook: UseScheduleResult;
}

type DayKey =
    | "Sunday"
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday";

const DAYS: DayKey[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

const DEFAULT_SHIFT: TimeRange = ["12:00", "23:59"];

// Fallback schedule used when no schedule has been loaded yet.
const EMPTY_SCHEDULE: WorkingHoursSchedule = {
    Sunday: { isOpen: false, shifts: [] },
    Monday: { isOpen: false, shifts: [] },
    Tuesday: { isOpen: false, shifts: [] },
    Wednesday: { isOpen: false, shifts: [] },
    Thursday: { isOpen: false, shifts: [] },
    Friday: { isOpen: false, shifts: [] },
    Saturday: { isOpen: false, shifts: [] },
};

export default function EditScheduleDialog({
    open,
    onClose,
    scheduleHook,
}: EditScheduleDialogProps): JSX.Element {
    const { localSchedule, setLocalSchedule, dirty, save, reset, error } = scheduleHook;

    // Track which days are expanded to show their shifts.
    const [expandedDays, setExpandedDays] = useState<Set<DayKey>>(new Set());
    // Track whether a save was attempted so we know when to close on success.
    const [saveTriggered, setSaveTriggered] = useState(false);

    // Auto-expand open days when the drawer opens.
    useEffect(() => {
        if (open && localSchedule != null) {
            const openDays = new Set(
                DAYS.filter(day => localSchedule[day]?.isOpen === true)
            );
            setExpandedDays(openDays);
        } else if (!open) {
            setExpandedDays(new Set());
            setSaveTriggered(false);
        }
    }, [open]); // intentionally only re-run when open changes

    // Close on successful save: dirty becomes false + no error.
    useEffect(() => {
        if (!saveTriggered) return;
        if (!dirty && error === null) {
            onClose();
            setSaveTriggered(false);
        } else if (error !== null) {
            // Save failed — show error, allow retry.
            setSaveTriggered(false);
        }
    }, [saveTriggered, dirty, error, onClose]);

    const handleDayToggle = (day: DayKey, isCurrentlyOpen: boolean): void => {
        const current = localSchedule ?? EMPTY_SCHEDULE;
        const daySchedule = current[day];
        if (isCurrentlyOpen) {
            // Close: flip isOpen, KEEP shifts so re-opening restores the manager's hours.
            setLocalSchedule({ ...current, [day]: { isOpen: false, shifts: daySchedule?.shifts ?? [] } });
            setExpandedDays(prev => {
                const next = new Set(prev);
                next.delete(day);
                return next;
            });
        } else {
            // Open: keep existing shifts, or add the default shift if none are configured.
            const existingShifts = daySchedule?.shifts ?? [];
            const shifts = existingShifts.length > 0 ? existingShifts : [DEFAULT_SHIFT];
            setLocalSchedule({ ...current, [day]: { isOpen: true, shifts } });
            setExpandedDays(prev => new Set([...prev, day]));
        }
    };

    const handleExpandToggle = (day: DayKey): void => {
        setExpandedDays(prev => {
            const next = new Set(prev);
            if (next.has(day)) {
                next.delete(day);
            } else {
                next.add(day);
            }
            return next;
        });
    };

    const handleTimeChange = (
        day: DayKey,
        shiftIndex: number,
        field: 0 | 1,
        value: string,
    ): void => {
        const current = localSchedule ?? EMPTY_SCHEDULE;
        const daySchedule = current[day];
        const dayShifts: TimeRange[] = daySchedule?.shifts ?? [];
        const updatedShifts: TimeRange[] = dayShifts.map((shift, i) => {
            if (i !== shiftIndex) return shift;
            const updated: TimeRange =
                field === 0 ? [value, shift[1]] : [shift[0], value];
            return updated;
        });
        const updatedDay: DaySchedule = { isOpen: daySchedule?.isOpen ?? true, shifts: updatedShifts };
        setLocalSchedule({ ...current, [day]: updatedDay });
    };

    const handleAddShift = (day: DayKey): void => {
        const current = localSchedule ?? EMPTY_SCHEDULE;
        const daySchedule = current[day];
        const dayShifts: TimeRange[] = daySchedule?.shifts ?? [];
        const updatedDay: DaySchedule = { isOpen: daySchedule?.isOpen ?? true, shifts: [...dayShifts, DEFAULT_SHIFT] };
        setLocalSchedule({ ...current, [day]: updatedDay });
    };

    const handleDeleteShift = (day: DayKey, shiftIndex: number): void => {
        const current = localSchedule ?? EMPTY_SCHEDULE;
        const daySchedule = current[day];
        const dayShifts: TimeRange[] = daySchedule?.shifts ?? [];
        const remaining = dayShifts.filter((_, i) => i !== shiftIndex);
        // Keep isOpen as-is; empty shifts means effectively closed but toggle is the source of truth.
        const updatedDay: DaySchedule = { isOpen: daySchedule?.isOpen ?? true, shifts: remaining };
        setLocalSchedule({ ...current, [day]: updatedDay });
    };

    const handleSave = async (): Promise<void> => {
        setSaveTriggered(true);
        await save();
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{ zIndex: 1350 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    maxHeight: "90dvh",
                    display: "flex",
                    flexDirection: "column",
                },
            }}
        >
            {/* Header: grab handle + centered title + close */}
            <Box sx={{ px: 2, pt: 1.5, pb: 1, flexShrink: 0 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 1.5 }} />
                <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="h6" noWrap sx={{ fontWeight: 800 }}>
                        Edit regular schedule
                    </Typography>
                    <IconButton
                        onClick={onClose}
                        aria-label="Close"
                        size="small"
                        sx={{ position: "absolute", right: 0 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Scrollable day list */}
            <Box
                sx={{
                    px: 2,
                    flex: 1,
                    overflowY: "auto",
                    "&::-webkit-scrollbar": { display: "none" },
                }}
            >
                {error != null && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {DAYS.map(day => {
                    const daySchedule = localSchedule?.[day];
                    // A day is open when isOpen is true and has shifts; otherwise closed.
                    const isOpen = daySchedule != null && daySchedule.isOpen;
                    const isExpanded = expandedDays.has(day);
                    const dayShifts: TimeRange[] = daySchedule?.shifts ?? [];

                    return (
                        <Box key={day}>
                            {/* Day header row */}
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    py: 0.5,
                                    borderBottom: "1px solid #f0f0f0",
                                }}
                            >
                                {/* Chevron only shown for open days */}
                                {isOpen ? (
                                    <IconButton
                                        size="small"
                                        onClick={() => handleExpandToggle(day)}
                                        aria-label={isExpanded ? "Collapse" : "Expand"}
                                    >
                                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    </IconButton>
                                ) : (
                                    // Spacer to keep layout aligned.
                                    <Box sx={{ width: 34, flexShrink: 0 }} />
                                )}

                                <Typography sx={{ flex: 1, fontWeight: 700, ml: 0.5 }}>
                                    {day}
                                </Typography>

                                {/* iOS-green toggle = open, grey = closed (matches DoughSection) */}
                                <Switch
                                    checked={isOpen}
                                    onChange={() => handleDayToggle(day, isOpen)}
                                    sx={{
                                        "& .MuiSwitch-switchBase.Mui-checked": { color: "#fff" },
                                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                            backgroundColor: "#34c759",
                                            opacity: 1,
                                        },
                                    }}
                                />
                            </Box>

                            {/* Expanded shift rows */}
                            {isOpen && isExpanded && (
                                <Box sx={{ pl: 5, pt: 1, pb: 1 }}>
                                    {dayShifts.map((shift, i) => (
                                        <Box
                                            key={i}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                mb: 1,
                                            }}
                                        >
                                            <TextField
                                                size="small"
                                                value={shift[0]}
                                                onChange={e =>
                                                    handleTimeChange(day, i, 0, e.target.value)
                                                }
                                                placeholder="HH:mm"
                                                inputProps={{ "aria-label": "Start time" }}
                                                sx={{ width: 88, "& .MuiOutlinedInput-root": { borderRadius: "14px" } }}
                                            />
                                            <Typography variant="body2" sx={{ flexShrink: 0 }}>
                                                to
                                            </Typography>
                                            <TextField
                                                size="small"
                                                value={shift[1]}
                                                onChange={e =>
                                                    handleTimeChange(day, i, 1, e.target.value)
                                                }
                                                placeholder="HH:mm"
                                                inputProps={{ "aria-label": "End time" }}
                                                sx={{ width: 88, "& .MuiOutlinedInput-root": { borderRadius: "14px" } }}
                                            />
                                            <IconButton
                                                size="small"
                                                onClick={() => handleDeleteShift(day, i)}
                                                aria-label="Delete shift"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ))}

                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => handleAddShift(day)}
                                        sx={{ textTransform: "none", color: "#E44B4C" }}
                                    >
                                        Add shift
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {/* Sticky bottom action bar */}
            <Box
                sx={{
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    gap: 1,
                    borderTop: "1px solid #eee",
                    backgroundColor: "#fff",
                    flexShrink: 0,
                }}
            >
                <Button
                    onClick={reset}
                    variant="outlined"
                    fullWidth
                    sx={{
                        textTransform: "none",
                        borderRadius: "999px",
                        py: 1.25,
                        fontWeight: 700,
                        fontSize: "1rem",
                        color: "#1c1c1e",
                        borderColor: "#d1d1d6",
                        backgroundColor: "#fff",
                        "&:hover": { borderColor: "#c7c7cc", backgroundColor: "#f7f7f7" },
                    }}
                >
                    Reset
                </Button>
                <Button
                    onClick={() => { void handleSave(); }}
                    variant="contained"
                    fullWidth
                    disabled={!dirty}
                    sx={{
                        backgroundColor: "#E44B4C",
                        borderRadius: "999px",
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: "1rem",
                        py: 1.25,
                        "&:hover": { backgroundColor: "#c63b3c" },
                    }}
                >
                    Save
                </Button>
            </Box>
        </Drawer>
    );
}
