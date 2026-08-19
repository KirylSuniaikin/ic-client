import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
    fetchTaskBoard,
    createTaskCard,
    editTaskCard,
    changeTaskCardPriority,
    deleteTaskCard,
    moveTaskCard,
    uploadTaskCardImage,
    deleteTaskCardImage,
} from "../../../../shared/api/management";
import type { TaskCard } from "../types";
import { useTaskBoard } from "./useTaskBoard";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockFetchTaskBoard = jest.mocked(fetchTaskBoard);
const mockCreateTaskCard = jest.mocked(createTaskCard);
const mockEditTaskCard = jest.mocked(editTaskCard);
const mockChangeTaskCardPriority = jest.mocked(changeTaskCardPriority);
const mockDeleteTaskCard = jest.mocked(deleteTaskCard);
const mockMoveTaskCard = jest.mocked(moveTaskCard);
const mockUploadTaskCardImage = jest.mocked(uploadTaskCardImage);
const mockDeleteTaskCardImage = jest.mocked(deleteTaskCardImage);

function makeCard(overrides: Partial<TaskCard> = {}): TaskCard {
    return {
        id: 1,
        title: "Restock mozzarella",
        description: null,
        priority: "GREEN",
        status: "BACKLOG",
        position: 0,
        assigneeId: 7,
        createdAt: "2026-08-12T10:00:00",
        updatedAt: "2026-08-12T10:00:00",
        deadline: null,
        hasImage: false,
        ...overrides,
    };
}

describe("useTaskBoard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("starts with loading true and cards empty before the fetch resolves", () => {
        mockFetchTaskBoard.mockImplementation(() => new Promise(() => {}));

        const { result } = renderHook(() => useTaskBoard());

        expect(result.current.loading).toBe(true);
        expect(result.current.cards).toEqual([]);
    });

    it("populates cards and cardsByStatus, bucketed by status and order-preserving, on success", async () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG", position: 0 }),
            makeCard({ id: 2, status: "DOING", position: 0 }),
            makeCard({ id: 3, status: "BACKLOG", position: 1 }),
            makeCard({ id: 4, status: "DONE", position: 0 }),
        ];
        mockFetchTaskBoard.mockResolvedValue(cards);

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.cards).toEqual(cards);
        expect(result.current.cardsByStatus.BACKLOG.map(c => c.id)).toEqual([1, 3]);
        expect(result.current.cardsByStatus.DOING.map(c => c.id)).toEqual([2]);
        expect(result.current.cardsByStatus.DONE.map(c => c.id)).toEqual([4]);
    });

    it("refetches with the new assigneeId when ownerId changes", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);

        const { rerender } = renderHook(({ ownerId }: { ownerId?: number | null }) => useTaskBoard(ownerId), {
            initialProps: { ownerId: undefined },
        });

        await waitFor(() => {
            expect(mockFetchTaskBoard).toHaveBeenCalledWith(undefined);
        });

        rerender({ ownerId: 7 });

        await waitFor(() => {
            expect(mockFetchTaskBoard).toHaveBeenCalledWith(7);
        });
    });

    it("sets error and leaves cards empty when fetchTaskBoard rejects", async () => {
        mockFetchTaskBoard.mockRejectedValue(new Error("HTTP 500"));

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("HTTP 500");
        expect(result.current.cards).toEqual([]);
    });

    it("createCard calls createTaskCard, returns true, and triggers a refetch on success", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockCreateTaskCard.mockResolvedValue(makeCard());

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        let created = false;
        await act(async () => {
            created = await result.current.createCard({ title: "New task", description: null, deadline: null });
        });

        expect(mockCreateTaskCard).toHaveBeenCalledWith({ title: "New task", description: null, deadline: null });
        expect(created).toBe(true);
        expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
    });

    it("createCard returns false and sets error without refetching on rejection", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockCreateTaskCard.mockRejectedValue(new Error("HTTP 400"));

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        let created = true;
        await act(async () => {
            created = await result.current.createCard({ title: "New task", description: null, deadline: null });
        });

        expect(created).toBe(false);
        expect(result.current.error).toBe("HTTP 400");
        expect(mockFetchTaskBoard).not.toHaveBeenCalled();
    });

    it("editCard calls editTaskCard with the right id/payload and refetches on success", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockEditTaskCard.mockResolvedValue(makeCard());

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        const payload = { title: "Edited", description: "d", priority: "RED" as const, deadline: null };
        let ok = false;
        await act(async () => {
            ok = await result.current.editCard(5, payload);
        });

        expect(mockEditTaskCard).toHaveBeenCalledWith(5, payload);
        expect(ok).toBe(true);
        expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
    });

    it("editCard returns false and sets error without refetching on rejection", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockEditTaskCard.mockRejectedValue(new Error("HTTP 404"));

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        let ok = true;
        await act(async () => {
            ok = await result.current.editCard(5, { title: "x", description: null, priority: "GREEN", deadline: null });
        });

        expect(ok).toBe(false);
        expect(result.current.error).toBe("HTTP 404");
        expect(mockFetchTaskBoard).not.toHaveBeenCalled();
    });

    describe("photo sync", () => {
        it("createCard uploads the pending photo against the id the create response returned", async () => {
            mockFetchTaskBoard.mockResolvedValue([]);
            mockCreateTaskCard.mockResolvedValue(makeCard({ id: 42 }));
            mockUploadTaskCardImage.mockResolvedValue({ taskCardId: 42, contentType: "image/jpeg", sizeBytes: 10 });

            const { result } = renderHook(() => useTaskBoard());
            await waitFor(() => expect(result.current.loading).toBe(false));
            mockFetchTaskBoard.mockClear();

            const blob = new Blob(["x"], { type: "image/jpeg" });
            let ok = false;
            await act(async () => {
                ok = await result.current.createCard({ title: "New task", description: null, deadline: null }, blob);
            });

            expect(mockUploadTaskCardImage).toHaveBeenCalledWith(42, blob);
            expect(ok).toBe(true);
            expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
        });

        it("a rejected photo upload after createCard does not turn a successful save into a failure", async () => {
            mockFetchTaskBoard.mockResolvedValue([]);
            mockCreateTaskCard.mockResolvedValue(makeCard({ id: 42 }));
            mockUploadTaskCardImage.mockRejectedValue(new Error("HTTP 500"));

            const { result } = renderHook(() => useTaskBoard());
            await waitFor(() => expect(result.current.loading).toBe(false));
            mockFetchTaskBoard.mockClear();

            const blob = new Blob(["x"], { type: "image/jpeg" });
            let ok = false;
            await act(async () => {
                ok = await result.current.createCard({ title: "New task", description: null, deadline: null }, blob);
            });

            expect(ok).toBe(true);
            expect(result.current.error).toBe("Task saved, but the photo could not be uploaded.");
            expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
        });

        it("editCard uploads a new pending photo", async () => {
            mockFetchTaskBoard.mockResolvedValue([]);
            mockEditTaskCard.mockResolvedValue(makeCard({ id: 5 }));
            mockUploadTaskCardImage.mockResolvedValue({ taskCardId: 5, contentType: "image/jpeg", sizeBytes: 10 });

            const { result } = renderHook(() => useTaskBoard());
            await waitFor(() => expect(result.current.loading).toBe(false));
            mockFetchTaskBoard.mockClear();

            const blob = new Blob(["x"], { type: "image/jpeg" });
            const payload = { title: "Edited", description: "d", priority: "RED" as const, deadline: null };
            let ok = false;
            await act(async () => {
                ok = await result.current.editCard(5, payload, { pendingImage: blob, removeImage: false });
            });

            expect(mockUploadTaskCardImage).toHaveBeenCalledWith(5, blob);
            expect(mockDeleteTaskCardImage).not.toHaveBeenCalled();
            expect(ok).toBe(true);
        });

        it("editCard deletes the stored photo when removeImage is set and the card currently has one", async () => {
            const cards = [makeCard({ id: 5, hasImage: true })];
            mockFetchTaskBoard.mockResolvedValue(cards);
            mockEditTaskCard.mockResolvedValue(makeCard({ id: 5 }));
            mockDeleteTaskCardImage.mockResolvedValue(undefined);

            const { result } = renderHook(() => useTaskBoard());
            await waitFor(() => expect(result.current.loading).toBe(false));
            mockFetchTaskBoard.mockClear();

            const payload = { title: "Edited", description: "d", priority: "RED" as const, deadline: null };
            let ok = false;
            await act(async () => {
                ok = await result.current.editCard(5, payload, { pendingImage: null, removeImage: true });
            });

            expect(mockDeleteTaskCardImage).toHaveBeenCalledWith(5);
            expect(mockUploadTaskCardImage).not.toHaveBeenCalled();
            expect(ok).toBe(true);
        });

        it("editCard does not call deleteTaskCardImage when removeImage is set but the card has no stored photo", async () => {
            const cards = [makeCard({ id: 5, hasImage: false })];
            mockFetchTaskBoard.mockResolvedValue(cards);
            mockEditTaskCard.mockResolvedValue(makeCard({ id: 5 }));

            const { result } = renderHook(() => useTaskBoard());
            await waitFor(() => expect(result.current.loading).toBe(false));
            mockFetchTaskBoard.mockClear();

            const payload = { title: "Edited", description: "d", priority: "RED" as const, deadline: null };
            let ok = false;
            await act(async () => {
                ok = await result.current.editCard(5, payload, { pendingImage: null, removeImage: true });
            });

            expect(mockDeleteTaskCardImage).not.toHaveBeenCalled();
            expect(ok).toBe(true);
        });

        it("a rejected photo delete during editCard does not turn a successful save into a failure", async () => {
            const cards = [makeCard({ id: 5, hasImage: true })];
            mockFetchTaskBoard.mockResolvedValue(cards);
            mockEditTaskCard.mockResolvedValue(makeCard({ id: 5 }));
            mockDeleteTaskCardImage.mockRejectedValue(new Error("HTTP 500"));

            const { result } = renderHook(() => useTaskBoard());
            await waitFor(() => expect(result.current.loading).toBe(false));
            mockFetchTaskBoard.mockClear();

            const payload = { title: "Edited", description: "d", priority: "RED" as const, deadline: null };
            let ok = false;
            await act(async () => {
                ok = await result.current.editCard(5, payload, { pendingImage: null, removeImage: true });
            });

            expect(ok).toBe(true);
            expect(result.current.error).toBe("Task saved, but the photo could not be updated.");
            expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
        });
    });

    it("changePriority calls changeTaskCardPriority with the right args and refetches on success", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockChangeTaskCardPriority.mockResolvedValue(makeCard());

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        let ok = false;
        await act(async () => {
            ok = await result.current.changePriority(9, "RED");
        });

        expect(mockChangeTaskCardPriority).toHaveBeenCalledWith(9, { priority: "RED" });
        expect(ok).toBe(true);
        expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
    });

    it("changePriority returns false and sets error without refetching on rejection", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockChangeTaskCardPriority.mockRejectedValue(new Error("HTTP 500"));

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        let ok = true;
        await act(async () => {
            ok = await result.current.changePriority(9, "RED");
        });

        expect(ok).toBe(false);
        expect(result.current.error).toBe("HTTP 500");
        expect(mockFetchTaskBoard).not.toHaveBeenCalled();
    });

    it("deleteCard calls deleteTaskCard with the id and refetches on success", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockDeleteTaskCard.mockResolvedValue(undefined);

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        let ok = false;
        await act(async () => {
            ok = await result.current.deleteCard(3);
        });

        expect(mockDeleteTaskCard).toHaveBeenCalledWith(3);
        expect(ok).toBe(true);
        expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
    });

    it("deleteCard returns false and sets error without refetching on rejection", async () => {
        mockFetchTaskBoard.mockResolvedValue([]);
        mockDeleteTaskCard.mockRejectedValue(new Error("HTTP 403"));

        const { result } = renderHook(() => useTaskBoard());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        mockFetchTaskBoard.mockClear();

        let ok = true;
        await act(async () => {
            ok = await result.current.deleteCard(3);
        });

        expect(ok).toBe(false);
        expect(result.current.error).toBe("HTTP 403");
        expect(mockFetchTaskBoard).not.toHaveBeenCalled();
    });

    describe("moveCard", () => {
        it("applies the optimistic reorder synchronously before the API call resolves", async () => {
            const cards = [
                makeCard({ id: 1, status: "BACKLOG", position: 0 }),
                makeCard({ id: 2, status: "BACKLOG", position: 1 }),
            ];
            mockFetchTaskBoard.mockResolvedValue(cards);
            let resolveMove: (value: TaskCard) => void = () => {};
            mockMoveTaskCard.mockImplementation(() => new Promise(resolve => { resolveMove = resolve; }));

            const { result } = renderHook(() => useTaskBoard());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let movePromise: Promise<boolean> = Promise.resolve(false);
            act(() => {
                movePromise = result.current.moveCard(2, "BACKLOG", 0);
            });

            // Optimistic reorder must already be visible before the moveTaskCard promise settles.
            expect(result.current.cardsByStatus.BACKLOG.map(c => c.id)).toEqual([2, 1]);

            await act(async () => {
                resolveMove(makeCard({ id: 2 }));
                await movePromise;
            });
        });

        it("no-op short-circuit when target equals current position: no call to moveTaskCard", async () => {
            const cards = [
                makeCard({ id: 1, status: "BACKLOG", position: 0 }),
                makeCard({ id: 2, status: "BACKLOG", position: 1 }),
            ];
            mockFetchTaskBoard.mockResolvedValue(cards);

            const { result } = renderHook(() => useTaskBoard());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let ok = false;
            await act(async () => {
                ok = await result.current.moveCard(1, "BACKLOG", 0);
            });

            expect(ok).toBe(true);
            expect(mockMoveTaskCard).not.toHaveBeenCalled();
            expect(result.current.cards).toEqual(cards);
        });

        it("success path calls moveTaskCard with { targetStatus, targetIndex } and then refetch", async () => {
            const cards = [
                makeCard({ id: 1, status: "BACKLOG", position: 0 }),
                makeCard({ id: 2, status: "DOING", position: 0 }),
            ];
            mockFetchTaskBoard.mockResolvedValue(cards);
            mockMoveTaskCard.mockResolvedValue(makeCard({ id: 1, status: "DOING" }));

            const { result } = renderHook(() => useTaskBoard());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchTaskBoard.mockClear();

            let ok = false;
            await act(async () => {
                ok = await result.current.moveCard(1, "DOING", 1);
            });

            expect(mockMoveTaskCard).toHaveBeenCalledWith(1, { targetStatus: "DOING", targetIndex: 1 });
            expect(ok).toBe(true);
            expect(mockFetchTaskBoard).toHaveBeenCalledTimes(1);
        });

        it("failure path rolls the cards state back to its pre-move value and sets error", async () => {
            const cards = [
                makeCard({ id: 1, status: "BACKLOG", position: 0 }),
                makeCard({ id: 2, status: "BACKLOG", position: 1 }),
            ];
            mockFetchTaskBoard.mockResolvedValue(cards);
            mockMoveTaskCard.mockRejectedValue(new Error("HTTP 500"));

            const { result } = renderHook(() => useTaskBoard());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            mockFetchTaskBoard.mockClear();

            let ok = true;
            await act(async () => {
                ok = await result.current.moveCard(2, "BACKLOG", 0);
            });

            expect(ok).toBe(false);
            expect(result.current.error).toBe("HTTP 500");
            expect(result.current.cards).toEqual(cards);
            expect(mockFetchTaskBoard).not.toHaveBeenCalled();
        });
    });
});
