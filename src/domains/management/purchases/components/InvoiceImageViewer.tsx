import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Drawer, Typography } from "@mui/material";
import { fetchPurchaseInvoiceImage } from "../../../../shared/api/management";
import { logger } from "../../../../shared/utils/logger";

type Props = {
    open: boolean;
    onClose: () => void;
    /** Not yet uploaded — shown straight from memory, no request. */
    blob: Blob | null;
    /** Server-side invoice; only fetched when there is no local blob. */
    invoiceId: number | null;
};

/**
 * Full-size view of one invoice photo.
 *
 * The image cannot be loaded with a plain <img src="/api/...">: the JWT lives in localStorage and
 * is attached by authFetch, so a browser-issued image request carries no credential and gets a
 * 401. Bytes are fetched, turned into an object URL, and revoked on cleanup.
 */
export function InvoiceImageViewer({ open, onClose, blob, invoiceId }: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        let alive = true;
        let objectUrl: string | null = null;
        setError(null);

        (async () => {
            try {
                let source = blob;
                if (!source) {
                    if (invoiceId == null) return;
                    setLoading(true);
                    source = await fetchPurchaseInvoiceImage(invoiceId);
                }
                if (!alive) return;
                if (!source) {
                    setError("No photo stored for this invoice.");
                    return;
                }
                objectUrl = URL.createObjectURL(source);
                setUrl(objectUrl);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to load the photo";
                if (alive) setError(msg);
                logger.error(msg);
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
            // Object URLs are heap that never frees itself; on an all-day tablet shift these add up.
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setUrl(null);
        };
    }, [open, blob, invoiceId]);

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{ zIndex: 1400 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    maxHeight: "90vh",
                    overflowY: "auto",
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, textAlign: "center" }}>
                    Invoice photo
                </Typography>

                {loading && (
                    <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {error && !loading && (
                    <Typography color="error" sx={{ textAlign: "center", py: 2 }}>{error}</Typography>
                )}

                {url && !loading && (
                    <Box
                        component="img"
                        src={url}
                        alt="Invoice"
                        data-testid="invoice-image-full"
                        sx={{ width: "100%", maxWidth: "100%", borderRadius: 2, display: "block" }}
                    />
                )}

                <Button fullWidth onClick={onClose} sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}>
                    Close
                </Button>
            </Box>
        </Drawer>
    );
}
