import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import { shortStaffName, staffDisplayName } from "../../../../shared/utils/staffName";
import { StaffRoles } from "../../../auth/types";
import { useBoardOwners } from "../hooks/useBoardOwners";
import StaffBoardSidebar from "./StaffBoardSidebar";
import TaskBoardPanel from "./TaskBoardPanel";

export interface TaskBoardScreenProps {
    role: StaffRoles | null;
    /**
     * One-shot deep-link target from a Telegram-clicked link (task-spec.md Sub-task D3). Threaded
     * straight through to TaskBoardPanel, which owns opening it once its board has loaded.
     */
    autoOpenCardId?: number;
    /**
     * OWNER-sidebar-only: seeds `selectedOwnerId` so the deep link lands on the assignee's board
     * instead of the caller's own. Irrelevant for a MANAGER/SUPER_MANAGER, whose own board is
     * already what they land on with no owner-selection step -- no special-casing needed for them.
     */
    autoOpenAssigneeId?: number;
    /** Fired once the deep-link target has been handled, so the caller can strip the query params. */
    onAutoOpenHandled?: () => void;
}

// Composes the OWNER-only sidebar with the existing TaskBoardPanel (ST4). Does not
// touch TaskBoardPanel/TaskColumn/TaskCardItem/etc — those are ST5's territory next.
export default function TaskBoardScreen({ role, autoOpenCardId, autoOpenAssigneeId, onAutoOpenHandled }: TaskBoardScreenProps): JSX.Element {
    const isOwner = role === StaffRoles.OWNER;
    // Called unconditionally (Rules of Hooks) and no-ops internally when disabled.
    const { owners, loading, error } = useBoardOwners(isOwner);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    // Lazily seeded from `autoOpenAssigneeId` (rather than seeded later by the effect below) so
    // TaskBoardPanel's very FIRST fetch already targets the deep-linked assignee's board instead
    // of the caller's own -- otherwise TaskBoardPanel's "the id never resolved" detection
    // (review-feedback-D.md Issue 3) could fire off the caller's own board, before this effect
    // ever gets a chance to seed the right owner.
    const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(autoOpenAssigneeId ?? null);
    // Expanded, the sidebar takes ~230px — on a phone that leaves the board barely half the screen.
    // Initial value only: once toggled, the choice is the user's for the rest of the session.
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // Counts for boards opened during this session, keyed by owner. The fetched list is the
    // starting point; whichever board is on screen keeps its own badge honest as cards are added,
    // moved to Done or deleted, without another round trip.
    const [liveCardCounts, setLiveCardCounts] = useState<Record<number, number>>({});

    const handleOpenCardCountChange = useCallback((ownerId: number | null, openCardCount: number): void => {
        if (ownerId === null) return;
        setLiveCardCounts(prev => (prev[ownerId] === openCardCount ? prev : { ...prev, [ownerId]: openCardCount }));
    }, []);

    const ownersWithCounts = useMemo(
        () => owners.map(owner => (
            liveCardCounts[owner.id] === undefined
                ? owner
                : { ...owner, openCardCount: liveCardCounts[owner.id] }
        )),
        [owners, liveCardCounts]
    );

    // Display default only: owners[0] is always the caller (server-pinned), so this is
    // functionally identical to leaving selectedOwnerId unset -- UNLESS a deep link named a
    // specific assignee, in which case that board is what the click was meant to land on.
    useEffect(() => {
        if (owners.length > 0 && selectedOwnerId === null) {
            setSelectedOwnerId(autoOpenAssigneeId ?? owners[0].id);
        }
    }, [owners, selectedOwnerId, autoOpenAssigneeId]);

    const selectedOwnerLabel = ownersWithCounts.find(owner => owner.id === selectedOwnerId);
    const ownerLabel = selectedOwnerLabel ? shortStaffName(staffDisplayName(selectedOwnerLabel)) : undefined;

    // Mirror the hook's error into local snackbar state, same pattern as TaskBoardPanel.tsx.
    useEffect(() => {
        if (error) setErrorMessage(error);
    }, [error]);

    if (!isOwner) {
        return <TaskBoardPanel autoOpenCardId={autoOpenCardId} onAutoOpenHandled={onAutoOpenHandled} />;
    }

    return (
        <Box sx={{ display: "flex", width: "100%", alignItems: "flex-start", backgroundColor: "#fbfaf6", minHeight: "100vh" }}>
            <StaffBoardSidebar
                owners={ownersWithCounts}
                loading={loading}
                selectedOwnerId={selectedOwnerId}
                open={sidebarOpen}
                onToggle={(): void => setSidebarOpen(prev => !prev)}
                onSelect={(ownerId): void => setSelectedOwnerId(ownerId)}
            />
            {/* minWidth:0 is what lets the board's horizontal scroller actually shrink and scroll —
                a flex item defaults to min-width:auto and would instead push the page wider. */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <TaskBoardPanel
                    ownerId={selectedOwnerId ?? undefined}
                    onOpenCardCountChange={handleOpenCardCountChange}
                    ownerLabel={ownerLabel}
                    autoOpenCardId={autoOpenCardId}
                    onAutoOpenHandled={onAutoOpenHandled}
                />
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
