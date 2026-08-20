import { jest, describe, it, expect, beforeAll, afterAll, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCardDrawer from "./TaskCardDrawer";
import type { TaskCard } from "../types";
import { fetchTaskCardImage } from "../../../../shared/api/management";

// Only ViewModePhoto (view mode, hasImage: true) reaches this module at all — create/edit mode
// mounts TaskCardImageField, which does not fetch until its viewer is opened.
jest.mock("../../../../shared/api/management");
const mockFetchTaskCardImage = jest.mocked(fetchTaskCardImage);

// jsdom implements neither of these — same stub TaskCardImageField.test.tsx installs, needed here
// because ViewModePhoto (view mode, hasImage: true) turns the fetched blob into an object URL.
const originalCreateObjectUrl = (globalThis.URL as any).createObjectURL;
const originalRevokeObjectUrl = (globalThis.URL as any).revokeObjectURL;

beforeAll(() => {
    (globalThis.URL as any).createObjectURL = (_blob: Blob): string => "blob:test-1";
    (globalThis.URL as any).revokeObjectURL = (): void => {};
});

afterAll(() => {
    (globalThis.URL as any).createObjectURL = originalCreateObjectUrl;
    (globalThis.URL as any).revokeObjectURL = originalRevokeObjectUrl;
});

// jsdom implements no `matchMedia` at all, so MUI's `useMediaQuery` falls back to its
// `defaultMatches` (false) — i.e. every other test in this file renders the desktop dialog.
// Installing a stub is the only way to drive the phone branch.
function stubViewportAsMobile(matches: boolean): void {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    });
}

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
        deadline: null,
        hasImage: false,
        ...overrides,
    };
}

describe("TaskCardDrawer", () => {
    afterEach(() => {
        // Leaving a stub installed would silently flip every later test to the phone branch.
        Reflect.deleteProperty(window, "matchMedia");
    });

    describe("responsive presentation", () => {
        function renderView(): void {
            render(
                <TaskCardDrawer
                    open
                    mode="view"
                    card={makeCard()}
                    submitting={false}
                    onClose={jest.fn()}
                    onRequestEdit={jest.fn()}
                    onRequestDelete={jest.fn()}
                    onCreate={jest.fn()}
                    onEdit={jest.fn()}
                />
            );
        }

        it("renders a centred dialog on desktop, not a bottom sheet", () => {
            stubViewportAsMobile(false);

            renderView();

            expect(document.querySelector(".MuiDialog-root")).toBeTruthy();
            expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        });

        it("renders a bottom sheet on a phone, keeping the drag handle", () => {
            stubViewportAsMobile(true);

            renderView();

            expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();
            expect(document.querySelector(".MuiDialog-root")).toBeNull();
        });

        it("shows the same content in both presentations", () => {
            stubViewportAsMobile(true);

            renderView();

            expect(screen.getByTestId("task-card-drawer")).toBeTruthy();
            expect(screen.getByText("Restock mozzarella")).toBeTruthy();
            expect(screen.getByText("Edit")).toBeTruthy();
            expect(screen.getByText("Delete")).toBeTruthy();
        });
    });

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

        expect(onCreate).toHaveBeenCalledWith({
            title: "New task",
            description: "details",
            priority: "RED",
            deadline: null,
            pendingImage: null,
            removeImage: false,
        });
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
            deadline: card.deadline,
            pendingImage: null,
            removeImage: false,
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

    // MUI X v7's DatePicker field renders a sectioned role="group" widget, not a plain labelled
    // <input> — the formatted value lives on a hidden aria-hidden <input> that mirrors the
    // sections, mirroring the pattern PurchaseTablePopup.test.tsx already uses for its DatePickers.
    function deadlineInputValue(): string {
        const input = document.querySelector('input[aria-hidden="true"]') as HTMLInputElement | null;
        return input?.value ?? "";
    }

    describe("deadline", () => {
        afterEach(() => {
            jest.clearAllMocks();
        });

        // Regression: ROUNDED_FIELD once styled only `.MuiOutlinedInput-root`, but from v7 the
        // pickers render their own field DOM, so the deadline sat square and transparent beside the
        // rounded cream Title/Description. A CSS selector that matches nothing throws nothing, so
        // only asserting the class the styles are actually keyed to can catch a silent regression.
        it("renders the deadline field with the picker shell ROUNDED_FIELD targets", () => {
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

            const pickerShell = document.querySelector(".MuiPickersOutlinedInput-root");

            expect(pickerShell).not.toBeNull();
            expect(pickerShell?.querySelector("fieldset")).not.toBeNull();
        });

        it("seeds the DatePicker from the card in edit mode and echoes it back on save", () => {
            const onEdit = jest.fn();
            const card = makeCard({ deadline: "2026-08-25" });
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

            expect(deadlineInputValue()).toBe("25.08.2026");

            fireEvent.click(screen.getByText("Save"));

            expect(onEdit).toHaveBeenCalledWith(card.id, expect.objectContaining({ deadline: "2026-08-25" }));
        });

        it("clears the deadline to null via the field's clear control", () => {
            const onEdit = jest.fn();
            const card = makeCard({ deadline: "2026-08-25" });
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

            // MUI X's field clear button carries a `title`, not an `aria-label`.
            fireEvent.click(screen.getByTitle("Clear"));
            fireEvent.click(screen.getByText("Save"));

            expect(onEdit).toHaveBeenCalledWith(card.id, expect.objectContaining({ deadline: null }));
        });

        it("seeds an empty DatePicker on create", () => {
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

            expect(deadlineInputValue()).toBe("");
        });

        it("shows a read-only deadline line in view mode when the card has one", () => {
            render(
                <TaskCardDrawer
                    open
                    mode="view"
                    card={makeCard({ deadline: "2026-08-25" })}
                    submitting={false}
                    onClose={jest.fn()}
                    onRequestEdit={jest.fn()}
                    onRequestDelete={jest.fn()}
                    onCreate={jest.fn()}
                    onEdit={jest.fn()}
                />
            );

            expect(screen.getByText("25.08.2026")).toBeTruthy();
        });

        it("shows no deadline line in view mode when the card has none", () => {
            render(
                <TaskCardDrawer
                    open
                    mode="view"
                    card={makeCard({ deadline: null })}
                    submitting={false}
                    onClose={jest.fn()}
                    onRequestEdit={jest.fn()}
                    onRequestDelete={jest.fn()}
                    onCreate={jest.fn()}
                    onEdit={jest.fn()}
                />
            );

            expect(screen.queryByText(/^\d{2}\.\d{2}\.\d{4}$/)).toBeNull();
        });
    });

    describe("photo", () => {
        afterEach(() => {
            jest.clearAllMocks();
        });

        it("shows the photo field in create mode", () => {
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

            expect(screen.getByLabelText("upload task photo")).toBeTruthy();
        });

        it("shows the photo field in edit mode, offering a view control when the card already has a photo", () => {
            mockFetchTaskCardImage.mockResolvedValue(null);
            render(
                <TaskCardDrawer
                    open
                    mode="edit"
                    card={makeCard({ hasImage: true })}
                    submitting={false}
                    onClose={jest.fn()}
                    onRequestEdit={jest.fn()}
                    onRequestDelete={jest.fn()}
                    onCreate={jest.fn()}
                    onEdit={jest.fn()}
                />
            );

            expect(screen.getByLabelText("view task photo")).toBeTruthy();
        });

        it("view mode fetches and renders a clickable thumbnail when the card has a photo", async () => {
            mockFetchTaskCardImage.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
            render(
                <TaskCardDrawer
                    open
                    mode="view"
                    card={makeCard({ hasImage: true })}
                    submitting={false}
                    onClose={jest.fn()}
                    onRequestEdit={jest.fn()}
                    onRequestDelete={jest.fn()}
                    onCreate={jest.fn()}
                    onEdit={jest.fn()}
                />
            );

            expect(await screen.findByTestId("task-image-view-1")).toBeTruthy();
        });

        it("view mode renders no photo when the card has none", () => {
            render(
                <TaskCardDrawer
                    open
                    mode="view"
                    card={makeCard({ hasImage: false })}
                    submitting={false}
                    onClose={jest.fn()}
                    onRequestEdit={jest.fn()}
                    onRequestDelete={jest.fn()}
                    onCreate={jest.fn()}
                    onEdit={jest.fn()}
                />
            );

            expect(mockFetchTaskCardImage).not.toHaveBeenCalled();
            expect(screen.queryByTestId("task-image-view-1")).toBeNull();
        });
    });
});
