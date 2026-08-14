import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { downscaleImage } from "../utils/imageCompress";
import { logger } from "../utils/logger";
import { EntityPhotoViewer } from "./EntityPhotoViewer";

export type PhotoPatch = {
    pendingImage: Blob | null;
    removeImage: boolean;
};

type Props = {
    /** Stable client-side key for this row — only used to scope testids and the file input. */
    rowKey: string;
    /** Server id, or null while the row has not been saved yet. */
    serverId: number | null;
    hasImage: boolean;
    pendingImage: Blob | null;
    removeImage: boolean;
    onChange: (patch: PhotoPatch) => void;
    fetchImage: (serverId: number) => Promise<Blob | null>;
    /** Prefix for every data-testid this renders, e.g. "invoice-image". */
    testIdPrefix: string;
    /** Lowercase noun for aria-labels, e.g. "invoice photo". */
    label: string;
    /** Heading for the full-size viewer, e.g. "Invoice photo". */
    viewerTitle: string;
};

/**
 * Capture / preview / remove one photo attached to a row.
 *
 * The photo is NOT uploaded here. A brand-new row has no server id until its parent is saved, so
 * the compressed blob is held on the row and uploaded afterwards, once the save response maps the
 * client's row key to a server id. One code path for new and existing rows alike.
 *
 * Domain-agnostic on purpose: purchase invoices and accounting entries both need exactly this, and
 * a second copy would be the one that quietly stops revoking its object URLs.
 */
export function EntityPhotoField({
                                     rowKey,
                                     serverId,
                                     hasImage,
                                     pendingImage,
                                     removeImage,
                                     onChange,
                                     fetchImage,
                                     testIdPrefix,
                                     label,
                                     viewerTitle,
                                 }: Props) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Derived from the blob rather than stored on the row: an object URL kept in shared state
    // outlives the component that made it and leaks when its row is deleted. Here the effect
    // cleanup revokes it on unmount AND whenever the blob is replaced.
    useEffect(() => {
        if (!pendingImage) {
            setPreviewUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(pendingImage);
        setPreviewUrl(objectUrl);
        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [pendingImage]);

    const storedPhotoAvailable = hasImage && !removeImage && !pendingImage;
    const anyPhoto = pendingImage != null || storedPhotoAvailable;

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = e.target.files?.[0];
        // Reset immediately so re-picking the SAME file still fires a change event.
        e.target.value = "";
        if (!file) return;

        setBusy(true);
        setError(null);
        try {
            const compressed = await downscaleImage(file);
            onChange({ pendingImage: compressed, removeImage: false });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Could not process that image";
            setError(msg);
            logger.error(msg);
        } finally {
            setBusy(false);
        }
    }

    function handleRemove(): void {
        // Clearing a pending blob is local; clearing a stored one has to be flagged so the save
        // can issue the DELETE afterwards.
        onChange({ pendingImage: null, removeImage: hasImage });
    }

    return (
        <Stack direction="row" alignItems="center" gap={0.5}>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                data-testid={`${testIdPrefix}-input-${rowKey}`}
                onChange={handleFileChange}
            />

            {previewUrl ? (
                <Tooltip title="View photo">
                    <Box
                        component="img"
                        src={previewUrl}
                        alt={viewerTitle}
                        data-testid={`${testIdPrefix}-thumb-${rowKey}`}
                        onClick={() => setViewerOpen(true)}
                        sx={{ width: 36, height: 36, objectFit: "cover", borderRadius: 1, cursor: "pointer" }}
                    />
                </Tooltip>
            ) : (
                <Tooltip title={storedPhotoAvailable ? "View photo" : `Upload ${label}`}>
                    <IconButton
                        size="small"
                        aria-label={storedPhotoAvailable ? `view ${label}` : `upload ${label}`}
                        disabled={busy}
                        onClick={() => (storedPhotoAvailable ? setViewerOpen(true) : inputRef.current?.click())}
                        sx={{ color: storedPhotoAvailable ? "success.main" : "text.secondary" }}
                    >
                        {/* A camera icon on an empty slot reads as "a photo lives here", not "put one
                            here" — an upload arrow says what the control actually wants. Once a photo
                            exists the green camera is right: it now IS a photo, and viewing is what
                            the button does. */}
                        {storedPhotoAvailable
                            ? <PhotoCameraOutlinedIcon fontSize="small" />
                            : <FileUploadOutlinedIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            )}

            {/* A small ✕, not a bin: a row can already show a bin for itself and one for its parent,
                and a third identical bin here made "remove photo" look like another way to delete
                data. */}
            {anyPhoto && (
                <Tooltip title="Remove photo">
                    <IconButton
                        size="small"
                        aria-label={`remove ${label}`}
                        onClick={handleRemove}
                        sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "text.primary" } }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            )}

            {error && (
                <Typography variant="caption" color="error" data-testid={`${testIdPrefix}-error-${rowKey}`}>
                    {error}
                </Typography>
            )}

            <EntityPhotoViewer
                open={viewerOpen}
                onClose={() => setViewerOpen(false)}
                blob={pendingImage}
                serverId={serverId}
                fetchImage={fetchImage}
                title={viewerTitle}
                testIdPrefix={testIdPrefix}
            />
        </Stack>
    );
}
