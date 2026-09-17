import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskColumn from "./TaskColumn";
import type { TaskCard } from "../types";

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

const TODAY = "2026-08-19";

describe("TaskColumn", () => {
    it("renders only the cards passed to it", () => {
        const cards = [makeCard({ id: 1, title: "Card One" }), makeCard({ id: 2, title: "Card Two" })];
        render(<TaskColumn status="BACKLOG" cards={cards} onCardClick={jest.fn()} onRequestEdit={jest.fn()} today={TODAY} isExpanded={true} />);

        expect(screen.getByText("Card One")).toBeTruthy();
        expect(screen.getByText("Card Two")).toBeTruthy();
        expect(screen.getAllByTestId(/task-card-\d/)).toHaveLength(2);
    });

    it("renders a BLOCKED column with its own header, count badge, and testids", () => {
        const cards = [makeCard({ id: 1, status: "BLOCKED", title: "Waiting on vendor" })];
        render(<TaskColumn status="BLOCKED" cards={cards} onCardClick={jest.fn()} onRequestEdit={jest.fn()} today={TODAY} isExpanded={true} />);

        expect(screen.getByTestId("task-column-BLOCKED")).toBeTruthy();
        expect(screen.getByText("Blocked")).toBeTruthy();
        expect(screen.getByTestId("task-column-count-BLOCKED").textContent).toBe("1");
        expect(screen.getByText("Waiting on vendor")).toBeTruthy();
    });

    it("renders the Add button only when onAddClick is provided", () => {
        const { rerender } = render(
            <TaskColumn
                status="BACKLOG"
                cards={[]}
                onCardClick={jest.fn()}
                onRequestEdit={jest.fn()}
                onAddClick={jest.fn()}
                today={TODAY}
                isExpanded={true}
            />
        );
        expect(screen.getByTestId("task-board-add-button-BACKLOG")).toBeTruthy();

        rerender(<TaskColumn status="DOING" cards={[]} onCardClick={jest.fn()} onRequestEdit={jest.fn()} today={TODAY} isExpanded={true} />);
        expect(screen.queryByTestId("task-board-add-button-BACKLOG")).toBeNull();
    });

    it("clicking a card forwards to onCardClick", () => {
        const onCardClick = jest.fn();
        const card = makeCard();
        render(<TaskColumn status="BACKLOG" cards={[card]} onCardClick={onCardClick} onRequestEdit={jest.fn()} today={TODAY} isExpanded={true} />);

        fireEvent.click(screen.getByText("Restock mozzarella"));

        expect(onCardClick).toHaveBeenCalledWith(card);
    });

    it("with no getDragHandlers prop supplied, rendering and click behavior stay identical to ST4", () => {
        const onCardClick = jest.fn();
        const card = makeCard();
        render(<TaskColumn status="BACKLOG" cards={[card]} onCardClick={onCardClick} onRequestEdit={jest.fn()} today={TODAY} isExpanded={true} />);

        fireEvent.click(screen.getByTestId("task-card-1"));

        expect(onCardClick).toHaveBeenCalledWith(card);
    });

    it("forwards isExpanded through to each TaskCardItem, controlling whether description text renders", () => {
        const card = makeCard({ description: "Buy more cheese" });
        const { rerender } = render(
            <TaskColumn status="BACKLOG" cards={[card]} onCardClick={jest.fn()} onRequestEdit={jest.fn()} today={TODAY} isExpanded={false} />
        );
        expect(screen.queryByText("Buy more cheese")).toBeNull();

        rerender(
            <TaskColumn status="BACKLOG" cards={[card]} onCardClick={jest.fn()} onRequestEdit={jest.fn()} today={TODAY} isExpanded={true} />
        );
        expect(screen.getByText("Buy more cheese")).toBeTruthy();
    });

    it("forwards getDragHandlers verbatim to each TaskCardItem", () => {
        const card = makeCard();
        const getDragHandlers = jest.fn(() => ({
            onPointerDown: jest.fn(),
            onPointerMove: jest.fn(),
            onPointerUp: jest.fn(),
            onPointerCancel: jest.fn(),
            onClick: jest.fn(),
            style: { touchAction: "none" },
            isDragging: false,
        }));

        render(
            <TaskColumn
                status="BACKLOG"
                cards={[card]}
                onCardClick={jest.fn()}
                onRequestEdit={jest.fn()}
                getDragHandlers={getDragHandlers}
                today={TODAY}
                isExpanded={true}
            />
        );

        expect(getDragHandlers).toHaveBeenCalledWith(card, expect.any(Function));
    });

    it("forwards onRequestEdit to each TaskCardItem's three-dot menu Edit item", () => {
        const onRequestEdit = jest.fn();
        const card = makeCard();
        render(<TaskColumn status="BACKLOG" cards={[card]} onCardClick={jest.fn()} onRequestEdit={onRequestEdit} today={TODAY} isExpanded={true} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        fireEvent.click(screen.getByTestId("task-card-edit-1"));

        expect(onRequestEdit).toHaveBeenCalledWith(card);
    });

    describe("dropIndicatorIndex (live drop-position placeholder)", () => {
        it("renders no placeholder when dropIndicatorIndex is null/omitted", () => {
            const cards = [makeCard({ id: 1 }), makeCard({ id: 2 })];
            render(<TaskColumn status="BACKLOG" cards={cards} onCardClick={jest.fn()} onRequestEdit={jest.fn()} today={TODAY} isExpanded={true} />);

            expect(screen.queryByTestId("task-column-drop-indicator")).toBeNull();
        });

        it("renders exactly one placeholder, before the card at the given index", () => {
            const cards = [makeCard({ id: 1, title: "First" }), makeCard({ id: 2, title: "Second" })];
            render(
                <TaskColumn
                    status="BACKLOG"
                    cards={cards}
                    onCardClick={jest.fn()}
                    onRequestEdit={jest.fn()}
                    dropIndicatorIndex={1}
                    today={TODAY}
                    isExpanded={true}
                />
            );

            const indicators = screen.getAllByTestId("task-column-drop-indicator");
            expect(indicators).toHaveLength(1);
            // The placeholder sits between "First" and "Second" — its element must precede Second's
            // card element in DOM order (index 1 = "insert before the card currently at index 1").
            const secondCard = screen.getByTestId("task-card-2");
            expect(indicators[0].compareDocumentPosition(secondCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it("renders the placeholder at the end of the list when dropIndicatorIndex equals the card count", () => {
            const cards = [makeCard({ id: 1, title: "Only card" })];
            render(
                <TaskColumn
                    status="BACKLOG"
                    cards={cards}
                    onCardClick={jest.fn()}
                    onRequestEdit={jest.fn()}
                    dropIndicatorIndex={1}
                    today={TODAY}
                    isExpanded={true}
                />
            );

            const indicator = screen.getByTestId("task-column-drop-indicator");
            const onlyCard = screen.getByTestId("task-card-1");
            // Placeholder comes AFTER the only card, not before it.
            expect(onlyCard.compareDocumentPosition(indicator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it("the placeholder is non-interactive and never intercepts a click meant for a card", () => {
            const onCardClick = jest.fn();
            const cards = [makeCard({ id: 1, title: "Only card" })];
            render(
                <TaskColumn
                    status="BACKLOG"
                    cards={cards}
                    onCardClick={onCardClick}
                    onRequestEdit={jest.fn()}
                    dropIndicatorIndex={0}
                    today={TODAY}
                    isExpanded={true}
                />
            );

            // MUI's `sx` compiles to an emotion class, not an inline style, so pointerEvents isn't
            // assertable directly in jsdom — the real regression guard is behavioral: a click aimed
            // at the card must still reach it, never get swallowed by the placeholder sitting nearby.
            expect(screen.getByTestId("task-column-drop-indicator")).toBeTruthy();

            fireEvent.click(screen.getByTestId("task-card-1"));
            expect(onCardClick).toHaveBeenCalledWith(cards[0]);
        });
    });
});
