import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import PizzaLoader from "../../../order-status/components/animations/PizzaLoader";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import TaskColumn from "./TaskColumn";
import TaskCardDrawer from "./TaskCardDrawer";
import type { TaskCardDrawerMode, TaskCardFormValues } from "./TaskCardDrawer";
import DeleteTaskCardDialog from "./DeleteTaskCardDialog";
import { useTaskBoard } from "../hooks/useTaskBoard";
import { useCardDrag } from "../hooks/useCardDrag";
import { TASK_CARD_STATUSES } from "../types";
import type { TaskCard, TaskCardPriority, TaskCardStatus } from "../types";

export interface TaskBoardPanelProps {
    ownerId?: number | null; // seam for ST6; omitted/null = caller's own board
}

export default function TaskBoardPanel({ ownerId }: TaskBoardPanelProps = {}): JSX.Element {
    const board = useTaskBoard(ownerId);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState<TaskCardDrawerMode>("view");
    const [activeCard, setActiveCard] = useState<TaskCard | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [priorityMutatingId, setPriorityMutatingId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    if (board.loading) return <PizzaLoader />;

    const handleCardClick = (card: TaskCard): void => {
        setActiveCard(card);
        setDrawerMode("view");
        setDrawerOpen(true);
    };

    const handleAddClick = (): void => {
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

    const handleCreate = async (values: TaskCardFormValues): Promise<void> => {
        const trimmedDescription = values.description.trim();
        const ok = await board.createCard({
            title: values.title,
            description: trimmedDescription.length > 0 ? trimmedDescription : null,
            priority: values.priority,
            assigneeId: ownerId ?? undefined,
        });
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
        });
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
        <Box sx={{ display: "flex", gap: 2, p: 2, width: "100%", boxSizing: "border-box", alignItems: "flex-start" }}>
            {TASK_CARD_STATUSES.map(status => (
                <TaskColumn
                    key={status}
                    status={status}
                    cards={board.cardsByStatus[status]}
                    onCardClick={handleCardClick}
                    onChangePriority={(cardId, priority): void => {
                        void handleChangePriority(cardId, priority);
                    }}
                    onAddClick={status === "BACKLOG" ? handleAddClick : undefined}
                    mutatingCardId={priorityMutatingId}
                    getDragHandlers={getDragHandlers}
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
