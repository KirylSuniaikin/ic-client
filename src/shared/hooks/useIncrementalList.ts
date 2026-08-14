import { useEffect, useMemo, useState } from "react";

/** Report lists open showing this many cards; scrolling to the end reveals another batch. */
export const DEFAULT_PAGE_SIZE = 6;

type Options = {
    pageSize?: number;
    /**
     * Change this to send the window back to the first page — e.g. the branch id, since switching
     * branch replaces the dataset. Deliberately NOT keyed on the array itself: saving a report
     * replaces the array, and collapsing a scrolled list back to six cards on every save would be
     * infuriating.
     */
    resetKey?: string | number;
};

export type IncrementalList<T> = {
    visible: T[];
    hasMore: boolean;
    /** Attach to an element rendered after the last card; observing it reveals the next batch. */
    sentinelRef: (node: HTMLElement | null) => void;
};

/**
 * Reveals a long list a page at a time as the user scrolls.
 *
 * This windows an already-loaded array rather than paging the server. The report endpoints return
 * a branch's whole list in one response, and callers derive totals from it (PurchasePopup's
 * outstanding banner sums every report's unpaid amount) — paging the request would quietly make
 * those totals describe only the pages fetched so far.
 */
export function useIncrementalList<T>(items: T[], options: Options = {}): IncrementalList<T> {
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const { resetKey } = options;

    const [visibleCount, setVisibleCount] = useState<number>(pageSize);
    // Held in state as a CALLBACK ref, not useRef: these lists live inside a MUI Dialog, whose
    // portal mounts its children on a second commit. A useRef is still null when the effect below
    // first runs, so the observer would silently never attach. Keeping the node in state re-runs
    // the effect the moment it mounts.
    const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setVisibleCount(pageSize);
    }, [resetKey, pageSize]);

    const hasMore = visibleCount < items.length;

    useEffect(() => {
        if (!sentinel || !hasMore) return;
        // jsdom has no IntersectionObserver, and neither do very old WebViews. Without it the list
        // simply stays at its current page instead of throwing.
        if (typeof IntersectionObserver === "undefined") return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisibleCount((current) => current + pageSize);
                }
            },
            // A little lead time so the next batch is usually already there by the time the user
            // reaches the end of the current one.
            { rootMargin: "200px" }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [sentinel, hasMore, pageSize]);

    const visible = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

    return { visible, hasMore, sentinelRef: setSentinel };
}
