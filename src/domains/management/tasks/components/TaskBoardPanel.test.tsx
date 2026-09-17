import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { CreateTaskCardPayload, EditTaskCardPayload, TaskCard, TaskCardPriority, TaskCardStatus } from "../types";
import type { UseTaskBoardResult } from "../hooks/useTaskBoard";
import type { PhotoPatch } from "../../../../shared/components/EntityPhotoField";

// Factoryless jest.mock() on the hook itself — isolates TaskBoardPanel's own composition
// logic (which columns render, drawer/dialog orchestration) from useTaskBoard's internals,
// which already have their own dedicated useTaskBoard.test.ts. Mirrors how AdminHomePage.test.tsx
// mocks its child hooks.
jest.mock("../hooks/useTaskBoard");

// Same rationale for useCardDrag: TaskBoardPanel's own wiring (does onDrop reach board.moveCard
// with the right args) is what this file tests, not the drag hook's pointer-event internals,
// which already have their own dedicated useCardDrag.test.ts.
jest.mock("../hooks/useCardDrag");

// TaskCardDrawer itself is NOT mocked (it is the real component under test here), and its
// TaskCardAttachmentsField now fetches on mount for any real card id, in every mode — so
// shared/api/management must be mocked or every test that opens the drawer for an existing card
// would hit a real, unmocked fetch().
jest.mock("../../../../shared/api/management");

import { useTaskBoard } from "../hooks/useTaskBoard";
import { useCardDrag } from "../hooks/useCardDrag";
import type { UseCardDragOptions } from "../hooks/useCardDrag";
import { fetchTaskCardAttachments } from "../../../../shared/api/management";
import TaskBoardPanel from "./TaskBoardPanel";
import { composeTaskDescription } from "../descriptionBlocks";

const mockUseTaskBoard = jest.mocked(useTaskBoard);
const mockUseCardDrag = jest.mocked(useCardDrag);
const mockFetchTaskCardAttachments = jest.mocked(fetchTaskCardAttachments);

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

function taskBoardValue(overrides: Partial<UseTaskBoardResult> = {}): UseTaskBoardResult {
    return {
        cards: [],
        cardsByStatus: { BACKLOG: [], BLOCKED: [], DOING: [], DONE: [] },
        loading: false,
        error: null,
        mutating: false,
        // Default: no fetch has resolved for the current ownerId yet, so the panel's guard
        // suppresses reporting. Tests that need a count report to fire must set loadedOwnerId
        // to the same value passed as the ownerId prop.
        loadedOwnerId: null,
        refetch: jest.fn(async () => undefined),
        createCard: jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(true),
        editCard: jest.fn<Promise<boolean>, [number, EditTaskCardPayload, PhotoPatch?]>().mockResolvedValue(true),
        changePriority: jest.fn<Promise<boolean>, [number, TaskCardPriority]>().mockResolvedValue(true),
        deleteCard: jest.fn<Promise<boolean>, [number]>().mockResolvedValue(true),
        moveCard: jest.fn<Promise<boolean>, [number, TaskCardStatus, number]>().mockResolvedValue(true),
        ...overrides,
    };
}

describe("TaskBoardPanel", () => {
    let capturedOnDrop: UseCardDragOptions["onDrop"] | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        capturedOnDrop = null;
        mockUseTaskBoard.mockReturnValue(taskBoardValue());
        mockUseCardDrag.mockImplementation((options: UseCardDragOptions) => {
            capturedOnDrop = options.onDrop;
            return { getDragHandlers: jest.fn(), dropTarget: null };
        });
        // Default: no attachments — nothing in this file exercises TaskCardAttachmentsField's own
        // behaviour (that lives in TaskCardAttachmentsField.test.tsx); this just keeps the drawer's
        // real fetch-on-mount from hitting an unmocked network call.
        mockFetchTaskCardAttachments.mockResolvedValue([]);
    });

    it("renders with no props at all without throwing", () => {
        expect(() => render(<TaskBoardPanel />)).not.toThrow();
    });

    it("renders all 4 columns, in BACKLOG, BLOCKED, DOING, DONE order, with cards routed to the right column", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG" }),
            makeCard({ id: 2, status: "DOING", title: "In progress task" }),
            makeCard({ id: 3, status: "DONE", title: "Finished task" }),
            makeCard({ id: 4, status: "BLOCKED", title: "Blocked task" }),
        ];
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({
                cards,
                cardsByStatus: { BACKLOG: [cards[0]], BLOCKED: [cards[3]], DOING: [cards[1]], DONE: [cards[2]] },
            })
        );

        render(<TaskBoardPanel />);

        expect(screen.getByTestId("task-column-BACKLOG")).toBeTruthy();
        expect(screen.getByTestId("task-column-BLOCKED")).toBeTruthy();
        expect(screen.getByTestId("task-column-DOING")).toBeTruthy();
        expect(screen.getByTestId("task-column-DONE")).toBeTruthy();
        expect(screen.getByTestId("task-board-add-button-BLOCKED")).toBeTruthy();
        expect(screen.getByTestId("task-card-1")).toBeTruthy();
        expect(screen.getByTestId("task-card-2")).toBeTruthy();
        expect(screen.getByTestId("task-card-3")).toBeTruthy();
        expect(screen.getByTestId("task-card-4")).toBeTruthy();

        // TASK_CARD_STATUSES' order is the board's left-to-right column order: BLOCKED sits
        // between BACKLOG and DOING.
        const columnTestIds = screen.getAllByTestId(/^task-column-[A-Z]+$/).map(el => el.getAttribute("data-testid"));
        expect(columnTestIds).toEqual(["task-column-BACKLOG", "task-column-BLOCKED", "task-column-DOING", "task-column-DONE"]);
    });

    it("shows the loading indicator while loading and no cards yet", () => {
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ loading: true }));

        render(<TaskBoardPanel />);

        expect(screen.getByTestId("loading-indicator")).toBeTruthy();
        expect(screen.queryByTestId("task-column-BACKLOG")).toBeNull();
    });

    it("clicking a card opens the drawer in 'view' mode with that card's data", () => {
        const card = makeCard({ description: "Buy more cheese" });
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
        );

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByText("Restock mozzarella"));

        // The column card behind the drawer still renders the same title/description text,
        // so the drawer's own data must be asserted scoped to the drawer (role="dialog"),
        // not with a bare, ambiguous screen query.
        const drawer = screen.getByRole("dialog");
        expect(within(drawer).getByText("Buy more cheese")).toBeTruthy();
        expect(within(drawer).getByText("Edit")).toBeTruthy();
        expect(within(drawer).getByText("Delete")).toBeTruthy();
    });

    it("clicking 'Add Task' opens the drawer in 'create' mode", () => {
        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));

        expect(screen.getByText("New Task")).toBeTruthy();
        expect(screen.getByLabelText("Title")).toHaveProperty("value", "");
    });

    it("every column has its own Add button, and each creates in that column", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel />);

        expect(screen.getByTestId("task-board-add-button-BACKLOG")).toBeTruthy();
        expect(screen.getByTestId("task-board-add-button-DOING")).toBeTruthy();
        expect(screen.getByTestId("task-board-add-button-DONE")).toBeTruthy();

        fireEvent.click(screen.getByTestId("task-board-add-button-DOING"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Started already" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ status: "DOING" }), null, []);
        });
    });

    it("picking files in create mode forwards them through to board.createCard as pendingAttachments", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });

        const file = new File(["hello"], "readme.txt", { type: "text/plain" });
        fireEvent.change(screen.getByTestId("task-attachments-input-new"), { target: { files: [file] } });
        await waitFor(() => expect(screen.getByText("readme.txt")).toBeTruthy());

        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ title: "New task" }), null, [file]);
        });
    });

    it("filling the four-block description form composes them into one string via composeTaskDescription for createCard", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.change(screen.getByLabelText("Goal & Description"), { target: { value: "Sell more pizza" } });
        fireEvent.change(screen.getByLabelText("Done Criteria"), { target: { value: "Revenue up 10%" } });
        fireEvent.change(screen.getByLabelText("Progress Comments"), { target: { value: "Reached out to two new suppliers" } });
        fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "No delivery drivers" } });
        fireEvent.click(screen.getByText("Save"));

        const expectedDescription = composeTaskDescription({
            goal: "Sell more pizza",
            doneCriteria: "Revenue up 10%",
            progressComments: "Reached out to two new suppliers",
            blocker: "No delivery drivers",
        });

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(
                expect.objectContaining({ title: "New task", description: expectedDescription }),
                null,
                []
            );
        });
    });

    it("submits description: null when all four blocks are left blank", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ description: null }), null, []);
        });
    });

    it("filling the four-block description form composes them into one string via composeTaskDescription for editCard", async () => {
        const card = makeCard();
        const editCard = jest.fn<Promise<boolean>, [number, EditTaskCardPayload, PhotoPatch?]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] }, editCard })
        );

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByText("Restock mozzarella"));
        fireEvent.click(screen.getByText("Edit"));
        fireEvent.change(screen.getByLabelText("Goal & Description"), { target: { value: "Sell more pizza" } });
        fireEvent.change(screen.getByLabelText("Done Criteria"), { target: { value: "Revenue up 10%" } });
        fireEvent.change(screen.getByLabelText("Progress Comments"), { target: { value: "Reached out to two new suppliers" } });
        fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "No delivery drivers" } });
        fireEvent.click(screen.getByText("Save"));

        const expectedDescription = composeTaskDescription({
            goal: "Sell more pizza",
            doneCriteria: "Revenue up 10%",
            progressComments: "Reached out to two new suppliers",
            blocker: "No delivery drivers",
        });

        await waitFor(() => {
            expect(editCard).toHaveBeenCalledWith(
                card.id,
                expect.objectContaining({ description: expectedDescription }),
                expect.anything()
            );
        });
    });

    it("a successful createCard closes the drawer", async () => {
        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(screen.queryByLabelText("Title")).toBeNull();
        });
    });

    it("a failed createCard leaves the drawer open and shows ErrorSnackbar", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(false);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard, error: "HTTP 400" }));

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalled();
        });

        expect(screen.getByLabelText("Title")).toBeTruthy();
        expect(screen.getByText("HTTP 400")).toBeTruthy();
    });

    it("a successful editCard closes the drawer", async () => {
        const card = makeCard();
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
        );

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByText("Restock mozzarella"));
        fireEvent.click(screen.getByText("Edit"));
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(screen.queryByText("Save")).toBeNull();
        });
    });

    it("confirming DeleteTaskCardDialog with a successful deleteCard closes both the dialog and the drawer", async () => {
        const card = makeCard();
        const deleteCard = jest.fn<Promise<boolean>, [number]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] }, deleteCard })
        );

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByText("Restock mozzarella"));
        fireEvent.click(screen.getByText("Delete"));
        const deleteButtons = screen.getAllByText("Delete");
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);

        await waitFor(() => {
            expect(deleteCard).toHaveBeenCalledWith(card.id);
        });

        // The test's own name promises "closes both the dialog and the drawer" — prove it:
        // "Delete Task" is the confirm dialog's own title, and "Edit" only renders inside the
        // drawer's view mode, so both disappearing is exactly what closing both looks like.
        await waitFor(() => {
            expect(screen.queryByText("Delete Task")).toBeNull();
            expect(screen.queryByText("Edit")).toBeNull();
        });
    });

    it("deleting from the card's three-dots menu deletes that card without opening the drawer first", async () => {
        const card = makeCard({ id: 42 });
        const deleteCard = jest.fn<Promise<boolean>, [number]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] }, deleteCard })
        );

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-42"));
        fireEvent.click(screen.getByTestId("task-card-delete-42"));

        // The confirmation still stands between the menu entry and the deletion.
        expect(screen.getByText("Delete Task")).toBeTruthy();
        const deleteButtons = screen.getAllByText("Delete");
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);

        await waitFor(() => {
            expect(deleteCard).toHaveBeenCalledWith(42);
        });
    });

    it("editing from the card's three-dots menu opens the drawer directly in edit mode, without the view-mode step", () => {
        const card = makeCard({ id: 42, title: "Restock mozzarella" });
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
        );

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-42"));
        fireEvent.click(screen.getByTestId("task-card-edit-42"));

        // "Edit Task" is the drawer's edit-mode-only header; the view-mode "Edit" button never
        // rendering at all is what proves this skipped the view-mode step entirely.
        expect(screen.getByText("Edit Task")).toBeTruthy();
        expect(screen.getByDisplayValue("Restock mozzarella")).toBeTruthy();
    });

    it("a failed deleteCard leaves the dialog/drawer open and shows ErrorSnackbar", async () => {
        const card = makeCard();
        const deleteCard = jest.fn<Promise<boolean>, [number]>().mockResolvedValue(false);
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({
                cards: [card],
                cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] },
                deleteCard,
                error: "HTTP 500",
            })
        );

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByText("Restock mozzarella"));
        fireEvent.click(screen.getByText("Delete"));
        const deleteButtons = screen.getAllByText("Delete");
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);

        await waitFor(() => {
            expect(deleteCard).toHaveBeenCalled();
        });

        expect(screen.getByText("HTTP 500")).toBeTruthy();

        // Both the TaskCardDrawer and DeleteTaskCardDialog stay open (role="dialog" each),
        // and the column card behind them still shows the same title text, so we must scope
        // to the drawer specifically — identified by its "Edit" action, unique to view mode —
        // to prove the DRAWER (not just the column) still shows this card's data.
        // `hidden: true` is required here: MUI's ModalManager sets aria-hidden="true" on the
        // Drawer's portal root while the topmost DeleteTaskCardDialog is open (standard MUI
        // stacked-modal a11y behaviour — see ModalManager.ariaHiddenSiblings), and byRole
        // excludes aria-hidden elements by default. The Drawer is still genuinely open in the
        // DOM/state; only its accessibility exposure is suppressed while a modal sits above it.
        const dialogs = screen.getAllByRole("dialog", { hidden: true });
        const drawer = dialogs.find(dialog => within(dialog).queryByText("Edit"));
        if (!drawer) {
            throw new Error("Expected the TaskCardDrawer to remain open in view mode");
        }
        expect(within(drawer).getByText("Restock mozzarella")).toBeTruthy();
    });

    it("passing ownerId results in createCard being called with matching assigneeId", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel ownerId={7} />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: 7 }), null, []);
        });
    });

    it("omitting ownerId results in createCard being called with assigneeId undefined", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload, (Blob | null)?, File[]?]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button-BACKLOG"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: undefined }), null, []);
        });
    });

    it("renders no 'Board of …' header when ownerLabel is not provided", () => {
        render(<TaskBoardPanel />);

        expect(screen.queryByTestId("task-board-owner-header")).toBeNull();
    });

    it("renders a 'Board of …' header when ownerLabel is provided", () => {
        render(<TaskBoardPanel ownerLabel="Riley Super" />);

        expect(screen.getByTestId("task-board-owner-header").textContent).toContain("Riley Super");
    });

    describe("descriptions expand/collapse toggle", () => {
        it("defaults to expanded, showing description text and a 'Collapse all' label", () => {
            const card = makeCard({ description: "Buy more cheese" });
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
            );

            render(<TaskBoardPanel />);

            expect(screen.getByTestId("task-board-descriptions-toggle").textContent).toContain("Collapse all");
            expect(screen.getByText("Buy more cheese")).toBeTruthy();
        });

        it("clicking the toggle collapses descriptions and flips the label to 'Expand all'", () => {
            const card = makeCard({ description: "Buy more cheese" });
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
            );

            render(<TaskBoardPanel />);

            fireEvent.click(screen.getByTestId("task-board-descriptions-toggle"));

            expect(screen.getByTestId("task-board-descriptions-toggle").textContent).toContain("Expand all");
            expect(screen.queryByText("Buy more cheese")).toBeNull();
        });

        it("clicking the toggle twice returns to expanded, showing 'Collapse all' and the description text again", () => {
            const card = makeCard({ description: "Buy more cheese" });
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
            );

            render(<TaskBoardPanel />);

            const toggle = screen.getByTestId("task-board-descriptions-toggle");
            fireEvent.click(toggle);
            fireEvent.click(toggle);

            expect(toggle.textContent).toContain("Collapse all");
            expect(screen.getByText("Buy more cheese")).toBeTruthy();
        });

        it("renders the toggle regardless of whether ownerLabel is provided", () => {
            render(<TaskBoardPanel ownerLabel="Riley Super" />);

            expect(screen.getByTestId("task-board-descriptions-toggle")).toBeTruthy();
        });
    });

    describe("onOpenCardCountChange", () => {
        it("does not report while cards still belong to a previous owner (loadedOwnerId behind ownerId)", () => {
            const onOpenCardCountChange = jest.fn<void, [number | null, number]>();
            // Simulates the moment right after an owner switch: the previous owner's cards are
            // still in state, loading has already flipped back to false, but the fetch for the
            // new owner (7) has not resolved yet, so loadedOwnerId still reads the old owner (1).
            const staleCards = [makeCard({ id: 1, status: "BACKLOG" })];
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({
                    cards: staleCards,
                    cardsByStatus: { BACKLOG: staleCards, BLOCKED: [], DOING: [], DONE: [] },
                    loading: false,
                    loadedOwnerId: 1,
                })
            );

            render(<TaskBoardPanel ownerId={7} onOpenCardCountChange={onOpenCardCountChange} />);

            expect(onOpenCardCountChange).not.toHaveBeenCalled();
        });

        it("reports once the new fetch resolves and loadedOwnerId catches up to ownerId", () => {
            const onOpenCardCountChange = jest.fn<void, [number | null, number]>();
            const ownerBCards = [
                makeCard({ id: 2, status: "BACKLOG" }),
                makeCard({ id: 3, status: "DOING" }),
            ];
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({
                    cards: ownerBCards,
                    cardsByStatus: { BACKLOG: [ownerBCards[0]], BLOCKED: [], DOING: [ownerBCards[1]], DONE: [] },
                    loading: false,
                    loadedOwnerId: 7,
                })
            );

            render(<TaskBoardPanel ownerId={7} onOpenCardCountChange={onOpenCardCountChange} />);

            expect(onOpenCardCountChange).toHaveBeenCalledWith(7, 2);
            expect(onOpenCardCountChange).toHaveBeenCalledTimes(1);
        });
    });

    it("invoking useCardDrag's captured onDrop calls board.moveCard with matching arguments", async () => {
        const moveCard = jest.fn<Promise<boolean>, [number, TaskCardStatus, number]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ moveCard }));

        render(<TaskBoardPanel />);

        expect(capturedOnDrop).not.toBeNull();
        capturedOnDrop?.({ cardId: 5, targetStatus: "DOING", targetIndex: 2 });

        await waitFor(() => {
            expect(moveCard).toHaveBeenCalledWith(5, "DOING", 2);
        });
    });

    // task-spec.md Sub-task D3: opens the card named by a Telegram-clicked deep link, the moment
    // it appears in board.cards, exactly once.
    describe("autoOpenCardId", () => {
        it("opens the matching card's drawer once the board has loaded, and reports via onAutoOpenHandled", () => {
            const card = makeCard({ id: 42, title: "Deep-linked card", description: "From Telegram" });
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
            );
            const onAutoOpenHandled = jest.fn();

            render(<TaskBoardPanel autoOpenCardId={42} onAutoOpenHandled={onAutoOpenHandled} />);

            const drawer = screen.getByRole("dialog");
            expect(within(drawer).getByText("From Telegram")).toBeTruthy();
            expect(onAutoOpenHandled).toHaveBeenCalledTimes(1);
        });

        it("opens nothing but still reports onAutoOpenHandled once the board has loaded and the id never resolves (review-feedback-D.md Issue 3)", () => {
            const card = makeCard({ id: 1 });
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
            );
            const onAutoOpenHandled = jest.fn();

            render(<TaskBoardPanel autoOpenCardId={999} onAutoOpenHandled={onAutoOpenHandled} />);

            expect(screen.queryByRole("dialog")).toBeNull();
            // onAutoOpenHandled's own contract is "opened, OR the id never resolved" -- a card
            // that was deleted/moved/never existed must still get its deep-link params stripped,
            // or they'd linger in the URL and re-force the board tab on every refresh.
            expect(onAutoOpenHandled).toHaveBeenCalledTimes(1);
        });

        it("does not report an unresolved id while cards still belong to a previous owner (loadedOwnerId behind ownerId)", () => {
            // Simulates the moment right after an owner switch: loading has already flipped back
            // to false, but the fetch for the new owner (7) hasn't resolved yet, so the board
            // still holds the previous owner's (1) cards -- same race onOpenCardCountChange above
            // guards against. Deciding "unresolved" here would be wrong: the deep-linked card may
            // still be sitting in owner 7's board, not yet fetched.
            const staleCards = [makeCard({ id: 1 })];
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({
                    cards: staleCards,
                    cardsByStatus: { BACKLOG: staleCards, BLOCKED: [], DOING: [], DONE: [] },
                    loading: false,
                    loadedOwnerId: 1,
                })
            );
            const onAutoOpenHandled = jest.fn();

            render(<TaskBoardPanel ownerId={7} autoOpenCardId={999} onAutoOpenHandled={onAutoOpenHandled} />);

            expect(onAutoOpenHandled).not.toHaveBeenCalled();
        });

        it("does not reopen the drawer once the user has closed it, even if board.cards updates again", async () => {
            const card = makeCard({ id: 42, title: "Deep-linked card" });
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], BLOCKED: [], DOING: [], DONE: [] } })
            );

            const { rerender } = render(<TaskBoardPanel autoOpenCardId={42} />);
            expect(screen.getByRole("dialog")).toBeTruthy();

            fireEvent.click(within(screen.getByRole("dialog")).getByLabelText("Close"));
            // MUI's Dialog plays an exit transition on close, so it does not leave the DOM
            // synchronously with the click — wait for it to actually disappear before asserting.
            await waitFor(() => {
                expect(screen.queryByRole("dialog")).toBeNull();
            });

            // An unrelated card update (e.g. someone else edited a card) reruns the effect's deps.
            const updatedCard = { ...card, title: "Edited elsewhere" };
            mockUseTaskBoard.mockReturnValue(
                taskBoardValue({ cards: [updatedCard], cardsByStatus: { BACKLOG: [updatedCard], BLOCKED: [], DOING: [], DONE: [] } })
            );
            rerender(<TaskBoardPanel autoOpenCardId={42} />);

            expect(screen.queryByRole("dialog")).toBeNull();
        });
    });
});
