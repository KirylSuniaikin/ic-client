import type { CatalogCategoryTO, CatalogItemTO } from "./types";

export function filterCatalogForIssuer(
    categories: ReadonlyArray<CatalogCategoryTO>,
    canIssueClassD: boolean,
): CatalogCategoryTO[] {
    if (canIssueClassD) return [...categories];
    return categories
        .map((c) => ({ ...c, items: c.items.filter((i) => i.violationClass !== "D") }))
        .filter((c) => c.items.length > 0);
}

export function findCatalogItem(categories: ReadonlyArray<CatalogCategoryTO>, id: number): CatalogItemTO | null {
    for (const c of categories) {
        const hit = c.items.find((i) => i.id === id);
        if (hit) return hit;
    }
    return null;
}
