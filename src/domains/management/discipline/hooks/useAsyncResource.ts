import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncResource<T> = {
    data: T | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

type Loaded<T> = { key: string | number; data: T };

// key === null means idle (no request). A key change drops the previous data in the same render,
// so a screen never shows employee A's record under employee B's header. refresh() refetches and
// keeps the old data visible while loading.
export function useAsyncResource<T>(key: string | number | null, load: () => Promise<T>): AsyncResource<T> {
    const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
    const [loadingKey, setLoadingKey] = useState<string | number | null>(null);
    const [errorState, setErrorState] = useState<{ key: string | number; message: string } | null>(null);
    const [tick, setTick] = useState(0);

    // The loader is usually an inline arrow; keeping it in a ref keeps it out of the effect deps.
    const loadRef = useRef(load);
    loadRef.current = load;

    useEffect(() => {
        if (key === null) return undefined;
        let cancelled = false;
        setLoadingKey(key);
        setErrorState(null);

        void (async (): Promise<void> => {
            try {
                const data = await loadRef.current();
                if (!cancelled) setLoaded({ key, data });
            } catch (err) {
                if (!cancelled) {
                    setErrorState({
                        key,
                        message: err instanceof Error ? err.message : "Failed to load discipline data",
                    });
                }
            } finally {
                if (!cancelled) setLoadingKey(null);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [key, tick]);

    const refresh = useCallback((): void => setTick((t) => t + 1), []);

    if (key === null) return { data: null, loading: false, error: null, refresh };
    const hasData = loaded !== null && loaded.key === key;
    const hasError = errorState !== null && errorState.key === key;
    return {
        data: hasData ? loaded.data : null,
        // A key that just changed has not started its effect yet: it is already loading.
        loading: loadingKey === key || (!hasData && !hasError),
        error: hasError ? errorState.message : null,
        refresh,
    };
}
