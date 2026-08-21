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
    deleteTaskCardImage,
    editTaskCard,
    fetchTaskBoard,
    moveTaskCard,
    uploadTaskCardImage,
} from "../../../../shared/api/management";
import type { PhotoPatch } from "../../../../shared/components/EntityPhotoField";
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

// A card's photo is a second request: a brand-new card has no id until POST /tasks returns, and
// EditTaskCardRequest carries no image field at all. Both photo steps below are wrapped in their
// own try/catch — the same rule PurchaseTablePopup.syncInvoiceImages and
// AccountingReportPopup.syncEntryImages follow: a failed photo must never present itself as a
// failed save, so it is logged and surfaced through the existing `error` snackbar channel without
// flipping the returned success flag to false.
const NO_PHOTO_PATCH: PhotoPatch = { pendingImage: null, removeImage: false };

export interface UseTaskBoardResult {
    cards: TaskCard[];
    cardsByStatus: Record<TaskCardStatus, TaskCard[]>;
    loading: boolean;
    error: string | null;
    mutating: boolean;
    refetch: () => Promise<void>;
    createCard: (input: CreateTaskCardPayload, pendingImage?: Blob | null) => Promise<boolean>;
    editCard: (id: number, input: EditTaskCardPayload, photo?: PhotoPatch) => Promise<boolean>;
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

    const createCard = async (input: CreateTaskCardPayload, pendingImage: Blob | null = null): Promise<boolean> => {
        setMutating(true);
        setError(null);
        try {
            const created = await createTaskCard(input);
            if (pendingImage) {
                try {
                    await uploadTaskCardImage(created.id, pendingImage);
                } catch (err) {
                    logger.error("Failed to upload task card photo:", err);
                    setError("Task saved, but the photo could not be uploaded.");
                }
            }
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

    const editCard = async (id: number, input: EditTaskCardPayload, photo: PhotoPatch = NO_PHOTO_PATCH): Promise<boolean> => {
        setMutating(true);
        setError(null);
        try {
            await editTaskCard(id, input);
            try {
                if (photo.pendingImage) {
                    await uploadTaskCardImage(id, photo.pendingImage);
                } else if (photo.removeImage) {
                    const existing = cards.find(c => c.id === id);
                    if (existing?.hasImage) {
                        await deleteTaskCardImage(id);
                    }
                }
            } catch (err) {
                logger.error("Failed to sync task card photo:", err);
                setError("Task saved, but the photo could not be updated.");
            }
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
