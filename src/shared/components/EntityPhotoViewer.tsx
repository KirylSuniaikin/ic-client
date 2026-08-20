import React from "react";
import { Box, Button, CircularProgress, Drawer, Typography } from "@mui/material";
import { useAuthImageUrl } from "../hooks/useAuthImageUrl";

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
    const { url, loading, error } = useAuthImageUrl(open, blob, serverId, fetchImage);

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
