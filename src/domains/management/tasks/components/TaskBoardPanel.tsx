import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { LoadingIndicator } from "../../../../shared/components/LoadingIndicator";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import TaskColumn from "./TaskColumn";
import TaskCardDrawer from "./TaskCardDrawer";
import type { TaskCardDrawerMode, TaskCardFormValues } from "./TaskCardDrawer";
import DeleteTaskCardDialog from "./DeleteTaskCardDialog";
import { useTaskBoard } from "../hooks/useTaskBoard";
import { useCardDrag } from "../hooks/useCardDrag";
import { TASK_CARD_STATUSES } from "../types";
import type { TaskCard, TaskCardPriority, TaskCardStatus } from "../types";
import { todayIsoBahrain } from "../../../../shared/utils/timeUtils";

// A board left open on a tablet across midnight must repaint overdue cards without waiting for
// the next mutation-triggered refetch.
const TODAY_REFRESH_INTERVAL_MS = 60_000;

export interface TaskBoardPanelProps {
    ownerId?: number | null; // seam for ST6; omitted/null = caller's own board
    /**
     * Reports how many unfinished cards this board holds, so the sidebar badge tracks edits
     * instead of showing whatever the count was when the page loaded. Derived from cards already
     * in hand — it costs no request, and it cannot disagree with what is on screen.
     */
    onOpenCardCountChange?: (ownerId: number | null, openCardCount: number) => void;
}

export default function TaskBoardPanel({ ownerId, onOpenCardCountChange }: TaskBoardPanelProps = {}): JSX.Element {
    const board = useTaskBoard(ownerId);

    const openCardCount = board.cards.filter(card => card.status !== "DONE").length;
    useEffect(() => {
        // Not while the board is still loading: `cards` is empty then, and reporting 0 would blank
        // the badge on every board switch before the real number arrives.
        if (board.loading) return;
        onOpenCardCountChange?.(ownerId ?? null, openCardCount);
    }, [board.loading, openCardCount, ownerId, onOpenCardCountChange]);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState<TaskCardDrawerMode>("view");
    const [activeCard, setActiveCard] = useState<TaskCard | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // Which column the "+" was pressed in, so the new card lands there rather than always in Backlog.
    const [createStatus, setCreateStatus] = useState<TaskCardStatus>("BACKLOG");
    const [priorityMutatingId, setPriorityMutatingId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [today, setToday] = useState<string>(() => todayIsoBahrain());

    useEffect(() => {
        const interval = setInterval(() => setToday(todayIsoBahrain()), TODAY_REFRESH_INTERVAL_MS);
        return (): void => clearInterval(interval);
    }, []);

    // Mirror the hook's error into local snackbar state — the hook only clears `error` at the
    // start of the NEXT mutation, so the snackbar's own dismiss must be tracked separately.
    useEffect(() => {
        if (board.error) setErrorMessage(board.error);
    }, [board.error]);

    const handleMoveCard = async (cardId: number, targetStatus: TaskCardStatus, targetIndex: number): Promise<void> => {
        await board.moveCard(cardId, targetStatus, targetIndex);
    };

    const { getDragHandlers } = useCardDrag({
        onDrop: ({ cardId, targetStatus, targetIndex }): void => {
            void handleMoveCard(cardId, targetStatus, targetIndex);
        },
    });

    if (board.loading) return <LoadingIndicator />;

    const handleCardClick = (card: TaskCard): void => {
        setActiveCard(card);
        setDrawerMode("view");
        setDrawerOpen(true);
    };

    const handleAddClick = (status: TaskCardStatus): void => {
        setCreateStatus(status);
        setActiveCard(null);
        setDrawerMode("create");
        setDrawerOpen(true);
    };

    const handleDrawerClose = (): void => {
        setDrawerOpen(false);
    };

    const handleRequestEdit = (): void => {
        setDrawerMode("edit");
    };

    const handleRequestDelete = (): void => {
        setDeleteDialogOpen(true);
    };

    // Delete straight from a card's three-dots menu, without opening the detail popup first.
    const handleRequestDeleteFromCard = (card: TaskCard): void => {
        setActiveCard(card);
        setDeleteDialogOpen(true);
    };

    const handleCreate = async (values: TaskCardFormValues): Promise<void> => {
        const trimmedDescription = values.description.trim();
        const ok = await board.createCard({
            title: values.title,
            description: trimmedDescription.length > 0 ? trimmedDescription : null,
            priority: values.priority,
            status: createStatus,
            assigneeId: ownerId ?? undefined,
            deadline: values.deadline,
        }, values.pendingImage);
        if (ok) {
            setDrawerOpen(false);
            setActiveCard(null);
        }
    };

    const handleEdit = async (cardId: number, values: TaskCardFormValues): Promise<void> => {
        const trimmedDescription = values.description.trim();
        const ok = await board.editCard(cardId, {
            title: values.title,
            description: trimmedDescription.length > 0 ? trimmedDescription : null,
            priority: values.priority,
            // EditTaskCardRequest is a full replace on the backend — a null deadline in the
            // request clears the stored one, so the current value must always be echoed back.
            deadline: values.deadline,
        }, { pendingImage: values.pendingImage, removeImage: values.removeImage });
        if (ok) {
            setDrawerOpen(false);
            setActiveCard(null);
        }
    };

    const handleChangePriority = async (cardId: number, priority: TaskCardPriority): Promise<void> => {
        setPriorityMutatingId(cardId);
        await board.changePriority(cardId, priority);
        setPriorityMutatingId(null);
    };

    const handleConfirmDelete = async (): Promise<void> => {
        if (!activeCard) return;
        const ok = await board.deleteCard(activeCard.id);
        if (ok) {
            setDeleteDialogOpen(false);
            setDrawerOpen(false);
            setActiveCard(null);
        }
    };

    const handleCancelDelete = (): void => {
        setDeleteDialogOpen(false);
    };

    return (
        <Box
            data-board-scroller
            data-testid="task-board-scroller"
            sx={{
                display: "flex",
                gap: 1.5,
                p: { xs: 1.5, sm: 2 },
                width: "100%",
                boxSizing: "border-box",
                alignItems: "flex-start",
                // Matches the order desk's page treatment so switching tabs doesn't change the canvas.
                backgroundColor: "#fbfaf6",
                minHeight: "100vh",
                // Three columns cannot fit a phone, so the board scrolls sideways and snaps one
                // column at a time. Vertical scrolling is left to the page — nesting a second
                // scroll axis here is what made the board feel stuck on touch.
                overflowX: "auto",
                overflowY: "visible",
                scrollSnapType: { xs: "x proximity", sm: "none" },
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "thin",
                "&::-webkit-scrollbar": { height: 8 },
                "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(15,23,42,0.18)", borderRadius: 4 },
            }}
        >
            {TASK_CARD_STATUSES.map(status => (
                <TaskColumn
                    key={status}
                    status={status}
                    cards={board.cardsByStatus[status]}
                    onCardClick={handleCardClick}
                    onChangePriority={(cardId, priority): void => {
                        void handleChangePriority(cardId, priority);
                    }}
                    onRequestDelete={handleRequestDeleteFromCard}
                    onAddClick={(): void => handleAddClick(status)}
                    mutatingCardId={priorityMutatingId}
                    getDragHandlers={getDragHandlers}
                    today={today}
                />
            ))}
            <TaskCardDrawer
                open={drawerOpen}
                mode={drawerMode}
                card={activeCard}
                submitting={board.mutating}
                onClose={handleDrawerClose}
                onRequestEdit={handleRequestEdit}
                onRequestDelete={handleRequestDelete}
                onCreate={(values): void => {
                    void handleCreate(values);
                }}
                onEdit={(cardId, values): void => {
                    void handleEdit(cardId, values);
                }}
            />
            <DeleteTaskCardDialog
                open={deleteDialogOpen}
                card={activeCard}
                submitting={board.mutating}
                onConfirm={(): void => {
                    void handleConfirmDelete();
                }}
                onCancel={handleCancelDelete}
            />
            <ErrorSnackbar
                open={errorMessage !== null}
                message={errorMessage ?? ""}
                severity="error"
                handleClose={(): void => setErrorMessage(null)}
            />
        </Box>
    );
}
