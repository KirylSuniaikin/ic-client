import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import { StaffRoles } from "../../../auth/types";
import { useBoardOwners } from "../hooks/useBoardOwners";
import StaffBoardSidebar from "./StaffBoardSidebar";
import TaskBoardPanel from "./TaskBoardPanel";

export interface TaskBoardScreenProps {
    role: StaffRoles | null;
}

// Composes the SUPER_MANAGER-only sidebar with the existing TaskBoardPanel (ST4). Does not
// touch TaskBoardPanel/TaskColumn/TaskCardItem/etc — those are ST5's territory next.
export default function TaskBoardScreen({ role }: TaskBoardScreenProps): JSX.Element {
    const isSuperManager = role === StaffRoles.SUPER_MANAGER;
    // Called unconditionally (Rules of Hooks) and no-ops internally when disabled.
    const { owners, loading, error } = useBoardOwners(isSuperManager);

    const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Display default only: owners[0] is always the caller (server-pinned), so this is
    // functionally identical to leaving selectedOwnerId unset.
    useEffect(() => {
        if (owners.length > 0 && selectedOwnerId === null) {
            setSelectedOwnerId(owners[0].id);
        }
    }, [owners, selectedOwnerId]);

    // Mirror the hook's error into local snackbar state, same pattern as TaskBoardPanel.tsx.
    useEffect(() => {
        if (error) setErrorMessage(error);
    }, [error]);

    if (!isSuperManager) {
        return <TaskBoardPanel />;
    }

    return (
        <Box sx={{ display: "flex", width: "100%", alignItems: "flex-start", backgroundColor: "#fbfaf6", minHeight: "100vh" }}>
            <StaffBoardSidebar
                owners={owners}
                loading={loading}
                selectedOwnerId={selectedOwnerId}
                open={sidebarOpen}
                onToggle={(): void => setSidebarOpen(prev => !prev)}
                onSelect={(ownerId): void => setSelectedOwnerId(ownerId)}
            />
            {/* minWidth:0 is what lets the board's horizontal scroller actually shrink and scroll —
                a flex item defaults to min-width:auto and would instead push the page wider. */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <TaskBoardPanel ownerId={selectedOwnerId ?? undefined} />
            </Box>
            <ErrorSnackbar
                open={errorMessage !== null}
                message={errorMessage ?? ""}
                severity="error"
                handleClose={(): void => setErrorMessage(null)}
            />
        </Box>
    );
}
