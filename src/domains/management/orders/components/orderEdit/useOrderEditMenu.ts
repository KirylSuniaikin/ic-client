import { useCallback, useEffect, useState } from "react";
import { fetchBaseAppInfo } from "../../../../../shared/api/public";
import { logger } from "../../../../../shared/utils/logger";
import type { ExtraIngr, MenuItem, Topping } from "../../../../menu/types";

export interface UseOrderEditMenuResult {
    menu: MenuItem[];
    extraIngredients: ExtraIngr[];
    toppings: Topping[];
    isSDoughAvailable: boolean;
    loading: boolean;
    error: string | null;
    reload: () => void;
}

/**
 * The menu of the branch that cooks the order — the same source useMenuData reads — so prices
 * and availability match that branch, not the tablet's.
 */
export function useOrderEditMenu(branchId: string): UseOrderEditMenuResult {
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [extraIngredients, setExtraIngredients] = useState<ExtraIngr[]>([]);
    const [toppings, setToppings] = useState<Topping[]>([]);
    const [isSDoughAvailable, setSDoughAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchBaseAppInfo(null, branchId)
            .then(info => {
                if (cancelled) return;
                setMenu(info.menu);
                setExtraIngredients(info.extraIngr);
                setToppings(info.toppings);
                setSDoughAvailable(info.isSDoughAvailable);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                logger.error("Order edit: loading the branch menu failed:", err);
                setError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [branchId, attempt]);

    const reload = useCallback((): void => setAttempt(n => n + 1), []);

    return { menu, extraIngredients, toppings, isSDoughAvailable, loading, error, reload };
}
