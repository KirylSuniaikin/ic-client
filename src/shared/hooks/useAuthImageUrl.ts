import { useEffect, useState } from "react";
import { logger } from "../utils/logger";

export type AuthImageUrlResult = {
    url: string | null;
    loading: boolean;
    error: string | null;
};

/**
 * Fetches an authenticated image and turns it into an object URL, revoking it on cleanup.
 *
 * An authenticated image cannot be loaded with a plain <img src="/api/...">: the JWT lives in
 * localStorage and is attached by authFetch, so a browser-issued image request carries no
 * credential and gets a 401. Extracted out of EntityPhotoViewer so the full-size viewer and a
 * card-face thumbnail (TaskCardImageThumb) share one fetch/objectURL/revoke effect instead of two.
 */
export function useAuthImageUrl(
    active: boolean,
    blob: Blob | null,
    serverId: number | null,
    fetchImage: (serverId: number) => Promise<Blob | null>
): AuthImageUrlResult {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!active) return;

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
    }, [active, blob, serverId]);

    return { url, loading, error };
}
