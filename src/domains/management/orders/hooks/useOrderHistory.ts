import { logger } from "../../../../shared/utils/logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { getHistory } from "../../../../shared/api/public";
import type { Order, OrderHistoryFilter } from "../../../order/types";

export interface UseOrderHistoryResult {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    error: string | null;
    searchInput: string;
    setSearchInput: (value: string) => void;
    loadMore: () => void;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

// Classifies raw search input per the resolved rule: exactly 8 digits -> orderId,
// exactly 16 digits -> externalId, exactly 4 digits -> orderNo (raw digit string, leading
// zeros preserved, so the backend can compare it against RIGHT(CAST(external_id AS text), 4)
// as well as order_no), 11-15 digits after stripping one optional leading '+' -> phone
// (digits-only string; the 15-digit upper bound mirrors the backend's sanitizePhone cap
// \d{6,15}), any other non-empty text -> customerName, blank/whitespace-only -> no filter
// (plain browsing). 8-digit/16-digit checks run first so they always win over the phone rule.
function classifySearchInput(raw: string): OrderHistoryFilter {
    const trimmed = raw.trim();
    if (/^\d{8}$/.test(trimmed)) return { type: "orderId", value: Number(trimmed) };
    if (/^\d{16}$/.test(trimmed)) return { type: "externalId", value: Number(trimmed) };
    if (/^\d{4}$/.test(trimmed)) return { type: "orderNo", value: trimmed };
    const withoutLeadingPlus = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
    if (/^\d{11,15}$/.test(withoutLeadingPlus)) return { type: "phone", value: withoutLeadingPlus };
    if (trimmed.length > 0) return { type: "customerName", value: trimmed };
    return { type: "none" };
}

export function useOrderHistory(branchId: string): UseOrderHistoryResult {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState<string>("");

    // Tracks the page/filter belonging to the in-flight fetch so a slow, superseded
    // response can be discarded when it resolves (stale-response guard, spec §6.5).
    const requestTokenRef = useRef<number>(0);
    const filterRef = useRef<OrderHistoryFilter>({ type: "none" });
    const pageRef = useRef<number>(0);
    const loadingMoreRef = useRef<boolean>(false);
    const hasMoreRef = useRef<boolean>(true);
    // Mirrors searchInput on every render so the branch-change effect can read the
    // current value without depending on it (which would defeat the debounce effect).
    const searchInputRef = useRef<string>(searchInput);
    searchInputRef.current = searchInput;

    const fetchInitialPage = useCallback((filter: OrderHistoryFilter): void => {
        const token = ++requestTokenRef.current;
        filterRef.current = filter;
        pageRef.current = 0;
        hasMoreRef.current = true;
        setOrders([]);
        setHasMore(true);
        setError(null);
        setLoading(true);

        void (async (): Promise<void> => {
            try {
                const response = await getHistory({ branchId, page: 0, size: PAGE_SIZE, filter });
                if (token !== requestTokenRef.current) return;
                setOrders(response.orders);
                setHasMore(response.hasMore);
                hasMoreRef.current = response.hasMore;
            } catch (err) {
                if (token !== requestTokenRef.current) return;
                logger.error("Failed to load order history", err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                if (token === requestTokenRef.current) setLoading(false);
            }
        })();
    }, [branchId]);

    // Reset to page 0 on mount and whenever the branch changes, using whatever
    // search filter is currently active (spec §6.1).
    useEffect(() => {
        fetchInitialPage(classifySearchInput(searchInputRef.current));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    // Debounced re-fetch whenever the search input changes; skips the very first
    // render since the branch-change effect above already performs the initial load.
    const isFirstSearchRenderRef = useRef<boolean>(true);
    useEffect(() => {
        if (isFirstSearchRenderRef.current) {
            isFirstSearchRenderRef.current = false;
            return;
        }

        const timer = setTimeout(() => {
            fetchInitialPage(classifySearchInput(searchInput));
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [searchInput, fetchInitialPage]);

    const loadMore = useCallback((): void => {
        if (loadingMoreRef.current || !hasMoreRef.current) return;

        const token = requestTokenRef.current;
        const nextPage = pageRef.current + 1;
        const filter = filterRef.current;
        loadingMoreRef.current = true;
        setLoadingMore(true);

        void (async (): Promise<void> => {
            try {
                const response = await getHistory({ branchId, page: nextPage, size: PAGE_SIZE, filter });
                if (token !== requestTokenRef.current) return;
                setOrders(prev => [...prev, ...response.orders]);
                pageRef.current = nextPage;
                setHasMore(response.hasMore);
                hasMoreRef.current = response.hasMore;
            } catch (err) {
                if (token !== requestTokenRef.current) return;
                logger.error("Failed to load more order history", err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                // Always release the lock, even for a stale/superseded request — the
                // token check above already prevents stale data from being applied,
                // so releasing unconditionally just stops loadMore from being wedged
                // permanently when a search/branch change interrupts an in-flight page
                // fetch (spec §7 edge case).
                loadingMoreRef.current = false;
                setLoadingMore(false);
            }
        })();
    }, [branchId]);

    return {
        orders,
        setOrders,
        loading,
        loadingMore,
        hasMore,
        error,
        searchInput,
        setSearchInput,
        loadMore,
    };
}
