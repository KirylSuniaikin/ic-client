import {useCallback, useEffect, useState} from "react";
import {getBusinessCategories, updateCategoryClassification} from "../../../../shared/api/management";
import type {CategoryClassification, UpdateCategoryClassification} from "../types";
import {logger} from "../../../../shared/utils/logger";

type UseBusinessCategories = {
    loading: boolean;
    categories: CategoryClassification[];
    unclassifiedCount: number;
    refresh: () => Promise<void>;
    classify: (id: number, payload: UpdateCategoryClassification) => Promise<void>;
};

/**
 * Owns the accounting-category classification list.
 *
 * <p>Follows useStatistics: errors go to the logger and are never thrown at the UI, and `refresh` is
 * a useCallback the effect re-runs. A successful classify re-fetches rather than patching state
 * locally, because the server owns the ordering (unclassified first, heaviest spend first) and a
 * local patch would silently drift from it.
 *
 * <p>No `enabled` flag: BusinessTab is only mounted while its tab is selected, so mounting is
 * already the signal to fetch.
 */
export function useBusinessCategories(): UseBusinessCategories {
    const [loading, setLoading] = useState<boolean>(false);
    const [categories, setCategories] = useState<CategoryClassification[]>([]);

    const refresh = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            setCategories(await getBusinessCategories());
        } catch (e) {
            logger.error("Failed to load business-stats categories", e);
        } finally {
            setLoading(false);
        }
    }, []);

    const classify = useCallback(async (
        id: number,
        payload: UpdateCategoryClassification
    ): Promise<void> => {
        try {
            await updateCategoryClassification(id, payload);
            await refresh();
        } catch (e) {
            logger.error("Failed to update category classification", e);
        }
    }, [refresh]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        loading,
        categories,
        unclassifiedCount: categories.filter(c => c.pnlClass === null).length,
        refresh,
        classify,
    };
}
