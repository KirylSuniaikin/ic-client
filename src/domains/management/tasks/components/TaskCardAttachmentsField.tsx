// Assumed: pendingFiles/onPendingFilesChange are controlled props (mirroring
// TaskCardImageField's pendingImage/onChange), not local state owned by this component —
// task-spec-C.md's prop list is "something like { cardId }", and lifting the pending list into
// TaskCardDrawer's form state is what lets handleSave read it alongside pendingImage, matching
// this codebase's established pattern for deferred-upload fields (EntityPhotoField).
import React, { useEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { LoadingIndicator } from "../../../../shared/components/LoadingIndicator";
import { logger } from "../../../../shared/utils/logger";
import {
    deleteTaskCardAttachment,
    downloadTaskCardAttachment,
    fetchTaskCardAttachments,
    uploadTaskCardAttachment,
} from "../../../../shared/api/management";
import type { TaskCardAttachmentMeta } from "../types";

export const MAX_TASK_CARD_ATTACHMENTS = 10;
export const MAX_TASK_CARD_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TASK_CARD_ATTACHMENT_EXTENSIONS = [
    "txt", "pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "webp",
];
const ACCEPT_ATTRIBUTE = ALLOWED_TASK_CARD_ATTACHMENT_EXTENSIONS.map(ext => `.${ext}`).join(",");

export type TaskCardAttachmentsFieldProps = {
    /** Server id, or null while the card has not been saved yet. */
    cardId: number | null;
    /** Locally-held files awaiting upload; only meaningful while cardId is null. */
    pendingFiles: File[];
    onPendingFilesChange: (files: File[]) => void;
    /** View mode: list + download only, no add/delete affordances. */
    readOnly?: boolean;
};

const ROW_SX = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 1,
    py: 0.5,
    borderRadius: "8px",
    backgroundColor: "#fbfaf6",
    border: "1px solid rgba(15,23,42,0.06)",
} as const;

function extensionOf(filename: string): string {
    const idx = filename.lastIndexOf(".");
    return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
}

function iconFor(filename: string, contentType: string): JSX.Element {
    const ext = extensionOf(filename);
    if (ext === "pdf" || contentType === "application/pdf") return <PictureAsPdfOutlinedIcon fontSize="small" />;
    if (["jpg", "jpeg", "png", "webp"].includes(ext) || contentType.startsWith("image/")) {
        return <ImageOutlinedIcon fontSize="small" />;
    }
    if (["doc", "docx", "xls", "xlsx"].includes(ext)) return <DescriptionOutlinedIcon fontSize="small" />;
    return <InsertDriveFileOutlinedIcon fontSize="small" />;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** Best-effort UX only — the server remains the source of truth and its own rejection must still
 * be handled gracefully (see the catch block in handleFilesPicked below). */
function validateFile(file: File): string | null {
    if (file.size > MAX_TASK_CARD_ATTACHMENT_SIZE_BYTES) return `"${file.name}" is larger than 10MB`;
    if (!ALLOWED_TASK_CARD_ATTACHMENT_EXTENSIONS.includes(extensionOf(file.name))) {
        return `"${file.name}" is not an allowed file type`;
    }
    return null;
}

/**
 * Multi-file attachments list for one task card.
 *
 * Edit/view mode (cardId is a real number): fetches the list from the server on mount and keeps
 * it in local state; uploads/deletes act directly against the server. Create mode (cardId is
 * null): nothing can be uploaded yet, so picked files are simply reported back to the parent via
 * onPendingFilesChange, mirroring TaskCardImageField's deferred-upload pattern — the parent is
 * responsible for uploading them once the card has a real id (see TaskBoardPanel/useTaskBoard).
 */
export function TaskCardAttachmentsField({
    cardId,
    pendingFiles,
    onPendingFilesChange,
    readOnly = false,
}: TaskCardAttachmentsFieldProps): JSX.Element {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [attachments, setAttachments] = useState<TaskCardAttachmentMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const idBase = cardId ?? "new";

    useEffect(() => {
        if (cardId === null) {
            setAttachments([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void (async (): Promise<void> => {
            try {
                const list = await fetchTaskCardAttachments(cardId);
                if (!cancelled) setAttachments(list);
            } catch (err) {
                if (!cancelled) {
                    logger.error("Failed to load task card attachments:", err);
                    setError(err instanceof Error ? err.message : "Failed to load attachments");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [cardId]);

    const currentCount = cardId === null ? pendingFiles.length : attachments.length;
    const atCap = currentCount >= MAX_TASK_CARD_ATTACHMENTS;

    async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
        const picked = Array.from(e.target.files ?? []);
        // Reset immediately so re-picking the SAME file still fires a change event.
        e.target.value = "";
        if (picked.length === 0) return;

        const messages: string[] = [];
        const remainingSlots = Math.max(MAX_TASK_CARD_ATTACHMENTS - currentCount, 0);
        const withinCap = picked.slice(0, remainingSlots);
        if (picked.length > withinCap.length) {
            messages.push(`Only ${MAX_TASK_CARD_ATTACHMENTS} files are allowed per card`);
        }

        const accepted: File[] = [];
        for (const file of withinCap) {
            const validationError = validateFile(file);
            if (validationError) messages.push(validationError);
            else accepted.push(file);
        }

        if (accepted.length === 0) {
            setError(messages.length > 0 ? messages.join("; ") : null);
            return;
        }

        if (cardId === null) {
            onPendingFilesChange([...pendingFiles, ...accepted]);
            setError(messages.length > 0 ? messages.join("; ") : null);
            return;
        }

        setUploading(true);
        for (const file of accepted) {
            try {
                await uploadTaskCardAttachment(cardId, file);
            } catch (err) {
                // The server is authoritative — a client-side pass does not guarantee a 400 never
                // happens (e.g. a stale card at 10 files already). Surface its rejection per file
                // rather than letting it look like the whole card failed to save.
                const msg = err instanceof Error ? err.message : "Upload failed";
                messages.push(`"${file.name}" failed to upload: ${msg}`);
                logger.error(`Failed to upload attachment "${file.name}":`, err);
            }
        }
        try {
            const list = await fetchTaskCardAttachments(cardId);
            setAttachments(list);
        } catch (err) {
            logger.error("Failed to refresh task card attachments:", err);
        }
        setUploading(false);
        setError(messages.length > 0 ? messages.join("; ") : null);
    }

    async function handleDownload(attachment: TaskCardAttachmentMeta): Promise<void> {
        if (cardId === null) return;
        try {
            await downloadTaskCardAttachment(cardId, attachment.id, attachment.filename);
        } catch (err) {
            logger.error("Failed to download task card attachment:", err);
            setError(err instanceof Error ? err.message : "Failed to download attachment");
        }
    }

    async function handleConfirmDelete(attachment: TaskCardAttachmentMeta): Promise<void> {
        if (cardId === null) return;
        try {
            await deleteTaskCardAttachment(cardId, attachment.id);
            setAttachments(prev => prev.filter(a => a.id !== attachment.id));
        } catch (err) {
            logger.error("Failed to delete task card attachment:", err);
            setError(err instanceof Error ? err.message : "Failed to delete attachment");
        } finally {
            setConfirmDeleteId(null);
        }
    }

    function handleRemovePending(index: number): void {
        onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
    }

    function renderPendingRow(file: File, index: number): JSX.Element {
        return (
            <Box key={`pending-${index}`} data-testid={`task-attachments-pending-item-${index}`} sx={ROW_SX}>
                {iconFor(file.name, file.type)}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={file.name}>{file.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatFileSize(file.size)}</Typography>
                </Box>
                <Tooltip title="Remove">
                    <IconButton
                        size="small"
                        aria-label={`remove ${file.name}`}
                        data-testid={`task-attachments-remove-pending-${index}`}
                        onClick={(): void => handleRemovePending(index)}
                    >
                        <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
        );
    }

    function renderServerRow(attachment: TaskCardAttachmentMeta): JSX.Element {
        const isConfirming = confirmDeleteId === attachment.id;
        return (
            <Box key={attachment.id} data-testid={`task-attachments-item-${attachment.id}`} sx={ROW_SX}>
                {iconFor(attachment.filename, attachment.contentType)}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={attachment.filename}>{attachment.filename}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatFileSize(attachment.sizeBytes)}</Typography>
                </Box>
                <Tooltip title="Download">
                    <IconButton
                        size="small"
                        aria-label={`download ${attachment.filename}`}
                        data-testid={`task-attachments-download-${attachment.id}`}
                        onClick={(): void => {
                            void handleDownload(attachment);
                        }}
                    >
                        <DownloadOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                {!readOnly && (
                    isConfirming ? (
                        <>
                            <Tooltip title="Confirm delete">
                                <IconButton
                                    size="small"
                                    aria-label={`confirm delete ${attachment.filename}`}
                                    data-testid={`task-attachments-confirm-delete-${attachment.id}`}
                                    onClick={(): void => {
                                        void handleConfirmDelete(attachment);
                                    }}
                                    sx={{ color: "error.main" }}
                                >
                                    <CheckRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                                <IconButton
                                    size="small"
                                    aria-label="cancel delete"
                                    data-testid={`task-attachments-cancel-delete-${attachment.id}`}
                                    onClick={(): void => setConfirmDeleteId(null)}
                                >
                                    <CloseRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </>
                    ) : (
                        <Tooltip title="Delete">
                            <IconButton
                                size="small"
                                aria-label={`delete ${attachment.filename}`}
                                data-testid={`task-attachments-delete-${attachment.id}`}
                                onClick={(): void => setConfirmDeleteId(attachment.id)}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )
                )}
            </Box>
        );
    }

    const isEmpty = cardId === null ? pendingFiles.length === 0 : attachments.length === 0;

    return (
        <Box data-testid={`task-attachments-${idBase}`}>
            {cardId !== null && loading ? (
                <LoadingIndicator minHeight={40} size={20} testId={`task-attachments-loading-${idBase}`} />
            ) : isEmpty ? (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    data-testid={`task-attachments-empty-${idBase}`}
                    sx={{ mb: 1 }}
                >
                    No files attached
                </Typography>
            ) : (
                <Stack gap={0.75} sx={{ mb: 1 }}>
                    {cardId === null
                        ? pendingFiles.map((file, index) => renderPendingRow(file, index))
                        : attachments.map(a => renderServerRow(a))}
                </Stack>
            )}

            {!readOnly && (
                <>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={ACCEPT_ATTRIBUTE}
                        hidden
                        data-testid={`task-attachments-input-${idBase}`}
                        onChange={(e): void => {
                            void handleFilesPicked(e);
                        }}
                    />
                    {atCap ? (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            data-testid={`task-attachments-cap-${idBase}`}
                        >
                            Maximum of {MAX_TASK_CARD_ATTACHMENTS} files reached
                        </Typography>
                    ) : (
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={uploading}
                            startIcon={<FileUploadOutlinedIcon fontSize="small" />}
                            data-testid={`task-attachments-add-${idBase}`}
                            onClick={(): void => inputRef.current?.click()}
                            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", borderStyle: "dashed" }}
                        >
                            {uploading ? "Uploading…" : "Add files"}
                        </Button>
                    )}
                </>
            )}

            {error && (
                <Typography
                    variant="caption"
                    color="error"
                    data-testid={`task-attachments-error-${idBase}`}
                    sx={{ display: "block", mt: 0.5 }}
                >
                    {error}
                </Typography>
            )}
        </Box>
    );
}
