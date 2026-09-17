import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCardMenu from "./TaskCardMenu";

describe("TaskCardMenu", () => {
    it("has an aria-label of 'Card actions' on the trigger button", () => {
        render(<TaskCardMenu cardId={1} onEdit={jest.fn()} />);

        expect(screen.getByTestId("task-card-menu-button-1").getAttribute("aria-label")).toBe("Card actions");
    });

    it("shows exactly one Edit item when opened", () => {
        render(<TaskCardMenu cardId={1} onEdit={jest.fn()} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));

        expect(screen.getByTestId("task-card-edit-1")).toBeTruthy();
        expect(screen.getAllByText("Edit")).toHaveLength(1);
    });

    it("clicking Edit calls onEdit exactly once", () => {
        const onEdit = jest.fn();
        render(<TaskCardMenu cardId={1} onEdit={onEdit} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        fireEvent.click(screen.getByTestId("task-card-edit-1"));

        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("offers no Delete entry when onDelete is omitted", () => {
        render(<TaskCardMenu cardId={1} onEdit={jest.fn()} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));

        expect(screen.queryByTestId("task-card-delete-1")).toBeNull();
    });

    it("shows Edit above a divider above Delete when onDelete is provided", () => {
        render(<TaskCardMenu cardId={1} onEdit={jest.fn()} onDelete={jest.fn()} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));

        expect(screen.getByTestId("task-card-edit-1")).toBeTruthy();
        expect(screen.getByTestId("task-card-delete-1")).toBeTruthy();
        expect(screen.getByRole("separator")).toBeTruthy();
    });

    it("clicking Delete calls onDelete exactly once and never calls onEdit", () => {
        const onDelete = jest.fn();
        const onEdit = jest.fn();
        render(<TaskCardMenu cardId={1} onEdit={onEdit} onDelete={onDelete} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        fireEvent.click(screen.getByTestId("task-card-delete-1"));

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onEdit).not.toHaveBeenCalled();
    });

    it("disables the trigger button when disabled is true", () => {
        render(<TaskCardMenu cardId={1} disabled onEdit={jest.fn()} />);

        expect(screen.getByTestId("task-card-menu-button-1").hasAttribute("disabled")).toBe(true);
    });
});
