import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TaskCardMenu from "./TaskCardMenu";
import { TaskCardImageThumb } from "./TaskCardImageThumb";
import type { CardDragHandlers } from "../hooks/useCardDrag";
import type { TaskCard, TaskCardPriority } from "../types";
import { TASK_CARD_OVERDUE_BG, TASK_CARD_OVERDUE_TEXT, TASK_CARD_PRIORITY_COLORS } from "../types";

export interface TaskCardItemProps {
    card: TaskCard;
    onClick: (card: TaskCard) => void;
    onChangePriority: (cardId: number, priority: TaskCardPriority) => void;
    onRequestDelete?: (card: TaskCard) => void;
    disabled?: boolean;
    getDragHandlers?: (card: TaskCard, onCardClick: (card: TaskCard) => void) => CardDragHandlers;
    today: string; // ISO Bahrain date (YYYY-MM-DD), threaded from TaskBoardPanel via TaskColumn
}

function formatDeadline(deadlineIso: string): string {
    const [year, month, day] = deadlineIso.split("-");
    return `${day}.${month}.${year}`;
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
    today,
}: TaskCardItemProps): JSX.Element {
    const hasDescription = card.description !== null && card.description.trim().length > 0;
    const dragHandlers = getDragHandlers?.(card, onClick);
    const isDragging = dragHandlers?.isDragging ?? false;
    const isOverdue = card.deadline !== null && card.deadline < today;
    // With neither a deadline nor a photo the header row has nothing to carry, and a bare strip
    // above the title is pure wasted height on a dense column. The title takes that row instead.
    const isCompact = card.deadline === null && !card.hasImage;

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
                px: 1.75,
                cursor: "pointer",
                borderRadius: "12px",
                backgroundColor: isOverdue ? TASK_CARD_OVERDUE_BG : "#fff",
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
            {/* Fixed height so the menu stays put whether or not this card has a deadline. */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, minHeight: 28 }}>
                {/* Always present, even when empty, so the menu stays pinned right. */}
                <Box sx={{ minWidth: 0 }}>
                    {isCompact && (
                        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.35, ...CLAMP_TWO_LINES }}>
                            {card.title}
                        </Typography>
                    )}
                    {!isCompact && card.deadline !== null && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <AccessTimeIcon sx={{ fontSize: 14, color: isOverdue ? TASK_CARD_OVERDUE_TEXT : "text.secondary" }} />
                            <Typography
                                data-testid={`task-card-deadline-${card.id}`}
                                variant="caption"
                                sx={{ fontWeight: 600, color: isOverdue ? TASK_CARD_OVERDUE_TEXT : "text.secondary" }}
                            >
                                {formatDeadline(card.deadline)}
                            </Typography>
                        </Box>
                    )}
                </Box>
                {/* Pulled back over the card's padding so the glyph reads as flush with the photo
                    and title below it. An IconButton's own padding otherwise insets the dots well
                    short of the content edge, which looks like a misalignment rather than a
                    hit-target. Same -1 offset the drawer's close buttons use. */}
                <Box sx={{ display: "flex", mr: -1 }}>
                    <TaskCardMenu
                        cardId={card.id}
                        priority={card.priority}
                        disabled={disabled}
                        onSelect={(priority): void => onChangePriority(card.id, priority)}
                        onDelete={onRequestDelete ? (): void => onRequestDelete(card) : undefined}
                    />
                </Box>
            </Box>
            {card.hasImage && (
                <Box sx={{ mb: 1 }}>
                    <TaskCardImageThumb taskCardId={card.id} />
                </Box>
            )}
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                {!isCompact && (
                    <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.35, ...CLAMP_TWO_LINES }}>
                        {card.title}
                    </Typography>
                )}
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
