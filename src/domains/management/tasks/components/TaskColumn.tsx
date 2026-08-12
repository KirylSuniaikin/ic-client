import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import TaskCardItem from "./TaskCardItem";
import type { TaskCardItemProps } from "./TaskCardItem";
import type { TaskCard, TaskCardPriority, TaskCardStatus } from "../types";
import { TASK_CARD_STATUS_LABELS } from "../types";

export interface TaskColumnProps {
    status: TaskCardStatus;
    cards: TaskCard[];
    onCardClick: (card: TaskCard) => void;
    onChangePriority: (cardId: number, priority: TaskCardPriority) => void;
    onAddClick?: () => void; // passed only for the BACKLOG column
    mutatingCardId?: number | null; // disables that one card's menu while its own mutation is in flight
    getDragHandlers?: TaskCardItemProps["getDragHandlers"];
}

export default function TaskColumn({
    status,
    cards,
    onCardClick,
    onChangePriority,
    onAddClick,
    mutatingCardId,
    getDragHandlers,
}: TaskColumnProps): JSX.Element {
    return (
        <Box
            data-testid={`task-column-${status}`}
            data-column-status={status}
            sx={{
                flex: 1,
                minWidth: 280,
                backgroundColor: "#fbfaf6",
                borderRadius: 2,
                p: 1.5,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                    {TASK_CARD_STATUS_LABELS[status]}
                </Typography>
                {onAddClick && (
                    <IconButton data-testid="task-board-add-button" size="small" onClick={onAddClick} aria-label="Add Task">
                        <AddIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>
            {cards.map(card => (
                <TaskCardItem
                    key={card.id}
                    card={card}
                    onClick={onCardClick}
                    onChangePriority={onChangePriority}
                    disabled={mutatingCardId === card.id}
                    getDragHandlers={getDragHandlers}
                />
            ))}
        </Box>
    );
}
