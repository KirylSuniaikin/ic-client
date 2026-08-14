// Assumed: §5.5's TaskCardMenuProps (priority/disabled/onSelect) omits a card identifier,
// but §5.6 requires the trigger button's testid to be `task-card-menu-button-${card.id}`.
// Adding a required `cardId` prop is the simplest reconciliation — it does not change the
// menu's public behavior contract, only lets it compose the id-scoped testid.
import React, { useState } from "react";
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { TaskCardPriority } from "../types";
import { TASK_CARD_PRIORITY_COLORS } from "../types";

export interface TaskCardMenuProps {
    cardId: number;
    priority: TaskCardPriority;
    disabled?: boolean;
    onSelect: (priority: TaskCardPriority) => void;
    onDelete?: () => void; // omitted = no Delete entry (the card popup still offers one)
}

const PRIORITY_OPTIONS: { value: TaskCardPriority; label: string }[] = [
    { value: "GREEN", label: "Green" },
    { value: "YELLOW", label: "Yellow" },
    { value: "RED", label: "Red" },
];

export default function TaskCardMenu({ cardId, disabled, onSelect, onDelete }: TaskCardMenuProps): JSX.Element {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>): void => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleClose = (event?: React.SyntheticEvent): void => {
        event?.stopPropagation();
        setAnchorEl(null);
    };

    const handleSelect = (event: React.MouseEvent<HTMLElement>, value: TaskCardPriority): void => {
        event.stopPropagation();
        onSelect(value);
        setAnchorEl(null);
    };

    const handleDelete = (event: React.MouseEvent<HTMLElement>): void => {
        event.stopPropagation();
        setAnchorEl(null);
        onDelete?.();
    };

    return (
        <>
            <IconButton
                data-testid={`task-card-menu-button-${cardId}`}
                size="small"
                disabled={disabled}
                onClick={handleOpen}
                aria-label="Change priority"
            >
                <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                onClick={(e): void => e.stopPropagation()}
                slotProps={{
                    paper: {
                        elevation: 0,
                        sx: {
                            mt: 0.5,
                            minWidth: 170,
                            borderRadius: "12px",
                            backgroundColor: "#fbfaf6",
                            border: "1px solid rgba(15,23,42,0.08)",
                            boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                            "& .MuiList-root": { py: 0.5 },
                            "& .MuiMenuItem-root": {
                                mx: 0.5,
                                borderRadius: "8px",
                                minHeight: 38,
                                "&:hover": { backgroundColor: "rgba(15,23,42,0.05)" },
                            },
                            "& .MuiListItemIcon-root": { minWidth: 30 },
                        },
                    },
                }}
            >
                {PRIORITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} onClick={(e): void => handleSelect(e, option.value)}>
                        <ListItemIcon>
                            <FiberManualRecordIcon fontSize="small" sx={{ color: TASK_CARD_PRIORITY_COLORS[option.value] }} />
                        </ListItemIcon>
                        <ListItemText>{option.label}</ListItemText>
                    </MenuItem>
                ))}
                {onDelete && <Divider />}
                {onDelete && (
                    <MenuItem data-testid={`task-card-delete-${cardId}`} onClick={handleDelete} sx={{ color: "error.main" }}>
                        <ListItemIcon>
                            <DeleteOutlineIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText>Delete</ListItemText>
                    </MenuItem>
                )}
            </Menu>
        </>
    );
}
