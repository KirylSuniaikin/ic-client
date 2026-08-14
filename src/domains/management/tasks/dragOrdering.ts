import type { TaskCard, TaskCardStatus } from "./types";

export class TaskCardNotFoundError extends Error {
    readonly cardId: number;

    constructor(cardId: number) {
        super(`Task card ${cardId} not found`);
        this.name = "TaskCardNotFoundError";
        this.cardId = cardId;
    }
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function reassignPositions(column: TaskCard[]): TaskCard[] {
    return column.map((card, index) => ({ ...card, position: index }));
}

// Returns a NEW array representing the full board after moving `cardId` to
// `targetStatus` at `targetIndex`. Cards outside the affected column(s) are
// returned as the SAME object references (identity-preserving, per the
// project's existing identity-preserving state-update convention).
export function computeReorder(
    cards: TaskCard[],
    cardId: number,
    targetStatus: TaskCardStatus,
    targetIndex: number
): TaskCard[] {
    const movedCard = cards.find(card => card.id === cardId);
    if (!movedCard) {
        throw new TaskCardNotFoundError(cardId);
    }

    const sourceStatus = movedCard.status;
    const others = cards.filter(card => card.status !== sourceStatus && card.status !== targetStatus);

    if (sourceStatus === targetStatus) {
        const column = cards.filter(card => card.status === sourceStatus);
        const withoutMoved = column.filter(card => card.id !== cardId);
        const clampedIndex = clamp(targetIndex, 0, withoutMoved.length);
        const reinserted = [
            ...withoutMoved.slice(0, clampedIndex),
            movedCard,
            ...withoutMoved.slice(clampedIndex),
        ];
        const updatedColumn = reassignPositions(reinserted);
        return [...others, ...updatedColumn];
    }

    const sourceColumn = cards.filter(card => card.status === sourceStatus && card.id !== cardId);
    const updatedSourceColumn = reassignPositions(sourceColumn);

    const targetColumn = cards.filter(card => card.status === targetStatus);
    const clampedIndex = clamp(targetIndex, 0, targetColumn.length);
    const movedIntoTarget: TaskCard = { ...movedCard, status: targetStatus };
    const targetWithInsertion = [
        ...targetColumn.slice(0, clampedIndex),
        movedIntoTarget,
        ...targetColumn.slice(clampedIndex),
    ];
    const updatedTargetColumn = reassignPositions(targetWithInsertion);

    return [...others, ...updatedSourceColumn, ...updatedTargetColumn];
}

// Pure geometry: given already-measured rectangles and a pointer point, decide
// which column/index a drop lands on. No DOM reads happen inside this function.
export type Rect = { top: number; bottom: number; left: number; right: number };

export type ColumnGeometry = {
    status: TaskCardStatus;
    rect: Rect;
    cardRects: { id: number; rect: Rect }[]; // in current top-to-bottom visual order
};

export type DropTarget = { status: TaskCardStatus; index: number };

function pointInRect(point: { x: number; y: number }, rect: Rect): boolean {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

export function resolveDropTarget(
    columns: ColumnGeometry[],
    point: { x: number; y: number },
    excludeCardId: number | null
): DropTarget | null {
    const column = columns.find(candidate => pointInRect(point, candidate.rect));
    if (!column) return null;

    const cardRects = column.cardRects.filter(cardRect => cardRect.id !== excludeCardId);
    const index = cardRects.reduce((count, cardRect) => {
        const midpoint = (cardRect.rect.top + cardRect.rect.bottom) / 2;
        return midpoint < point.y ? count + 1 : count;
    }, 0);

    return { status: column.status, index };
}
