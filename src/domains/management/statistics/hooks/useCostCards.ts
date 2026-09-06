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
    setComponentCost: (id: number, payload: UpdateComponentCost) => Promise<void>;
};

/**
 * Cost cards and the components behind them.
 *
 * <p>Separate from {@code useBusinessStats} because cost cards are period-independent and the
 * payload is large — reloading them every time the month range moves would be pure waste.
 */
export function useCostCards(): UseCostCards {
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
            // Refetch both: one component's cost changes every card it appears on, and the server
            // owns the "uncosted first" ordering the drawer relies on.
            await refresh();
        } catch (e) {
            logger.error("Failed to update component cost", e);
        }
    }, [refresh]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        loading,
        cards,
        components,
        uncostedCount: components.filter(c => c.costSource === "MISSING").length,
        refresh,
        setComponentCost,
    };
}
