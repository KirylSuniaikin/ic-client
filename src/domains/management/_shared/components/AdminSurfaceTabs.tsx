import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { StaffRoles, hasCityAccess } from '../../../auth/types';
import type { AdminTabKey } from '../hooks/useAdminUIState';

export interface AdminSurfaceTabsProps {
    role: StaffRoles | null;
    activeTab: AdminTabKey;
    onChange: (tab: AdminTabKey) => void;
}

export default function AdminSurfaceTabs({ role, activeTab, onChange }: AdminSurfaceTabsProps): JSX.Element | null {
    if (role !== StaffRoles.MANAGER && !hasCityAccess(role)) return null;

    return (
        // Without an explicit background this strip renders white against the admin's cream page
        // and reads as a stray white band above the board.
        <Box data-testid="admin-surface-tabs" sx={{ px: 1, pt: 2, pb: 1, backgroundColor: '#fbfaf6' }}>
            <ToggleButtonGroup
                exclusive
                value={activeTab}
                onChange={(_, v: AdminTabKey | null) => v && onChange(v)}
                size="small"
                sx={{
                    columnGap: 1,
                    '& .MuiToggleButtonGroup-grouped': {
                        border: '1px solid #e0e0e0',
                        borderRadius: 999,
                        margin: 0,
                        '&:not(:first-of-type)': {
                            marginLeft: 0,
                            borderLeft: '1px solid #e0e0e0',
                        },
                    },
                    '& .MuiToggleButton-root': {
                        textTransform: 'none',
                        px: 2,
                        backgroundColor: '#fff',
                        '&:hover': { backgroundColor: '#f4f2ed' },
                    },
                    '& .MuiToggleButton-root.Mui-selected': {
                        backgroundColor: '#E44B4C',
                        color: '#fff',
                        borderColor: '#E44B4C',
                        '&:hover': { backgroundColor: '#d23c3d', borderColor: '#d23c3d' },
                    },
                }}
            >
                <ToggleButton value="orders" data-testid="admin-tab-orders">Order Desk</ToggleButton>
                <ToggleButton value="board" data-testid="admin-tab-board">Task Board</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
}
