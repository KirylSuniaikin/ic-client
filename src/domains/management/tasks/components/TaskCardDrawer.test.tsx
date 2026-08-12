import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCardDrawer from "./TaskCardDrawer";
import type { TaskCard } from "../types";

function makeCard(overrides: Partial<TaskCard> = {}): TaskCard {
    return {
        id: 1,
        title: "Restock mozzarella",
        description: "A very long description that would normally be clamped on the card face but must show in full here.",
        priority: "YELLOW",
        status: "BACKLOG",
        position: 0,
        assigneeId: 7,
        createdAt: "2026-08-12T10:00:00",
        updatedAt: "2026-08-12T10:00:00",
        ...overrides,
    };
}

describe("TaskCardDrawer", () => {
    it("'view' mode shows the full description and Edit/Delete actions", () => {
        const card = makeCard();
        render(
            <TaskCardDrawer
                open
                mode="view"
                card={card}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={jest.fn()}
                onCreate={jest.fn()}
                onEdit={jest.fn()}
            />
        );

        // `card` is this file's own literal fixture with a known non-null description, but
        // `TaskCard.description` is typed `string | null` — the cast just narrows what this
        // specific test fixture is already known to hold; `getByText` requires a `string`.
        expect(screen.getByText(card.description as string)).toBeTruthy();
        expect(screen.getByText("Edit")).toBeTruthy();
        expect(screen.getByText("Delete")).toBeTruthy();
    });

    it("'view' mode shows a placeholder when description is null", () => {
        const card = makeCard({ description: null });
        render(
            <TaskCardDrawer
                open
                mode="view"
                card={card}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={jest.fn()}
                onCreate={jest.fn()}
                onEdit={jest.fn()}
            />
        );

        expect(screen.getByText("No description")).toBeTruthy();
    });

    it("'create' mode shows an empty form with priority defaulted to GREEN", () => {
        render(
            <TaskCardDrawer
                open
                mode="create"
                card={null}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={jest.fn()}
                onCreate={jest.fn()}
                onEdit={jest.fn()}
            />
        );

        expect(screen.getByLabelText("Title")).toHaveProperty("value", "");
        expect(screen.getByLabelText("Description")).toHaveProperty("value", "");
        expect(screen.getByTestId("task-card-priority-GREEN").className).toMatch(/Mui-selected/);
    });

    it("Save is disabled for a blank/whitespace title", () => {
        render(
            <TaskCardDrawer
                open
                mode="create"
                card={null}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={jest.fn()}
                onCreate={jest.fn()}
                onEdit={jest.fn()}
            />
        );

        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "   " } });

        expect(screen.getByText("Save").closest("button")?.hasAttribute("disabled")).toBe(true);
    });

    it("Save is enabled for a non-blank title", () => {
        render(
            <TaskCardDrawer
                open
                mode="create"
                card={null}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={jest.fn()}
                onCreate={jest.fn()}
                onEdit={jest.fn()}
            />
        );

        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New task" } });

        expect(screen.getByText("Save").closest("button")?.hasAttribute("disabled")).toBe(false);
    });

    it("submitting in 'create' mode calls onCreate with trimmed values", () => {
        const onCreate = jest.fn();
        render(
            <TaskCardDrawer
                open
                mode="create"
                card={null}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={jest.fn()}
                onCreate={onCreate}
                onEdit={jest.fn()}
            />
        );

        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  New task  " } });
        fireEvent.change(screen.getByLabelText("Description"), { target: { value: "  details  " } });
        fireEvent.click(screen.getByTestId("task-card-priority-RED"));
        fireEvent.click(screen.getByText("Save"));

        expect(onCreate).toHaveBeenCalledWith({ title: "New task", description: "details", priority: "RED" });
    });

    it("submitting in 'edit' mode calls onEdit(card.id, values)", () => {
        const onEdit = jest.fn();
        const card = makeCard();
        render(
            <TaskCardDrawer
                open
                mode="edit"
                card={card}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={jest.fn()}
                onCreate={jest.fn()}
                onEdit={onEdit}
            />
        );

        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated title" } });
        fireEvent.click(screen.getByText("Save"));

        expect(onEdit).toHaveBeenCalledWith(card.id, {
            title: "Updated title",
            description: card.description,
            priority: card.priority,
        });
    });

    it("clicking Edit from 'view' mode calls onRequestEdit", () => {
        const onRequestEdit = jest.fn();
        render(
            <TaskCardDrawer
                open
                mode="view"
                card={makeCard()}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={onRequestEdit}
                onRequestDelete={jest.fn()}
                onCreate={jest.fn()}
                onEdit={jest.fn()}
            />
        );

        fireEvent.click(screen.getByText("Edit"));

        expect(onRequestEdit).toHaveBeenCalledTimes(1);
    });

    it("clicking Delete from 'view' mode calls onRequestDelete", () => {
        const onRequestDelete = jest.fn();
        render(
            <TaskCardDrawer
                open
                mode="view"
                card={makeCard()}
                submitting={false}
                onClose={jest.fn()}
                onRequestEdit={jest.fn()}
                onRequestDelete={onRequestDelete}
                onCreate={jest.fn()}
                onEdit={jest.fn()}
            />
        );

        fireEvent.click(screen.getByText("Delete"));

        expect(onRequestDelete).toHaveBeenCalledTimes(1);
    });
});
