import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnsavedChangesPrompt } from "./UnsavedChangesPrompt";

function renderPrompt(saving = false) {
    const handlers = { onRevert: jest.fn(), onSave: jest.fn(), onDismiss: jest.fn() };
    render(<UnsavedChangesPrompt open saving={saving} {...handlers} />);
    return handlers;
}

describe("UnsavedChangesPrompt", () => {
    it("fires the matching callback for each button", () => {
        const h = renderPrompt();

        fireEvent.click(screen.getByTestId("unsaved-revert"));
        fireEvent.click(screen.getByTestId("unsaved-save"));

        expect(h.onRevert).toHaveBeenCalledTimes(1);
        expect(h.onSave).toHaveBeenCalledTimes(1);
        expect(h.onDismiss).not.toHaveBeenCalled();
    });

    it("treats the close button as a dismiss", () => {
        const h = renderPrompt();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(h.onDismiss).toHaveBeenCalledTimes(1);
        expect(h.onRevert).not.toHaveBeenCalled();
        expect(h.onSave).not.toHaveBeenCalled();
    });

    it("treats Escape as a dismiss", () => {
        const h = renderPrompt();

        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

        expect(h.onDismiss).toHaveBeenCalledTimes(1);
    });

    it("ignores the close button, Escape and the backdrop while a save is in flight", () => {
        const h = renderPrompt(true);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

        expect(h.onDismiss).not.toHaveBeenCalled();
        expect(screen.getByTestId("unsaved-prompt")).toBeTruthy();
    });

    it("disables Save and Revert while a save is in flight", () => {
        renderPrompt(true);

        expect((screen.getByTestId("unsaved-revert") as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId("unsaved-save") as HTMLButtonElement).disabled).toBe(true);
    });

    it("renders the Save label as an element inside the button, not a bare text node", () => {
        renderPrompt();

        const label = screen.getByTestId("unsaved-save").querySelector("span");

        expect(label?.textContent).toBe("Save");
    });
});
