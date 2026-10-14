import { useEffect, useRef, useState } from "react";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import { getClosingTime, toDisplayClosing } from "../../schedule/utils/getClosingTime";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

export interface UseBranchDetailsResult {
    loading: boolean;
    /** "HH:MM" while a shift is running at this branch, null when it is closed or unknown. */
    closingTime: string | null;
    /** Cart items this branch cannot make. Empty when the cart is empty or everything is available. */
    unavailableNames: string[];
    error: string | null;
}

/**
 * Everything the branch details sheet needs about a branch the customer has NOT chosen yet.
 *
 * One anonymous `fetchBaseAppInfo(null, branchId)` carries both halves — that branch's schedule
 * and its menu — so this asks once rather than calling a working-hours endpoint too. It has to be
 * the anonymous call: `getWorkingHours` goes through authFetch, whose 401 redirect would throw a
 * guest browsing the picker out to the staff login.
 *
 * The availability rule is deliberately identical to useBranchSwitch's: an item counts as
 * available only when the target branch lists it as `available === true`. If the two ever
 * disagreed, this sheet would promise something the switch warning then takes away.
 */
export function useBranchDetails(branch: IBranch | null, cartItems: CartItem[]): UseBranchDetailsResult {
    const [loading, setLoading] = useState(false);
    const [closingTime, setClosingTime] = useState<string | null>(null);
    const [unavailableNames, setUnavailableNames] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Reopening the sheet on another branch while the first fetch is in flight must not let the
    // stale answer paint over the new one. Mirrors useBranchSwitch's requestIdRef.
    const requestIdRef = useRef(0);

    // Read through a ref so a caller passing a fresh array literal each render does not refetch.
    const cartItemsRef = useRef(cartItems);
    cartItemsRef.current = cartItems;

    useEffect(() => {
        if (branch === null) return;

        requestIdRef.current += 1;
        const requestId = requestIdRef.current;

        setLoading(true);
        setError(null);
        setClosingTime(null);
        setUnavailableNames([]);

        void (async () => {
            try {
                const baseInfo = await fetchBaseAppInfo(null, branch.id);
                if (requestIdRef.current !== requestId) return;

                const closing = getClosingTime(baseInfo.workingHours ?? null);
                setClosingTime(closing === null ? null : toDisplayClosing(closing));
                setUnavailableNames(
                    cartItemsRef.current
                        .filter(item => !baseInfo.menu.some(
                            menuItem => menuItem.name === item.name && menuItem.available === true
                        ))
                        .map(item => item.name)
                );
                setLoading(false);
            } catch (err) {
                if (requestIdRef.current !== requestId) return;
                setError(err instanceof Error ? err.message : String(err));
                setLoading(false);
            }
        })();
    }, [branch]);

    return { loading, closingTime, unavailableNames, error };
}
