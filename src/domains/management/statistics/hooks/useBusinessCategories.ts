import {useCallback, useEffect, useRef, useState} from "react";
import {getBusinessCategories, updateCategoryClassification} from "../../../../shared/api/management";
import type {CategoryClassification, UpdateCategoryClassification} from "../types";
import {logger} from "../../../../shared/utils/logger";
import {describeSaveError} from "../components/business/businessFormat";

/** The field a picker changed; the other one is taken from the row as it is now. */
export type CategoryClassificationPatch = Partial<UpdateCategoryClassification>;

type UseBusinessCategories = {
    loading: boolean;
    categories: CategoryClassification[];
    unclassifiedCount: number;
    /** Rows with a classification save in flight; their pickers stay disabled until it answers. */
    savingIds: ReadonlySet<number>;
    saveError: string | null;
    clearSaveError: () => void;
    refresh: () => Promise<void>;
    /** Resolves true once the server has accepted the change; false when it was refused (and rolled back) or not sent. */
    classify: (id: number, patch: CategoryClassificationPatch) => Promise<boolean>;
};

/**
 * Owns the accounting-category classification list.
 *
 * <p>Loading follows useStatistics: a failed fetch goes to the logger and is never thrown at the UI,
 * and `refresh` is a useCallback the effect re-runs.
 *
 * <p>Saves are optimistic, like useProductCatalog: the row changes at once, is replaced IN PLACE by
 * the server's copy on success, and is put back as it was on failure (with saveError set so the
 * drawer can say why). The list is deliberately not refetched after a save: the server orders it
 * unclassified-first, so a refetch would move the row just classified out from under the cursor
 * mid-triage. The server's order comes back on the next load.
 *
 * <p>No `enabled` flag: BusinessTab is only mounted while its tab is selected, so mounting is
 * already the signal to fetch.
 */
export function useBusinessCategories(): UseBusinessCategories {
    const [loading, setLoading] = useState<boolean>(false);
    const [categories, setCategories] = useState<CategoryClassification[]>([]);
    const [savingIds, setSavingIds] = useState<ReadonlySet<number>>(new Set());
    const [saveError, setSaveError] = useState<string | null>(null);

    // A save builds its body from the row as it is NOW, never from the render that started it: the
    // body carries both fields, so a stale copy of the other one would undo the previous change.
    const categoriesRef = useRef<CategoryClassification[]>(categories);
    const savingRef = useRef<Set<number>>(new Set());

    const writeCategories = useCallback(
        (mutate: (rows: CategoryClassification[]) => CategoryClassification[]): void => {
            const next = mutate(categoriesRef.current);
            categoriesRef.current = next;
            setCategories(next);
        }, []);

    const replaceRow = useCallback((row: CategoryClassification): void => {
        writeCategories(rows => rows.map(r => r.id === row.id ? row : r));
    }, [writeCategories]);

    const markSaving = useCallback((id: number, saving: boolean): void => {
        if (saving) savingRef.current.add(id); else savingRef.current.delete(id);
        setSavingIds(new Set(savingRef.current));
    }, []);

    const refresh = useCallback(async (): Promise<void> => {
        setLoading(true);
        try {
            const loaded = await getBusinessCategories();
            writeCategories(() => loaded);
        } catch (e) {
            logger.error("Failed to load business-stats categories", e);
        } finally {
            setLoading(false);
        }
    }, [writeCategories]);

    const classify = useCallback(async (
        id: number,
        patch: CategoryClassificationPatch
    ): Promise<boolean> => {
        const current = categoriesRef.current.find(c => c.id === id);
        // One save per row at a time: a second body sent before the first answers would be built on
        // a state the server may never hold.
        if (!current || savingRef.current.has(id)) return false;

        const next: CategoryClassification = {...current, ...patch};
        const payload: UpdateCategoryClassification = {pnlClass: next.pnlClass, kpiTag: next.kpiTag};

        markSaving(id, true);
        replaceRow(next);
        try {
            replaceRow(await updateCategoryClassification(id, payload));
            return true;
        } catch (e) {
            logger.error("Failed to update category classification", e);
            replaceRow(current);
            setSaveError(`Couldn't save “${current.name}”: ${describeSaveError(e)}`);
            return false;
        } finally {
            markSaving(id, false);
        }
    }, [markSaving, replaceRow]);

    const clearSaveError = useCallback((): void => setSaveError(null), []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        loading,
        categories,
        unclassifiedCount: categories.filter(c => c.pnlClass === null).length,
        savingIds,
        saveError,
        clearSaveError,
        refresh,
        classify,
    };
}
