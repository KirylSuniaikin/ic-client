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
    onRequestDelete?: (card: TaskCard) => void;
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
    onRequestDelete,
    disabled,
    getDragHandlers,
}: TaskCardItemProps): JSX.Element {
    const hasDescription = card.description !== null && card.description.trim().length > 0;
    const dragHandlers = getDragHandlers?.(card, onClick);
    const isDragging = dragHandlers?.isDragging ?? false;

    return (
        <Card
            elevation={0}
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
                mb: 1,
                py: 1.25,
                pl: 1.75,
                pr: 4.5,
                cursor: "pointer",
                borderRadius: "12px",
                backgroundColor: "#fff",
                // Priority reads as a thick left edge rather than a full outline: it stays legible
                // at a glance down a column without boxing every card in a coloured frame.
                borderLeft: `5px solid ${TASK_CARD_PRIORITY_COLORS[card.priority]}`,
                boxShadow: isDragging
                    ? "0 12px 28px rgba(15,23,42,0.20)"
                    : "0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.10)",
                transition: "box-shadow 140ms ease, transform 140ms ease",
                // iOS Safari pops a text-selection callout on a long press, which would fight the
                // long-press-to-lift gesture; the board has no selectable content worth keeping.
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                "&:hover": { boxShadow: "0 2px 6px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.08)" },
            }}
        >
            <Box sx={{ position: "absolute", top: 2, right: 2 }}>
                <TaskCardMenu
                    cardId={card.id}
                    priority={card.priority}
                    disabled={disabled}
                    onSelect={(priority): void => onChangePriority(card.id, priority)}
                    onDelete={onRequestDelete ? (): void => onRequestDelete(card) : undefined}
                />
            </Box>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.35, ...CLAMP_TWO_LINES }}>
                    {card.title}
                </Typography>
                {hasDescription && (
                    <Typography
                        data-testid={`task-card-description-${card.id}`}
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "-webkit-box", mt: 0.5, lineHeight: 1.4, ...CLAMP_TWO_LINES }}
                    >
                        {card.description}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
