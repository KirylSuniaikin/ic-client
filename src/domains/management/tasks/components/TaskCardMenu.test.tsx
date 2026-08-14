import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCardMenu from "./TaskCardMenu";

describe("TaskCardMenu", () => {
    it("renders exactly 3 priority options when opened", () => {
        render(<TaskCardMenu cardId={1} priority="GREEN" onSelect={jest.fn()} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));

        expect(screen.getByText("Green")).toBeTruthy();
        expect(screen.getByText("Yellow")).toBeTruthy();
        expect(screen.getByText("Red")).toBeTruthy();
    });

    it("clicking Green calls onSelect with GREEN exactly once", () => {
        const onSelect = jest.fn();
        render(<TaskCardMenu cardId={1} priority="RED" onSelect={onSelect} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        fireEvent.click(screen.getByText("Green"));

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith("GREEN");
    });

    it("clicking Yellow calls onSelect with YELLOW exactly once", () => {
        const onSelect = jest.fn();
        render(<TaskCardMenu cardId={1} priority="GREEN" onSelect={onSelect} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        fireEvent.click(screen.getByText("Yellow"));

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith("YELLOW");
    });

    it("clicking Red calls onSelect with RED exactly once", () => {
        const onSelect = jest.fn();
        render(<TaskCardMenu cardId={1} priority="GREEN" onSelect={onSelect} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        fireEvent.click(screen.getByText("Red"));

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith("RED");
    });

    it("offers no Delete entry when onDelete is omitted", () => {
        render(<TaskCardMenu cardId={1} priority="GREEN" onSelect={jest.fn()} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));

        expect(screen.queryByTestId("task-card-delete-1")).toBeNull();
    });

    it("clicking Delete calls onDelete exactly once and never changes priority", () => {
        const onDelete = jest.fn();
        const onSelect = jest.fn();
        render(<TaskCardMenu cardId={1} priority="GREEN" onSelect={onSelect} onDelete={onDelete} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        fireEvent.click(screen.getByTestId("task-card-delete-1"));

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("disables the trigger button when disabled is true", () => {
        render(<TaskCardMenu cardId={1} priority="GREEN" disabled onSelect={jest.fn()} />);

        expect(screen.getByTestId("task-card-menu-button-1").hasAttribute("disabled")).toBe(true);
    });
});
