import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
    TaskCardAttachmentsField,
    MAX_TASK_CARD_ATTACHMENTS,
} from "./TaskCardAttachmentsField";
import type { TaskCardAttachmentMeta } from "../types";
import {
    deleteTaskCardAttachment,
    downloadTaskCardAttachment,
    fetchTaskCardAttachments,
    uploadTaskCardAttachment,
} from "../../../../shared/api/management";

jest.mock("../../../../shared/api/management");

const mockFetchTaskCardAttachments = jest.mocked(fetchTaskCardAttachments);
const mockUploadTaskCardAttachment = jest.mocked(uploadTaskCardAttachment);
const mockDownloadTaskCardAttachment = jest.mocked(downloadTaskCardAttachment);
const mockDeleteTaskCardAttachment = jest.mocked(deleteTaskCardAttachment);

function makeAttachment(overrides: Partial<TaskCardAttachmentMeta> = {}): TaskCardAttachmentMeta {
    return {
        id: 1,
        taskCardId: 5,
        filename: "invoice.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048,
        createdAt: "2026-08-12T10:00:00",
        ...overrides,
    };
}

function pickFiles(cardIdLabel: number | "new", files: File[]): void {
    const input = screen.getByTestId(`task-attachments-input-${cardIdLabel}`);
    fireEvent.change(input, { target: { files } });
}

describe("TaskCardAttachmentsField", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("create mode (cardId null)", () => {
        it("shows an empty state and does not fetch when there is no server id yet", () => {
            render(
                <TaskCardAttachmentsField cardId={null} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            expect(screen.getByTestId("task-attachments-empty-new")).toBeTruthy();
            expect(mockFetchTaskCardAttachments).not.toHaveBeenCalled();
        });

        it("reports a valid picked file back through onPendingFilesChange without uploading", async () => {
            const onPendingFilesChange = jest.fn();
            render(
                <TaskCardAttachmentsField cardId={null} pendingFiles={[]} onPendingFilesChange={onPendingFilesChange} />
            );

            const file = new File(["hello"], "notes.txt", { type: "text/plain" });
            pickFiles("new", [file]);

            await waitFor(() => expect(onPendingFilesChange).toHaveBeenCalledWith([file]));
            expect(mockUploadTaskCardAttachment).not.toHaveBeenCalled();
        });

        it("renders picked pending files with a remove action", () => {
            const file = new File(["hello"], "notes.txt", { type: "text/plain" });
            const onPendingFilesChange = jest.fn();
            render(
                <TaskCardAttachmentsField cardId={null} pendingFiles={[file]} onPendingFilesChange={onPendingFilesChange} />
            );

            expect(screen.getByText("notes.txt")).toBeTruthy();

            fireEvent.click(screen.getByTestId("task-attachments-remove-pending-0"));

            expect(onPendingFilesChange).toHaveBeenCalledWith([]);
        });

        it("rejects an oversize file client-side without calling onPendingFilesChange", async () => {
            const onPendingFilesChange = jest.fn();
            render(
                <TaskCardAttachmentsField cardId={null} pendingFiles={[]} onPendingFilesChange={onPendingFilesChange} />
            );

            const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
            pickFiles("new", [bigFile]);

            expect(await screen.findByTestId("task-attachments-error-new")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-error-new").textContent).toContain("larger than 10MB");
            expect(onPendingFilesChange).not.toHaveBeenCalled();
        });

        it("rejects a disallowed file type client-side without calling onPendingFilesChange", async () => {
            const onPendingFilesChange = jest.fn();
            render(
                <TaskCardAttachmentsField cardId={null} pendingFiles={[]} onPendingFilesChange={onPendingFilesChange} />
            );

            const badFile = new File(["x"], "script.exe", { type: "application/octet-stream" });
            pickFiles("new", [badFile]);

            expect(await screen.findByTestId("task-attachments-error-new")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-error-new").textContent).toContain("not an allowed file type");
            expect(onPendingFilesChange).not.toHaveBeenCalled();
        });

        it("hides the Add files button and shows a caption once 10 pending files are held", () => {
            const pendingFiles = Array.from({ length: MAX_TASK_CARD_ATTACHMENTS }, (_, i) =>
                new File(["x"], `file-${i}.txt`, { type: "text/plain" })
            );
            render(
                <TaskCardAttachmentsField cardId={null} pendingFiles={pendingFiles} onPendingFilesChange={jest.fn()} />
            );

            expect(screen.queryByTestId("task-attachments-add-new")).toBeNull();
            expect(screen.getByTestId("task-attachments-cap-new").textContent).toContain("Maximum of 10 files reached");
        });
    });

    describe("edit mode (cardId set, not read-only)", () => {
        it("fetches and renders the attachment list on mount", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([makeAttachment()]);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            expect(await screen.findByText("invoice.pdf")).toBeTruthy();
            expect(mockFetchTaskCardAttachments).toHaveBeenCalledWith(5);
        });

        it("shows an empty state when the card has no attachments", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([]);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            expect(await screen.findByTestId("task-attachments-empty-5")).toBeTruthy();
        });

        it("renders every fetched attachment as its own row with a human-readable size", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([
                makeAttachment({ id: 1, filename: "small.txt", sizeBytes: 512 }),
                makeAttachment({ id: 2, filename: "invoice.pdf", sizeBytes: 2048 }),
                makeAttachment({ id: 3, filename: "photo.png", sizeBytes: 3 * 1024 * 1024 }),
            ]);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            expect(await screen.findByTestId("task-attachments-item-1")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-item-2")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-item-3")).toBeTruthy();
            expect(screen.getByText("small.txt")).toBeTruthy();
            expect(screen.getByText("invoice.pdf")).toBeTruthy();
            expect(screen.getByText("photo.png")).toBeTruthy();
            // Bytes stay in "B", kilobyte-range rounds to one decimal in "KB", megabyte-range in "MB".
            expect(screen.getByText("512 B")).toBeTruthy();
            expect(screen.getByText("2.0 KB")).toBeTruthy();
            expect(screen.getByText("3.0 MB")).toBeTruthy();
        });

        it("uploads a valid picked file and refetches the list", async () => {
            mockFetchTaskCardAttachments
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([makeAttachment()]);
            mockUploadTaskCardAttachment.mockResolvedValue(makeAttachment());

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            await screen.findByTestId("task-attachments-empty-5");

            const file = new File(["x"], "invoice.pdf", { type: "application/pdf" });
            pickFiles(5, [file]);

            await waitFor(() => expect(mockUploadTaskCardAttachment).toHaveBeenCalledWith(5, file));
            expect(await screen.findByText("invoice.pdf")).toBeTruthy();
        });

        it("rejects an oversize file client-side before ever calling uploadTaskCardAttachment", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([]);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            await screen.findByTestId("task-attachments-empty-5");

            const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
            pickFiles(5, [bigFile]);

            expect(await screen.findByTestId("task-attachments-error-5")).toBeTruthy();
            expect(mockUploadTaskCardAttachment).not.toHaveBeenCalled();
        });

        it("rejects a disallowed file type client-side before ever calling uploadTaskCardAttachment", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([]);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            await screen.findByTestId("task-attachments-empty-5");

            const badFile = new File(["x"], "script.exe", { type: "application/octet-stream" });
            pickFiles(5, [badFile]);

            expect(await screen.findByTestId("task-attachments-error-5")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-error-5").textContent).toContain("not an allowed file type");
            expect(mockUploadTaskCardAttachment).not.toHaveBeenCalled();
        });

        it("surfaces a server-side upload rejection gracefully instead of throwing", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([]);
            mockUploadTaskCardAttachment.mockRejectedValue(new Error("Response: 400"));

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            await screen.findByTestId("task-attachments-empty-5");

            const file = new File(["x"], "invoice.pdf", { type: "application/pdf" });
            pickFiles(5, [file]);

            expect(await screen.findByTestId("task-attachments-error-5")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-error-5").textContent).toContain("Response: 400");
        });

        it("downloads a file when its download button is clicked", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([makeAttachment({ id: 9, filename: "invoice.pdf" })]);
            mockDownloadTaskCardAttachment.mockResolvedValue(undefined);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            fireEvent.click(await screen.findByTestId("task-attachments-download-9"));

            await waitFor(() => expect(mockDownloadTaskCardAttachment).toHaveBeenCalledWith(5, 9, "invoice.pdf"));
        });

        it("deletes a file only after a second confirming click", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([makeAttachment({ id: 9 })]);
            mockDeleteTaskCardAttachment.mockResolvedValue(undefined);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            fireEvent.click(await screen.findByTestId("task-attachments-delete-9"));
            expect(mockDeleteTaskCardAttachment).not.toHaveBeenCalled();

            fireEvent.click(screen.getByTestId("task-attachments-confirm-delete-9"));

            await waitFor(() => expect(mockDeleteTaskCardAttachment).toHaveBeenCalledWith(5, 9));
            await waitFor(() => expect(screen.queryByTestId("task-attachments-item-9")).toBeNull());
        });

        it("cancelling the delete confirm leaves the file in place", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([makeAttachment({ id: 9 })]);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            fireEvent.click(await screen.findByTestId("task-attachments-delete-9"));
            fireEvent.click(screen.getByTestId("task-attachments-cancel-delete-9"));

            expect(mockDeleteTaskCardAttachment).not.toHaveBeenCalled();
            expect(screen.getByTestId("task-attachments-item-9")).toBeTruthy();
        });

        it("hides the Add files button and shows a caption once the server list holds 10 files", async () => {
            const attachments = Array.from({ length: MAX_TASK_CARD_ATTACHMENTS }, (_, i) =>
                makeAttachment({ id: i + 1, filename: `file-${i}.txt` })
            );
            mockFetchTaskCardAttachments.mockResolvedValue(attachments);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            await screen.findByText("file-0.txt");

            expect(screen.queryByTestId("task-attachments-add-5")).toBeNull();
            expect(screen.getByTestId("task-attachments-cap-5").textContent).toContain("Maximum of 10 files reached");
        });

        it("only uploads as many files as remain under the 10-file cap and reports the overflow", async () => {
            const nineAttachments = Array.from({ length: 9 }, (_, i) =>
                makeAttachment({ id: i + 1, filename: `file-${i}.txt` })
            );
            mockFetchTaskCardAttachments
                .mockResolvedValueOnce(nineAttachments)
                .mockResolvedValueOnce([...nineAttachments, makeAttachment({ id: 10, filename: "keep.txt" })]);
            mockUploadTaskCardAttachment.mockResolvedValue(makeAttachment({ id: 10, filename: "keep.txt" }));

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} />
            );

            await screen.findByText("file-0.txt");

            const keep = new File(["a"], "keep.txt", { type: "text/plain" });
            const overflow = new File(["b"], "overflow.txt", { type: "text/plain" });
            pickFiles(5, [keep, overflow]);

            await waitFor(() => expect(mockUploadTaskCardAttachment).toHaveBeenCalledTimes(1));
            expect(mockUploadTaskCardAttachment).toHaveBeenCalledWith(5, keep);

            expect(await screen.findByTestId("task-attachments-error-5")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-error-5").textContent).toContain(
                "Only 10 files are allowed per card"
            );
        });
    });

    describe("readOnly (view mode)", () => {
        it("renders the list with a download action but no add/delete affordances", async () => {
            mockFetchTaskCardAttachments.mockResolvedValue([makeAttachment({ id: 9 })]);

            render(
                <TaskCardAttachmentsField cardId={5} pendingFiles={[]} onPendingFilesChange={jest.fn()} readOnly />
            );

            expect(await screen.findByText("invoice.pdf")).toBeTruthy();
            expect(screen.getByTestId("task-attachments-download-9")).toBeTruthy();
            expect(screen.queryByTestId("task-attachments-delete-9")).toBeNull();
            expect(screen.queryByTestId("task-attachments-add-5")).toBeNull();
            expect(screen.queryByTestId("task-attachments-input-5")).toBeNull();
        });
    });
});
