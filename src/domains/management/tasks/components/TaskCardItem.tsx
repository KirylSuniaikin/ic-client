import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import TaskCardMenu from "./TaskCardMenu";
import type { CardDragHandlers } from "../hooks/useCardDrag";
import type { TaskCard, TaskCardPriority } from "../types";
import { TASK_CARD_PRIORITY_COLORS } from "../types";

export interface TaskCardItemProps {
    card: TaskCard;
    onClick: (card: TaskCard) => void;
    onChangePriority: (cardId: number, priority: TaskCardPriority) => void;
    disabled?: boolean;
    getDragHandlers?: (card: TaskCard, onCardClick: (card: TaskCard) => void) => CardDragHandlers;
}

const CLAMP_TWO_LINES = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
} as const;

export default function TaskCardItem({
    card,
    onClick,
    onChangePriority,
    disabled,
    getDragHandlers,
}: TaskCardItemProps): JSX.Element {
    const hasDescription = card.description !== null && card.description.trim().length > 0;
    const dragHandlers = getDragHandlers?.(card, onClick);

    return (
        <Card
            data-testid={`task-card-${card.id}`}
            data-card-id={card.id}
            onClick={dragHandlers ? dragHandlers.onClick : (): void => onClick(card)}
            onPointerDown={dragHandlers?.onPointerDown}
            onPointerMove={dragHandlers?.onPointerMove}
            onPointerUp={dragHandlers?.onPointerUp}
            onPointerCancel={dragHandlers?.onPointerCancel}
            style={dragHandlers?.style}
            sx={{
                position: "relative",
                mb: 1.5,
                p: 1.5,
                pr: 5,
                cursor: "pointer",
                borderRadius: 2,
                border: `2px solid ${TASK_CARD_PRIORITY_COLORS[card.priority]}`,
            }}
        >
            <Box sx={{ position: "absolute", top: 4, right: 4 }}>
                <TaskCardMenu cardId={card.id} priority={card.priority} disabled={disabled} onSelect={(priority): void => onChangePriority(card.id, priority)} />
            </Box>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Typography variant="subtitle2" fontWeight={600} sx={CLAMP_TWO_LINES}>
                    {card.title}
                </Typography>
                {hasDescription && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ...CLAMP_TWO_LINES }}>
                        {card.description}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
