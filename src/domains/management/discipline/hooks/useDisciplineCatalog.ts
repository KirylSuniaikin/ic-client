import { fetchDisciplineCatalog } from "../../../../shared/api/management";
import type { CatalogCategoryTO } from "../types";
import { useAsyncResource } from "./useAsyncResource";

export type UseDisciplineCatalogResult = {
    categories: CatalogCategoryTO[] | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

const CATALOG_KEY = "catalog";

export function useDisciplineCatalog(): UseDisciplineCatalogResult {
    const { data, loading, error, refresh } = useAsyncResource(CATALOG_KEY, fetchDisciplineCatalog);
    return { categories: data, loading, error, refresh };
}
