import React, { useState } from "react";
import type { ReactNode } from "react";
import { CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { BRAND_RED } from "../../../../shared/utils/theme";

const hairline = "#efece4";

export type StaffRowAction = {
    key: string;
    label: string;
    icon: ReactNode;
    // Invoked synchronously from the item's click: the Telegram copy needs the user-gesture tick.
    onSelect: () => void;
    testId: string;
    disabled?: boolean;
};

export interface StaffRowActionsMenuProps {
    staffId: number;
    actions: ReadonlyArray<StaffRowAction>;
    busy?: boolean;
}

const triggerSx = {
    border: `1px solid ${hairline}`,
    borderRadius: "10px",
    color: "#6b7079",
    backgroundColor: "#fff",
    "&:hover": { backgroundColor: "#fff5f5", borderColor: BRAND_RED, color: BRAND_RED },
} as const;

export default function StaffRowActionsMenu({ staffId, actions, busy }: StaffRowActionsMenuProps): JSX.Element | null {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    if (actions.length === 0) return null;

    const handleSelect = (action: StaffRowAction): void => {
        if (action.disabled) return;
        action.onSelect();
        setAnchorEl(null);
    };

    return (
        <>
            <IconButton
                size="small"
                aria-label="Staff actions"
                data-testid={`staff-row-menu-${staffId}`}
                onClick={(event: React.MouseEvent<HTMLElement>): void => setAnchorEl(event.currentTarget)}
                sx={triggerSx}
            >
                {busy ? <CircularProgress size={14} /> : <MoreVertIcon fontSize="small" />}
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={anchorEl !== null}
                onClose={(): void => setAnchorEl(null)}
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
                {actions.map(action => (
                    <MenuItem
                        key={action.key}
                        data-testid={action.testId}
                        disabled={action.disabled}
                        onClick={(): void => handleSelect(action)}
                    >
                        <ListItemIcon>{action.icon}</ListItemIcon>
                        <ListItemText>{action.label}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
