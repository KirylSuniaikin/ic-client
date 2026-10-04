import {useCallback, useEffect, useState} from "react";
import {getComponentCosts, getMenuCostCards, updateComponentCost} from "../../../../shared/api/management";
import type {ComponentCost, MenuCostCardsResponse, UpdateComponentCost} from "../types";
import {logger} from "../../../../shared/utils/logger";

type UseCostCards = {
    loading: boolean;
    cards: MenuCostCardsResponse | null;
    components: ComponentCost[];
    uncostedCount: number;
    refresh: () => Promise<void>;
    /** Rejects when the server refuses the cost, so the caller can keep what was typed and say why. */
    setComponentCost: (id: number, payload: UpdateComponentCost) => Promise<void>;
};

/**
 * Cost cards and the components behind them.
 *
 * <p>Separate from {@code useBusinessStats} because cost cards are period-independent and the
 * payload is large — reloading them every time the month range moves would be pure waste.
 *
 * <p>Loading errors go to the logger, as in useStatistics. A failed save is the exception: it is
 * rethrown, because swallowing it let the drawer drop the typed cost and show the old one as if
 * nothing had happened.
 */
export function useCostCards(refreshKey: number = 0): UseCostCards {
    const [loading, setLoading] = useState<boolean>(false);
    const [cards, setCards] = useState<MenuCostCardsResponse | null>(null);
    const [components, setComponents] = useState<ComponentCost[]>([]);

    const refresh = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const [cardsResult, componentsResult] = await Promise.all([
                getMenuCostCards(),
                getComponentCosts(),
            ]);
            setCards(cardsResult);
            setComponents(componentsResult);
        } catch (e) {
            logger.error("Failed to load cost cards", e);
        } finally {
            setLoading(false);
        }
    }, []);

    const setComponentCost = useCallback(async (
        id: number,
        payload: UpdateComponentCost
    ): Promise<void> => {
        try {
            await updateComponentCost(id, payload);
        } catch (e) {
            logger.error("Failed to update component cost", e);
            throw e;
        }
        // Refetch both: one component's cost changes every card it appears on, and the server
        // owns the "uncosted first" ordering the drawer relies on.
        await refresh();
    }, [refresh]);

    // refreshKey is a dependency only: a caller bumps it to refetch after a change this hook cannot
    // see, such as a product's unit edited in the table above the cards.
    useEffect(() => {
        void refresh();
    }, [refresh, refreshKey]);

    return {
        loading,
        cards,
        components,
        uncostedCount: components.filter(c => c.costSource === "MISSING").length,
        refresh,
        setComponentCost,
    };
}
