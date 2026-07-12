import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface UseProgressiveListResult<T, E extends HTMLElement> {
    visibleItems: T[];
    hasMore: boolean;
    sentinelRef: RefObject<E>;
}

// Client-side infinite scroll: renders `items` in chunks of `chunkSize`, revealing the next
// chunk whenever the returned `sentinelRef` element scrolls into view. Keeps the caller's data
// fetching untouched — it only slices an already-loaded array. Attach `sentinelRef` to an element
// rendered after the last visible item (guarded by `hasMore`) so the observer disconnects once
// everything is shown. Mirrors the IntersectionObserver + sentinel pattern in HistoryComponent.
export function useProgressiveList<T, E extends HTMLElement = HTMLElement>(
    items: T[],
    chunkSize: number,
): UseProgressiveListResult<T, E> {
    const [visibleCount, setVisibleCount] = useState(chunkSize);
    const sentinelRef = useRef<E>(null);

    // Reset back to the first chunk whenever the source list is replaced (e.g. a re-fetch or the
    // dialog re-opening) so the user always starts at the top.
    useEffect(() => {
        setVisibleCount(chunkSize);
    }, [items, chunkSize]);

    const hasMore = visibleCount < items.length;

    // Observe the sentinel only while more rows remain; when `hasMore` flips false the sentinel
    // unmounts and the effect cleanup disconnects the observer.
    useEffect(() => {
        if (!hasMore) return;

        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries.some(entry => entry.isIntersecting)) {
                setVisibleCount(count => count + chunkSize);
            }
        });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, chunkSize]);

    return {
        visibleItems: items.slice(0, visibleCount),
        hasMore,
        sentinelRef,
    };
}
