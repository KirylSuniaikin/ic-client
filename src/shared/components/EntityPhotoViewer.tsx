import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Drawer, Typography } from "@mui/material";
import { logger } from "../utils/logger";

type Props = {
    open: boolean;
    onClose: () => void;
    /** Not yet uploaded — shown straight from memory, no request. */
    blob: Blob | null;
    /** Server-side row id; only fetched when there is no local blob. */
    serverId: number | null;
    /** Fetches the stored photo. Returns null when the row has none. */
    fetchImage: (serverId: number) => Promise<Blob | null>;
    /** Heading, e.g. "Invoice photo". */
    title: string;
    /** Prefix for the rendered image's data-testid, e.g. "invoice-image". */
    testIdPrefix: string;
};

/**
 * Full-size view of one stored photo, for any entity that has one.
 *
 * The image cannot be loaded with a plain <img src="/api/...">: the JWT lives in localStorage and
 * is attached by authFetch, so a browser-issued image request carries no credential and gets a
 * 401. Bytes are fetched, turned into an object URL, and revoked on cleanup.
 */
export function EntityPhotoViewer({ open, onClose, blob, serverId, fetchImage, title, testIdPrefix }: Props) {
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
                    if (serverId == null) return;
                    setLoading(true);
                    source = await fetchImage(serverId);
                }
                if (!alive) return;
                if (!source) {
                    setError("No photo stored here.");
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
        // fetchImage is intentionally omitted: callers pass a module-level function, and including
        // an inline arrow in the deps would re-fetch the blob on every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, blob, serverId]);

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
                    {title}
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
                        alt={title}
                        data-testid={`${testIdPrefix}-full`}
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
