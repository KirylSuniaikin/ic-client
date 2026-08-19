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
        render(<TaskColumn status="BACKLOG" cards={cards} onCardClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />);

        expect(screen.getByText("Card One")).toBeTruthy();
        expect(screen.getByText("Card Two")).toBeTruthy();
        expect(screen.getAllByTestId(/task-card-\d/)).toHaveLength(2);
    });

    it("renders the Add button only when onAddClick is provided", () => {
        const { rerender } = render(
            <TaskColumn
                status="BACKLOG"
                cards={[]}
                onCardClick={jest.fn()}
                onChangePriority={jest.fn()}
                onAddClick={jest.fn()}
                today={TODAY}
            />
        );
        expect(screen.getByTestId("task-board-add-button-BACKLOG")).toBeTruthy();

        rerender(<TaskColumn status="DOING" cards={[]} onCardClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />);
        expect(screen.queryByTestId("task-board-add-button-BACKLOG")).toBeNull();
    });

    it("clicking a card forwards to onCardClick", () => {
        const onCardClick = jest.fn();
        const card = makeCard();
        render(<TaskColumn status="BACKLOG" cards={[card]} onCardClick={onCardClick} onChangePriority={jest.fn()} today={TODAY} />);

        fireEvent.click(screen.getByText("Restock mozzarella"));

        expect(onCardClick).toHaveBeenCalledWith(card);
    });

    it("with no getDragHandlers prop supplied, rendering and click behavior stay identical to ST4", () => {
        const onCardClick = jest.fn();
        const card = makeCard();
        render(<TaskColumn status="BACKLOG" cards={[card]} onCardClick={onCardClick} onChangePriority={jest.fn()} today={TODAY} />);

        fireEvent.click(screen.getByTestId("task-card-1"));

        expect(onCardClick).toHaveBeenCalledWith(card);
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
                onChangePriority={jest.fn()}
                getDragHandlers={getDragHandlers}
                today={TODAY}
            />
        );

        expect(getDragHandlers).toHaveBeenCalledWith(card, expect.any(Function));
    });
});
