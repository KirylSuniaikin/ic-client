import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { CreateTaskCardPayload, EditTaskCardPayload, TaskCard, TaskCardPriority, TaskCardStatus } from "../types";
import type { UseTaskBoardResult } from "../hooks/useTaskBoard";

// PizzaLoader imports lottie-react, which touches a real 2D canvas context at import time,
// unavailable in jsdom — see HistoryComponent.test.tsx / AdminHomePage.test.tsx for the
// same precedent. Stub components are prefixed `mock` per babel-plugin-jest-hoist's
// out-of-scope-variable rule for jest.mock() factories.
function mockPizzaLoader(): JSX.Element {
    return <div data-testid="pizza-loader" />;
}

jest.mock("../../../order-status/components/animations/PizzaLoader", () => ({
    __esModule: true,
    default: mockPizzaLoader,
}));

// Factoryless jest.mock() on the hook itself — isolates TaskBoardPanel's own composition
// logic (which columns render, drawer/dialog orchestration) from useTaskBoard's internals,
// which already have their own dedicated useTaskBoard.test.ts. Mirrors how AdminHomePage.test.tsx
// mocks its child hooks.
jest.mock("../hooks/useTaskBoard");

// Same rationale for useCardDrag: TaskBoardPanel's own wiring (does onDrop reach board.moveCard
// with the right args) is what this file tests, not the drag hook's pointer-event internals,
// which already have their own dedicated useCardDrag.test.ts.
jest.mock("../hooks/useCardDrag");

import { useTaskBoard } from "../hooks/useTaskBoard";
import { useCardDrag } from "../hooks/useCardDrag";
import type { UseCardDragOptions } from "../hooks/useCardDrag";
import TaskBoardPanel from "./TaskBoardPanel";

const mockUseTaskBoard = jest.mocked(useTaskBoard);
const mockUseCardDrag = jest.mocked(useCardDrag);

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
        ...overrides,
    };
}

function taskBoardValue(overrides: Partial<UseTaskBoardResult> = {}): UseTaskBoardResult {
    return {
        cards: [],
        cardsByStatus: { BACKLOG: [], DOING: [], DONE: [] },
        loading: false,
        error: null,
        mutating: false,
        refetch: jest.fn(async () => undefined),
        createCard: jest.fn<Promise<boolean>, [CreateTaskCardPayload]>().mockResolvedValue(true),
        editCard: jest.fn<Promise<boolean>, [number, EditTaskCardPayload]>().mockResolvedValue(true),
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
            return { getDragHandlers: jest.fn() };
        });
    });

    it("renders with no props at all without throwing", () => {
        expect(() => render(<TaskBoardPanel />)).not.toThrow();
    });

    it("renders exactly 3 columns with cards routed to the right column", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG" }),
            makeCard({ id: 2, status: "DOING", title: "In progress task" }),
            makeCard({ id: 3, status: "DONE", title: "Finished task" }),
        ];
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({
                cards,
                cardsByStatus: { BACKLOG: [cards[0]], DOING: [cards[1]], DONE: [cards[2]] },
            })
        );

        render(<TaskBoardPanel />);

        expect(screen.getByTestId("task-column-BACKLOG")).toBeTruthy();
        expect(screen.getByTestId("task-column-DOING")).toBeTruthy();
        expect(screen.getByTestId("task-column-DONE")).toBeTruthy();
        expect(screen.getByTestId("task-card-1")).toBeTruthy();
        expect(screen.getByTestId("task-card-2")).toBeTruthy();
        expect(screen.getByTestId("task-card-3")).toBeTruthy();
    });

    it("shows PizzaLoader while loading and no cards yet", () => {
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ loading: true }));

        render(<TaskBoardPanel />);

        expect(screen.getByTestId("pizza-loader")).toBeTruthy();
        expect(screen.queryByTestId("task-column-BACKLOG")).toBeNull();
    });

    it("clicking a card opens the drawer in 'view' mode with that card's data", () => {
        const card = makeCard({ description: "Buy more cheese" });
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], DOING: [], DONE: [] } })
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

        fireEvent.click(screen.getByTestId("task-board-add-button"));

        expect(screen.getByText("New Task")).toBeTruthy();
        expect(screen.getByLabelText("Title")).toHaveProperty("value", "");
    });

    it("a successful createCard closes the drawer", async () => {
        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(screen.queryByLabelText("Title")).toBeNull();
        });
    });

    it("a failed createCard leaves the drawer open and shows ErrorSnackbar", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload]>().mockResolvedValue(false);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard, error: "HTTP 400" }));

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button"));
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
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], DOING: [], DONE: [] } })
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
            taskBoardValue({ cards: [card], cardsByStatus: { BACKLOG: [card], DOING: [], DONE: [] }, deleteCard })
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

    it("a failed deleteCard leaves the dialog/drawer open and shows ErrorSnackbar", async () => {
        const card = makeCard();
        const deleteCard = jest.fn<Promise<boolean>, [number]>().mockResolvedValue(false);
        mockUseTaskBoard.mockReturnValue(
            taskBoardValue({
                cards: [card],
                cardsByStatus: { BACKLOG: [card], DOING: [], DONE: [] },
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
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel ownerId={7} />);

        fireEvent.click(screen.getByTestId("task-board-add-button"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: 7 }));
        });
    });

    it("omitting ownerId results in createCard being called with assigneeId undefined", async () => {
        const createCard = jest.fn<Promise<boolean>, [CreateTaskCardPayload]>().mockResolvedValue(true);
        mockUseTaskBoard.mockReturnValue(taskBoardValue({ createCard }));

        render(<TaskBoardPanel />);

        fireEvent.click(screen.getByTestId("task-board-add-button"));
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => {
            expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: undefined }));
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
});
