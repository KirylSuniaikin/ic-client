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
    onRequestDelete?: (card: TaskCard) => void;
    onAddClick?: () => void; // every column gets one; adds a card to that column
    mutatingCardId?: number | null; // disables that one card's menu while its own mutation is in flight
    getDragHandlers?: TaskCardItemProps["getDragHandlers"];
}

export default function TaskColumn({
    status,
    cards,
    onCardClick,
    onChangePriority,
    onRequestDelete,
    onAddClick,
    mutatingCardId,
    getDragHandlers,
}: TaskColumnProps): JSX.Element {
    return (
        <Box
            data-testid={`task-column-${status}`}
            data-column-status={status}
            sx={{
                // One column fills a phone screen (with a sliver of the next as a swipe affordance),
                // then they share the row from tablet up.
                flex: { xs: "0 0 auto", sm: 1 },
                width: { xs: "86vw", sm: "auto" },
                minWidth: { sm: 260 },
                maxWidth: { sm: 420 },
                scrollSnapAlign: "start",
                alignSelf: "flex-start",
                minHeight: 140, // an empty column must stay a big enough drop target
                // Warm grey, not the usual cool Trello grey — it has to sit on the admin's cream page.
                backgroundColor: "#f0eee9",
                borderRadius: "14px",
                p: 1,
            }}
        >
            {/* Fixed height, not padding: the header must sit on the same baseline in all three
                columns whether or not its add button renders. */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.75, height: 36, mb: 0.5 }}>
                <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}
                >
                    {TASK_CARD_STATUS_LABELS[status]}
                </Typography>
                <Box
                    data-testid={`task-column-count-${status}`}
                    sx={{
                        minWidth: 20,
                        height: 20,
                        px: 0.75,
                        borderRadius: "10px",
                        backgroundColor: "rgba(15,23,42,0.08)",
                        color: "text.secondary",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {cards.length}
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                {onAddClick && (
                    <IconButton
                        data-testid={`task-board-add-button-${status}`}
                        size="small"
                        onClick={onAddClick}
                        aria-label={`Add task to ${TASK_CARD_STATUS_LABELS[status]}`}
                        sx={{ color: "text.secondary", "&:hover": { backgroundColor: "rgba(15,23,42,0.06)" } }}
                    >
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
                    onRequestDelete={onRequestDelete}
                    disabled={mutatingCardId === card.id}
                    getDragHandlers={getDragHandlers}
                />
            ))}
        </Box>
    );
}
