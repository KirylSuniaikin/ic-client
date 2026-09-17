// Priority is edited via the card's edit drawer, not this menu — see EditOutlinedIcon item below.
import React, { useState } from "react";
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

export interface TaskCardMenuProps {
    cardId: number;
    disabled?: boolean;
    onEdit: () => void;
    onDelete?: () => void; // omitted = no Delete entry (the card popup still offers one)
}

export default function TaskCardMenu({ cardId, disabled, onEdit, onDelete }: TaskCardMenuProps): JSX.Element {
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

    const handleEdit = (event: React.MouseEvent<HTMLElement>): void => {
        event.stopPropagation();
        setAnchorEl(null);
        onEdit();
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
                aria-label="Card actions"
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
                <MenuItem data-testid={`task-card-edit-${cardId}`} onClick={handleEdit}>
                    <ListItemIcon>
                        <EditOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit</ListItemText>
                </MenuItem>
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
