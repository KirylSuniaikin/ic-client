import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { downscaleImage } from "../../../../shared/utils/imageCompress";
import { logger } from "../../../../shared/utils/logger";
import { PurchaseInvoiceRow } from "../types";
import { InvoiceImageViewer } from "./InvoiceImageViewer";

type Props = {
    invoiceId: string;
    serverId: number | null;
    hasImage: boolean;
    pendingImage: Blob | null;
    removeImage: boolean;
    onUpdateInvoice: (invoiceId: string, patch: Partial<PurchaseInvoiceRow>) => void;
};

/**
 * Capture / preview / remove one invoice photo.
 *
 * The photo is NOT uploaded here. A brand-new invoice has no server id until the report is saved,
 * so the compressed blob is held on the invoice row and uploaded afterwards, once the save
 * response maps clientRef -> invoiceId. One code path for new and existing invoices alike.
 */
export function InvoiceImageField({
                                      invoiceId,
                                      serverId,
                                      hasImage,
                                      pendingImage,
                                      removeImage,
                                      onUpdateInvoice,
                                  }: Props) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Derived from the blob rather than stored on the row: an object URL kept in shared state
    // outlives the component that made it and leaks when its invoice is deleted. Here the effect
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
            onUpdateInvoice(invoiceId, { pendingImage: compressed, removeImage: false });
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
        onUpdateInvoice(invoiceId, { pendingImage: null, removeImage: hasImage });
    }

    return (
        <Stack direction="row" alignItems="center" gap={0.5}>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                data-testid={`invoice-image-input-${invoiceId}`}
                onChange={handleFileChange}
            />

            {previewUrl ? (
                <Tooltip title="View photo">
                    <Box
                        component="img"
                        src={previewUrl}
                        alt="Invoice thumbnail"
                        data-testid={`invoice-image-thumb-${invoiceId}`}
                        onClick={() => setViewerOpen(true)}
                        sx={{ width: 36, height: 36, objectFit: "cover", borderRadius: 1, cursor: "pointer" }}
                    />
                </Tooltip>
            ) : (
                <Tooltip title={storedPhotoAvailable ? "View photo" : "Add invoice photo"}>
                    <IconButton
                        size="small"
                        aria-label={storedPhotoAvailable ? "view invoice photo" : "add invoice photo"}
                        disabled={busy}
                        onClick={() => (storedPhotoAvailable ? setViewerOpen(true) : inputRef.current?.click())}
                        sx={{ color: storedPhotoAvailable ? "success.main" : "text.secondary" }}
                    >
                        <PhotoCameraOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}

            {anyPhoto && (
                <Tooltip title="Remove photo">
                    <IconButton size="small" aria-label="remove invoice photo" onClick={handleRemove}>
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}

            {error && (
                <Typography variant="caption" color="error" data-testid={`invoice-image-error-${invoiceId}`}>
                    {error}
                </Typography>
            )}

            <InvoiceImageViewer
                open={viewerOpen}
                onClose={() => setViewerOpen(false)}
                blob={pendingImage}
                invoiceId={serverId}
            />
        </Stack>
    );
}
