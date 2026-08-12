// Assumed: an unknown cardId passed to moveCard (e.g. a card deleted by a concurrent mutation
// mid-drag) is treated as a harmless no-op rather than surfacing an error — the spec's edge-case
// table has no entry for this, and the drag hook only ever passes an id it just read off a
// currently-rendered card.
import { useEffect, useMemo, useState } from "react";
import { logger } from "../../../../shared/utils/logger";
import {
    changeTaskCardPriority,
    createTaskCard,
    deleteTaskCard,
    editTaskCard,
    fetchTaskBoard,
    moveTaskCard,
} from "../../../../shared/api/management";
import { computeReorder } from "../dragOrdering";
import type {
    ChangeTaskCardPriorityPayload,
    CreateTaskCardPayload,
    EditTaskCardPayload,
    MoveTaskCardPayload,
    TaskCard,
    TaskCardPriority,
    TaskCardStatus,
} from "../types";

export interface UseTaskBoardResult {
    cards: TaskCard[];
    cardsByStatus: Record<TaskCardStatus, TaskCard[]>;
    loading: boolean;
    error: string | null;
    mutating: boolean;
    refetch: () => Promise<void>;
    createCard: (input: CreateTaskCardPayload) => Promise<boolean>;
    editCard: (id: number, input: EditTaskCardPayload) => Promise<boolean>;
    changePriority: (id: number, priority: TaskCardPriority) => Promise<boolean>;
    deleteCard: (id: number) => Promise<boolean>;
    moveCard: (cardId: number, targetStatus: TaskCardStatus, targetIndex: number) => Promise<boolean>;
}

function emptyBucket(): Record<TaskCardStatus, TaskCard[]> {
    return { BACKLOG: [], DOING: [], DONE: [] };
}

export function useTaskBoard(ownerId?: number | null): UseTaskBoardResult {
    const [cards, setCards] = useState<TaskCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mutating, setMutating] = useState(false);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError(null);

        void (async (): Promise<void> => {
            try {
                const response = await fetchTaskBoard(ownerId ?? undefined);
                if (!cancelled) {
                    setCards(response);
                }
            } catch (err) {
                if (!cancelled) {
                    logger.error("Failed to load task board:", err);
                    setError(err instanceof Error ? err.message : "Failed to load task board");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [ownerId]);

    const cardsByStatus = useMemo(() => {
        const buckets = emptyBucket();
        for (const card of cards) {
            buckets[card.status].push(card);
        }
        return buckets;
    }, [cards]);

    const refetch = async (): Promise<void> => {
        try {
            const response = await fetchTaskBoard(ownerId ?? undefined);
            setCards(response);
        } catch (err) {
            logger.error("Failed to refetch task board:", err);
            setError(err instanceof Error ? err.message : "Failed to refetch task board");
        }
    };

    const createCard = async (input: CreateTaskCardPayload): Promise<boolean> => {
        setMutating(true);
        setError(null);
        try {
            await createTaskCard(input);
            await refetch();
            return true;
        } catch (err) {
            logger.error("Failed to create task card:", err);
            setError(err instanceof Error ? err.message : "Failed to create task card");
            return false;
        } finally {
            setMutating(false);
        }
    };

    const editCard = async (id: number, input: EditTaskCardPayload): Promise<boolean> => {
        setMutating(true);
        setError(null);
        try {
            await editTaskCard(id, input);
            await refetch();
            return true;
        } catch (err) {
            logger.error("Failed to edit task card:", err);
            setError(err instanceof Error ? err.message : "Failed to edit task card");
            return false;
        } finally {
            setMutating(false);
        }
    };

    const changePriority = async (id: number, priority: TaskCardPriority): Promise<boolean> => {
        setMutating(true);
        setError(null);
        const payload: ChangeTaskCardPriorityPayload = { priority };
        try {
            await changeTaskCardPriority(id, payload);
            await refetch();
            return true;
        } catch (err) {
            logger.error("Failed to change task card priority:", err);
            setError(err instanceof Error ? err.message : "Failed to change task card priority");
            return false;
        } finally {
            setMutating(false);
        }
    };

    const moveCard = async (cardId: number, targetStatus: TaskCardStatus, targetIndex: number): Promise<boolean> => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return true; // nothing to move — treat as a no-op rather than throwing here

        const currentColumn = cards.filter(c => c.status === card.status);
        const currentIndex = currentColumn.findIndex(c => c.id === cardId);
        if (targetStatus === card.status && targetIndex === currentIndex) {
            return true; // dropping back into the exact original slot is a no-op (req 8)
        }

        const previousCards = cards;
        const optimisticCards = computeReorder(cards, cardId, targetStatus, targetIndex);
        setCards(optimisticCards);

        setMutating(true);
        setError(null);
        const payload: MoveTaskCardPayload = { targetStatus, targetIndex };
        try {
            await moveTaskCard(cardId, payload);
            await refetch();
            return true;
        } catch (err) {
            setCards(previousCards);
            logger.error("Failed to move task card:", err);
            setError(err instanceof Error ? err.message : "Failed to move task card");
            return false;
        } finally {
            setMutating(false);
        }
    };

    const deleteCard = async (id: number): Promise<boolean> => {
        setMutating(true);
        setError(null);
        try {
            await deleteTaskCard(id);
            await refetch();
            return true;
        } catch (err) {
            logger.error("Failed to delete task card:", err);
            setError(err instanceof Error ? err.message : "Failed to delete task card");
            return false;
        } finally {
            setMutating(false);
        }
    };

    return {
        cards,
        cardsByStatus,
        loading,
        error,
        mutating,
        refetch,
        createCard,
        editCard,
        changePriority,
        deleteCard,
        moveCard,
    };
}
