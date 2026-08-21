import React from "react";
import { Box } from "@mui/material";
import { useAuthImageUrl } from "../../../../shared/hooks/useAuthImageUrl";
import { fetchTaskCardImage } from "../../../../shared/api/management";

type Props = {
    taskCardId: number;
};

/**
 * Card-face photo preview.
 *
 * An authenticated image cannot be loaded with <img src="/api/...">: the JWT lives in
 * localStorage and is attached by authFetch, so a browser-issued image request 401s. Bytes are
 * fetched once per mount via useAuthImageUrl (object URL, revoked on cleanup) — the same effect
 * EntityPhotoViewer uses for the full-size view.
 *
 * Renders nothing while loading or on error. The caller (TaskCardItem) only mounts this when
 * card.hasImage is true.
 */
export function TaskCardImageThumb({ taskCardId }: Props) {
    const { url } = useAuthImageUrl(true, null, taskCardId, fetchTaskCardImage);

    if (!url) return null;

    return (
        <Box
            component="img"
            src={url}
            alt="Task photo"
            data-testid={`task-image-thumb-${taskCardId}`}
            sx={{ height: 110, width: "100%", objectFit: "cover", borderRadius: "8px" }}
        />
    );
}
