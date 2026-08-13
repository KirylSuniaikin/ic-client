import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, Drawer, IconButton, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { TaskCard, TaskCardPriority } from "../types";
import { TASK_CARD_PRIORITY_COLORS, TASK_DESCRIPTION_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from "../types";

export type TaskCardDrawerMode = "view" | "create" | "edit";

export interface TaskCardFormValues {
    title: string;
    description: string;
    priority: TaskCardPriority;
}

export interface TaskCardDrawerProps {
    open: boolean;
    mode: TaskCardDrawerMode;
    card: TaskCard | null; // null when mode === 'create'
    submitting: boolean;
    onClose: () => void;
    onRequestEdit: () => void; // 'view' -> 'edit' within the same drawer instance
    onRequestDelete: () => void; // opens DeleteTaskCardDialog
    onCreate: (values: TaskCardFormValues) => void;
    onEdit: (cardId: number, values: TaskCardFormValues) => void;
}

const EMPTY_FORM_VALUES: TaskCardFormValues = { title: "", description: "", priority: "GREEN" };

const PRIORITY_OPTIONS: { value: TaskCardPriority; label: string }[] = [
    { value: "GREEN", label: "Green" },
    { value: "YELLOW", label: "Yellow" },
    { value: "RED", label: "Red" },
];

const ACCENT = "#E44B4C";

const ROUNDED_FIELD = {
    "& .MuiOutlinedInput-root": {
        borderRadius: "12px",
        backgroundColor: "#fbfaf6",
        "& fieldset": { borderColor: "rgba(15,23,42,0.12)" },
        "&:hover fieldset": { borderColor: "rgba(15,23,42,0.24)" },
        "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1 },
    },
    "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
} as const;

function seedValues(mode: TaskCardDrawerMode, card: TaskCard | null): TaskCardFormValues {
    if (mode === "create" || !card) return EMPTY_FORM_VALUES;
    return { title: card.title, description: card.description ?? "", priority: card.priority };
}

export default function TaskCardDrawer({
    open,
    mode,
    card,
    submitting,
    onClose,
    onRequestEdit,
    onRequestDelete,
    onCreate,
    onEdit,
}: TaskCardDrawerProps): JSX.Element {
    const theme = useTheme();
    // A bottom sheet is right on a phone and wrong on a laptop, where it strands the content at the
    // bottom edge of a wide screen. Phones keep the project's sheet convention; from `sm` up this
    // becomes a centred dialog.
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [values, setValues] = useState<TaskCardFormValues>(() => seedValues(mode, card));

    // Re-seed the local form whenever the drawer is (re)opened for a different mode/card —
    // the drawer itself owns no server state (§6.4).
    useEffect(() => {
        setValues(seedValues(mode, card));
    }, [mode, card, open]);

    const trimmedTitle = values.title.trim();
    const saveEnabled = trimmedTitle.length > 0 && trimmedTitle.length <= TASK_TITLE_MAX_LENGTH && !submitting;

    const handleSave = (): void => {
        if (!saveEnabled) return;
        const submitValues: TaskCardFormValues = {
            title: trimmedTitle,
            description: values.description.trim(),
            priority: values.priority,
        };
        if (mode === "create") {
            onCreate(submitValues);
        } else if (mode === "edit" && card) {
            onEdit(card.id, submitValues);
        }
    };

    const hasDescription = card?.description !== null && card?.description !== undefined && card.description.trim().length > 0;

    const content = (
        <Box data-testid="task-card-drawer" sx={{ px: 3, pt: isMobile ? 1.5 : 2.5, pb: isMobile ? 4 : 3 }}>
            {isMobile && (
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />
            )}

            {mode === "view" && card && (
                <Box>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    px: 1,
                                    py: 0.25,
                                    mb: 1,
                                    borderRadius: "999px",
                                    backgroundColor: `${TASK_CARD_PRIORITY_COLORS[card.priority]}1A`,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: TASK_CARD_PRIORITY_COLORS[card.priority],
                                    }}
                                />
                                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                                    {PRIORITY_OPTIONS.find(option => option.value === card.priority)?.label}
                                </Typography>
                            </Box>
                            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3, wordBreak: "break-word" }}>
                                {card.title}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ mt: -0.5, mr: -1 }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    <Box
                        sx={{
                            p: 1.75,
                            mb: 2.5,
                            borderRadius: "12px",
                            backgroundColor: "#fbfaf6",
                            border: "1px solid rgba(15,23,42,0.06)",
                            maxHeight: 320,
                            overflowY: "auto",
                        }}
                    >
                        <Typography
                            variant="body2"
                            color={hasDescription ? "text.primary" : "text.secondary"}
                            sx={{
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                fontStyle: hasDescription ? "normal" : "italic",
                            }}
                        >
                            {hasDescription ? card.description : "No description"}
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1.5 }}>
                        <Button
                            fullWidth
                            variant="contained"
                            disableElevation
                            startIcon={<EditOutlinedIcon />}
                            onClick={onRequestEdit}
                            disabled={submitting}
                            sx={{
                                borderRadius: "12px",
                                py: 1.15,
                                textTransform: "none",
                                fontWeight: 700,
                                backgroundColor: ACCENT,
                                "&:hover": { backgroundColor: "#d23c3d" },
                            }}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={onRequestDelete}
                            disabled={submitting}
                            sx={{ borderRadius: "12px", py: 1.15, px: 2.5, textTransform: "none", fontWeight: 700, flexShrink: 0 }}
                        >
                            Delete
                        </Button>
                    </Box>
                </Box>
            )}

            {(mode === "create" || mode === "edit") && (
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
                            {mode === "create" ? "New Task" : "Edit Task"}
                        </Typography>
                        <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ mr: -1 }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <TextField
                        autoFocus
                        label="Title"
                        fullWidth
                        variant="outlined"
                        value={values.title}
                        onChange={(e): void => setValues(prev => ({ ...prev, title: e.target.value }))}
                        inputProps={{ maxLength: TASK_TITLE_MAX_LENGTH }}
                        sx={{ mb: 2, ...ROUNDED_FIELD }}
                    />
                    <TextField
                        label="Description"
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={10}
                        variant="outlined"
                        value={values.description}
                        onChange={(e): void => setValues(prev => ({ ...prev, description: e.target.value }))}
                        inputProps={{ maxLength: TASK_DESCRIPTION_MAX_LENGTH }}
                        sx={{ mb: 2.5, ...ROUNDED_FIELD }}
                    />
                    <Typography
                        variant="caption"
                        sx={{ display: "block", mb: 1, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}
                    >
                        Priority
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        value={values.priority}
                        onChange={(_, v: TaskCardPriority | null): void => {
                            if (v) setValues(prev => ({ ...prev, priority: v }));
                        }}
                        size="small"
                        sx={{
                            mb: 3,
                            columnGap: 1,
                            "& .MuiToggleButtonGroup-grouped": {
                                border: "1px solid rgba(15,23,42,0.12)",
                                borderRadius: "999px !important",
                                marginLeft: 0,
                            },
                        }}
                    >
                        {PRIORITY_OPTIONS.map(option => (
                            <ToggleButton
                                key={option.value}
                                value={option.value}
                                data-testid={`task-card-priority-${option.value}`}
                                sx={{
                                    textTransform: "none",
                                    px: 2,
                                    fontWeight: 600,
                                    "&.Mui-selected": {
                                        backgroundColor: TASK_CARD_PRIORITY_COLORS[option.value],
                                        color: "#fff",
                                        borderColor: TASK_CARD_PRIORITY_COLORS[option.value],
                                        "&:hover": { backgroundColor: TASK_CARD_PRIORITY_COLORS[option.value] },
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        mr: 1,
                                        borderRadius: "50%",
                                        backgroundColor: values.priority === option.value ? "#fff" : TASK_CARD_PRIORITY_COLORS[option.value],
                                    }}
                                />
                                {option.label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                        <Button
                            variant="text"
                            onClick={onClose}
                            disabled={submitting}
                            sx={{ borderRadius: "12px", py: 1.25, px: 3, textTransform: "none", fontWeight: 700, color: "text.secondary" }}
                        >
                            Cancel
                        </Button>
                        <Button
                            fullWidth
                            variant="contained"
                            disableElevation
                            onClick={handleSave}
                            disabled={!saveEnabled}
                            sx={{
                                borderRadius: "12px",
                                py: 1.25,
                                textTransform: "none",
                                fontWeight: 700,
                                backgroundColor: ACCENT,
                                "&:hover": { backgroundColor: "#d23c3d" },
                            }}
                        >
                            Save
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );

    if (isMobile) {
        return (
            <Drawer
                anchor="bottom"
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        maxHeight: "92vh",
                        overflowY: "auto",
                    },
                }}
            >
                {content}
            </Drawer>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            slotProps={{
                paper: {
                    elevation: 0,
                    sx: {
                        borderRadius: "18px",
                        maxWidth: 520,
                        boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
                    },
                },
                backdrop: { sx: { backgroundColor: "rgba(15,23,42,0.35)" } },
            }}
        >
            {content}
        </Dialog>
    );
}
