import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DeleteTaskCardDialog from "./DeleteTaskCardDialog";
import type { TaskCard } from "../types";

const CARD: TaskCard = {
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
};

describe("DeleteTaskCardDialog", () => {
    it("renders the card title in the confirmation copy", () => {
        render(<DeleteTaskCardDialog open card={CARD} submitting={false} onConfirm={jest.fn()} onCancel={jest.fn()} />);

        expect(screen.getByText(/Restock mozzarella/)).toBeTruthy();
    });

    it("calls onConfirm once when Confirm/Delete is clicked", () => {
        const onConfirm = jest.fn();
        render(<DeleteTaskCardDialog open card={CARD} submitting={false} onConfirm={onConfirm} onCancel={jest.fn()} />);

        fireEvent.click(screen.getByText("Delete"));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel once and not onConfirm when Cancel is clicked", () => {
        const onConfirm = jest.fn();
        const onCancel = jest.fn();
        render(<DeleteTaskCardDialog open card={CARD} submitting={false} onConfirm={onConfirm} onCancel={onCancel} />);

        fireEvent.click(screen.getByText("Cancel"));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
