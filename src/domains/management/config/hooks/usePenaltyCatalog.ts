import { useCallback, useEffect, useState } from "react";
import {
    createCatalogEntry,
    fetchDisciplineSettings,
    updateCatalogEntry,
    updateDisciplineSettings,
} from "../../../../shared/api/management";
import { useDisciplineCatalog } from "../../discipline/hooks/useDisciplineCatalog";
import type {
    CatalogCategoryTO,
    CatalogItemTO,
    CreateCatalogEntryRequest,
    DisciplineSettingsTO,
    UpdateCatalogEntryRequest,
} from "../../discipline/types";

export type UsePenaltyCatalogResult = {
    categories: CatalogCategoryTO[] | null;
    loadingCatalog: boolean;
    catalogError: string | null;
    settings: DisciplineSettingsTO | null;
    settingsError: string | null;
    createEntry: (request: CreateCatalogEntryRequest) => Promise<CatalogItemTO>;
    updateEntry: (id: number, request: UpdateCatalogEntryRequest) => Promise<CatalogItemTO>;
    setShadowPilot: (value: boolean) => Promise<void>;
    refresh: () => void;
};

// Mutations propagate their errors: the drawer and the switch own the error display.
export function usePenaltyCatalog(): UsePenaltyCatalogResult {
    const { categories, loading, error, refresh } = useDisciplineCatalog();
    const [settings, setSettings] = useState<DisciplineSettingsTO | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async (): Promise<void> => {
            try {
                const loaded = await fetchDisciplineSettings();
                if (!cancelled) setSettings(loaded);
            } catch (err) {
                if (!cancelled) {
                    setSettingsError(err instanceof Error ? err.message : "Failed to load discipline settings");
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const createEntry = useCallback(
        async (request: CreateCatalogEntryRequest): Promise<CatalogItemTO> => {
            const created = await createCatalogEntry(request);
            refresh();
            return created;
        },
        [refresh],
    );

    const updateEntry = useCallback(
        async (id: number, request: UpdateCatalogEntryRequest): Promise<CatalogItemTO> => {
            const updated = await updateCatalogEntry(id, request);
            refresh();
            return updated;
        },
        [refresh],
    );

    const setShadowPilot = useCallback(async (value: boolean): Promise<void> => {
        const updated = await updateDisciplineSettings({ shadowPilot: value });
        setSettings(updated);
        setSettingsError(null);
    }, []);

    return {
        categories,
        loadingCatalog: loading,
        catalogError: error,
        settings,
        settingsError,
        createEntry,
        updateEntry,
        setShadowPilot,
        refresh,
    };
}
