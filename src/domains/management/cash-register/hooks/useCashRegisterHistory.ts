import { logger } from "../../../../shared/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBranchEvents } from "../../../../shared/api/management";
import type { CashRegisterEventTO } from "../types";

export interface UseCashRegisterHistoryResult {
    events: CashRegisterEventTO[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    error: string | null;
    loadMore: () => void;
}

export const CASH_REGISTER_PAGE_SIZE = 30;

// `open` is a parameter rather than a caller-side condition because CashRegisterPopup keeps
// <TransactionDetailsTable> permanently mounted and only toggles its `open` prop — without an
// explicit reset, reopening would show the pages accumulated during the previous visit.
export function useCashRegisterHistory(branchId: string, open: boolean): UseCashRegisterHistoryResult {
    const [events, setEvents] = useState<CashRegisterEventTO[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Identifies the in-flight fetch so a slow, superseded response is discarded when it resolves.
    const requestTokenRef = useRef<number>(0);
    const pageRef = useRef<number>(0);
    const loadingMoreRef = useRef<boolean>(false);
    const hasMoreRef = useRef<boolean>(true);

    const fetchInitialPage = useCallback((): void => {
        const token = ++requestTokenRef.current;
        pageRef.current = 0;
        hasMoreRef.current = true;
        setEvents([]);
        setHasMore(true);
        setError(null);
        setLoading(true);

        void (async (): Promise<void> => {
            try {
                const response = await getBranchEvents({ branchId, page: 0, size: CASH_REGISTER_PAGE_SIZE });
                if (token !== requestTokenRef.current) return;
                setEvents(response.events);
                setHasMore(response.hasMore);
                hasMoreRef.current = response.hasMore;
            } catch (err) {
                if (token !== requestTokenRef.current) return;
                logger.error("Failed to load cash register history", err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                if (token === requestTokenRef.current) setLoading(false);
            }
        })();
    }, [branchId]);

    // Handles both "dialog closed" and "branch switched while open" with one code path.
    useEffect(() => {
        if (!open) {
            requestTokenRef.current += 1;
            pageRef.current = 0;
            hasMoreRef.current = true;
            loadingMoreRef.current = false;
            setEvents([]);
            setHasMore(true);
            setError(null);
            setLoading(false);
            setLoadingMore(false);
            return;
        }

        fetchInitialPage();
    }, [branchId, open, fetchInitialPage]);

    const loadMore = useCallback((): void => {
        if (loadingMoreRef.current || !hasMoreRef.current) return;

        const token = requestTokenRef.current;
        const nextPage = pageRef.current + 1;
        loadingMoreRef.current = true;
        setLoadingMore(true);

        void (async (): Promise<void> => {
            try {
                const response = await getBranchEvents({ branchId, page: nextPage, size: CASH_REGISTER_PAGE_SIZE });
                if (token !== requestTokenRef.current) return;
                setEvents(prev => [...prev, ...response.events]);
                pageRef.current = nextPage;
                setHasMore(response.hasMore);
                hasMoreRef.current = response.hasMore;
            } catch (err) {
                if (token !== requestTokenRef.current) return;
                logger.error("Failed to load more cash register history", err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                // Always release the lock, even for a superseded request — the token check above
                // already blocks stale data, so releasing unconditionally just stops loadMore from
                // being wedged permanently when a branch change interrupts an in-flight page fetch.
                loadingMoreRef.current = false;
                setLoadingMore(false);
            }
        })();
    }, [branchId]);

    return { events, loading, loadingMore, hasMore, error, loadMore };
}
