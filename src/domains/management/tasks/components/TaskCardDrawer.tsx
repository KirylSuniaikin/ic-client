import React, { useEffect, useState } from "react";
import { Box, Button, Drawer, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
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

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                {mode === "view" && card && (
                    <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, wordBreak: "break-word" }}>
                            {card.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {card.description && card.description.trim().length > 0 ? card.description : "No description"}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1.5 }}>
                            <Button fullWidth variant="outlined" onClick={onRequestEdit} disabled={submitting}>
                                Edit
                            </Button>
                            <Button fullWidth variant="outlined" color="error" onClick={onRequestDelete} disabled={submitting}>
                                Delete
                            </Button>
                        </Box>
                    </Box>
                )}

                {(mode === "create" || mode === "edit") && (
                    <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                            {mode === "create" ? "New Task" : "Edit Task"}
                        </Typography>
                        <TextField
                            autoFocus
                            label="Title"
                            fullWidth
                            variant="outlined"
                            value={values.title}
                            onChange={(e): void => setValues(prev => ({ ...prev, title: e.target.value }))}
                            inputProps={{ maxLength: TASK_TITLE_MAX_LENGTH }}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            label="Description"
                            fullWidth
                            multiline
                            minRows={3}
                            variant="outlined"
                            value={values.description}
                            onChange={(e): void => setValues(prev => ({ ...prev, description: e.target.value }))}
                            inputProps={{ maxLength: TASK_DESCRIPTION_MAX_LENGTH }}
                            sx={{ mb: 2 }}
                        />
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            Priority
                        </Typography>
                        <ToggleButtonGroup
                            exclusive
                            value={values.priority}
                            onChange={(_, v: TaskCardPriority | null): void => {
                                if (v) setValues(prev => ({ ...prev, priority: v }));
                            }}
                            size="small"
                            sx={{ mb: 3 }}
                        >
                            {PRIORITY_OPTIONS.map(option => (
                                <ToggleButton
                                    key={option.value}
                                    value={option.value}
                                    data-testid={`task-card-priority-${option.value}`}
                                    sx={{
                                        textTransform: "none",
                                        "&.Mui-selected": {
                                            backgroundColor: TASK_CARD_PRIORITY_COLORS[option.value],
                                            color: "#fff",
                                            "&:hover": { backgroundColor: TASK_CARD_PRIORITY_COLORS[option.value] },
                                        },
                                    }}
                                >
                                    {option.label}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleSave}
                            disabled={!saveEnabled}
                            sx={{ borderRadius: 3, py: 1.5, fontWeight: "bold" }}
                        >
                            Save
                        </Button>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
}
