import React from "react";
import { Box, CircularProgress, IconButton, List, ListItemButton, ListItemText } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { BoardOwner } from "../types";

export interface StaffBoardSidebarProps {
    owners: BoardOwner[];
    loading: boolean;
    selectedOwnerId: number | null;
    open: boolean;
    onToggle: () => void;
    onSelect: (ownerId: number) => void;
}

// Purely presentational — no fetching, no local server-state. Membership/order of `owners`
// is consumed exactly as received; no client-side sort/filter/dedupe here.
export default function StaffBoardSidebar({
    owners,
    loading,
    selectedOwnerId,
    open,
    onToggle,
    onSelect,
}: StaffBoardSidebarProps): JSX.Element {
    const showLoading = loading && owners.length === 0;

    return (
        <Box
            data-testid="staff-board-sidebar"
            sx={{
                width: open ? 240 : 48,
                flexShrink: 0,
                backgroundColor: "#fbfaf6",
                borderRadius: 2,
                p: open ? 1 : 0.5,
                boxSizing: "border-box",
                transition: "width 0.2s ease",
            }}
        >
            <Box sx={{ display: "flex", justifyContent: open ? "flex-end" : "center", mb: open ? 1 : 0 }}>
                <IconButton
                    data-testid="staff-board-sidebar-toggle"
                    size="small"
                    onClick={onToggle}
                    aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
                >
                    {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
            </Box>
            {open && showLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress data-testid="staff-board-sidebar-loading" size={20} />
                </Box>
            )}
            {open && !showLoading && (
                <List dense disablePadding data-testid="staff-board-sidebar-list">
                    {owners.map(owner => (
                        <ListItemButton
                            key={owner.id}
                            data-testid={`staff-board-sidebar-row-${owner.id}`}
                            selected={owner.id === selectedOwnerId}
                            onClick={(): void => onSelect(owner.id)}
                        >
                            <ListItemText primary={owner.username} />
                        </ListItemButton>
                    ))}
                </List>
            )}
        </Box>
    );
}
