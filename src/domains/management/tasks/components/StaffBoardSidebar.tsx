import React from "react";
import { Avatar, Box, CircularProgress, Divider, IconButton, List, ListItemButton, Tooltip, Typography } from "@mui/material";
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

const ACCENT = "#E44B4C";

function initials(username: string): string {
    const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function roleLabel(role: BoardOwner["role"]): string {
    return String(role).replace(/_/g, " ").toLowerCase();
}

// Purely presentational — no fetching, no local server-state. Membership/order of `owners`
// is consumed exactly as received; no client-side sort/filter/dedupe here. The server pins the
// caller at index 0, which is what makes "my board" the first row.
export default function StaffBoardSidebar({
    owners,
    loading,
    selectedOwnerId,
    open,
    onToggle,
    onSelect,
}: StaffBoardSidebarProps): JSX.Element {
    const showLoading = loading && owners.length === 0;

    const renderRow = (owner: BoardOwner, isOwn: boolean): JSX.Element => {
        const selected = owner.id === selectedOwnerId;
        const row = (
            <ListItemButton
                key={owner.id}
                data-testid={`staff-board-sidebar-row-${owner.id}`}
                selected={selected}
                onClick={(): void => onSelect(owner.id)}
                sx={{
                    borderRadius: "10px",
                    mb: 0.5,
                    px: open ? 1 : 0.5,
                    py: 0.75,
                    justifyContent: open ? "flex-start" : "center",
                    gap: open ? 1.25 : 0,
                    "&.Mui-selected": {
                        backgroundColor: "rgba(228,75,76,0.10)",
                        "&:hover": { backgroundColor: "rgba(228,75,76,0.16)" },
                    },
                }}
            >
                <Avatar
                    sx={{
                        width: 30,
                        height: 30,
                        fontSize: 12,
                        fontWeight: 700,
                        color: selected ? "#fff" : "text.secondary",
                        backgroundColor: selected ? ACCENT : "rgba(15,23,42,0.08)",
                    }}
                >
                    {initials(owner.username)}
                </Avatar>
                {open && (
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: selected ? 700 : 500,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {owner.username}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "capitalize" }}>
                            {isOwn ? "My board" : roleLabel(owner.role)}
                        </Typography>
                    </Box>
                )}
            </ListItemButton>
        );

        // Collapsed to the icon rail, the name is gone — the tooltip is the only way to tell the
        // avatars apart.
        return open ? row : (
            <Tooltip key={owner.id} title={owner.username} placement="right">
                <Box>{row}</Box>
            </Tooltip>
        );
    };

    return (
        <Box
            data-testid="staff-board-sidebar"
            // Collapsing keeps the rows (as an avatar rail) rather than emptying the list, so
            // "is it collapsed" needs its own marker instead of being inferred from absent rows.
            data-open={open ? "true" : "false"}
            sx={{
                width: open ? 232 : 60,
                flexShrink: 0,
                alignSelf: "flex-start",
                // Its own rounded surface so it reads as a separate list of people rather than
                // a slice of the board.
                backgroundColor: "#fff",
                borderRadius: "16px",
                border: "1px solid rgba(15,23,42,0.07)",
                boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
                p: 1,
                m: { xs: 1.5, sm: 2 },
                mr: 0,
                boxSizing: "border-box",
                transition: "width 0.2s ease",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: open ? "space-between" : "center",
                    height: 36,
                    pl: open ? 1 : 0,
                    mb: 0.5,
                }}
            >
                {open && (
                    <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}
                    >
                        Boards
                    </Typography>
                )}
                <IconButton
                    data-testid="staff-board-sidebar-toggle"
                    size="small"
                    onClick={onToggle}
                    aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
                >
                    {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
            </Box>
            {showLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress data-testid="staff-board-sidebar-loading" size={20} />
                </Box>
            )}
            {!showLoading && (
                <List dense disablePadding data-testid="staff-board-sidebar-list">
                    {owners.map((owner, index) => (
                        <React.Fragment key={owner.id}>
                            {renderRow(owner, index === 0)}
                            {index === 0 && owners.length > 1 && <Divider sx={{ my: 0.75 }} />}
                        </React.Fragment>
                    ))}
                </List>
            )}
        </Box>
    );
}
