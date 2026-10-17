import { useEffect, useRef, useState } from "react";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import { describeBranchHours, type BranchHours } from "../utils/branchHours";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

export interface UseBranchDetailsResult {
    loading: boolean;
    /** "loading" until the fetch answers, "unknown" when it failed; never "closed" for either. */
    hours: BranchHours;
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
    const [hours, setHours] = useState<BranchHours>({ state: "loading" });
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
        setHours({ state: "loading" });
        setUnavailableNames([]);

        void (async () => {
            try {
                const baseInfo = await fetchBaseAppInfo(null, branch.id);
                if (requestIdRef.current !== requestId) return;

                setHours(describeBranchHours(baseInfo.workingHours ?? null));
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
                setHours({ state: "unknown" });
                setLoading(false);
            }
        })();
    }, [branch]);

    return { loading, hours, unavailableNames, error };
}
