import type { Customization, ExtraIngr, MenuItem, RecipeComponent, Topping } from "../types";
import { buildAdditionTokens, buildRemovalTokens, RemovedComponent } from "./customizations";

/**
 * Replaces the deleted `localizeDescription.ts` substring-localizer: instead of parsing tokens
 * out of a generated English `description` string, this builds the customer-facing ingredient
 * text directly from STRUCTURED data (customizations + dough/crust flags). Works for both a
 * `CartItem` and a response item (`OrderItemDetailTO`/`ComboItemDetailTO`) — they share this
 * shape. `size` is accepted for structural parity with those source shapes even though this
 * function does not currently branch on it.
 */
export type DisplaySource = {
    customizations?: Customization[];
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    size?: string;
};

/**
 * Dough/crust values that can appear as a token in the generated description (see the popups'
 * getDesc helpers). Relocated here from the deleted localizeDescription.ts — still the single
 * source of truth for which option values buildDisplay's caller must resolve a label for.
 */
export const OPTION_VALUES = ["Thin Dough", "Traditional Dough", "Garlic Crust", "Classic Crust", "Thin"];

/** Catalog + dough-label map buildDisplay resolves ids against. useOptionLabel is a hook, so
 * doughLabels is resolved by the caller (mirrors the deleted localizeDescription's convention)
 * via `OPTION_VALUES.map(optionLabel)`. */
export type BuildDisplayMenuData = {
    toppings: Topping[];
    extras: ExtraIngr[];
    // Source MenuItems (any category/size) whose recipe_components carry removal-token labels,
    // looked up by componentId.
    menuItems: MenuItem[];
    doughLabels: Record<string, string>;
};

const TOPPING_SUFFIX = " Topping";

function componentsById(menuItems: MenuItem[]): Map<number, RecipeComponent> {
    const map = new Map<number, RecipeComponent>();
    for (const item of menuItems) {
        for (const component of item.recipe_components ?? []) {
            if (!map.has(component.id)) map.set(component.id, component);
        }
    }
    return map;
}

/** ADD-row localized name: English mode always shows the row's own name snapshot; Arabic mode
 * prefers the catalog entry's name_ar, falling back to the snapshot when the id isn't found in
 * the current menu (or has no Arabic name). */
function addLocalizedName(
    id: number,
    nameSnapshot: string,
    catalog: { id: number; name_ar?: string | null }[],
    isArabic: boolean,
): string {
    const found = catalog.find(entry => entry.id === id);
    if (!found) return nameSnapshot;
    return isArabic ? (found.name_ar ?? nameSnapshot) : nameSnapshot;
}

/** REMOVE-row localized name: English mode prefers the recipe component's label, Arabic mode
 * prefers label_ar -> label, both falling back to the customization row's own name snapshot. */
function removeLocalizedName(
    componentId: number,
    nameSnapshot: string,
    byId: Map<number, RecipeComponent>,
    isArabic: boolean,
): string {
    const found = byId.get(componentId);
    if (!found) return nameSnapshot;
    return isArabic ? (found.label_ar ?? found.label ?? nameSnapshot) : (found.label ?? nameSnapshot);
}

/**
 * Produces the customer-facing ingredient string (dough/crust token, then the `+(...)`
 * additions group, then the `-(...)` removals group) from a CartItem/response item's
 * structured data. Pure function — no hooks, no `description` parsing. The caller decides the
 * legacy (pre-migration) fallback of showing the raw `description` string when `customizations`
 * is empty/absent; this function only ever reads structured fields.
 */
export function buildDisplay(source: DisplaySource, menu: BuildDisplayMenuData, isArabic: boolean): string {
    const parts: string[] = [];

    if (source.isThinDough) parts.push(`+${menu.doughLabels["Thin Dough"] ?? "Thin Dough"}`);
    if (source.isGarlicCrust) parts.push(`+${menu.doughLabels["Garlic Crust"] ?? "Garlic Crust"}`);

    const customizations = source.customizations ?? [];
    const byComponentId = componentsById(menu.menuItems);

    const additionNames = customizations
        .filter(c => c.action === "ADD")
        .map(c => {
            const nameSnapshot = c.name ?? "";
            if (c.toppingId != null) {
                return `${addLocalizedName(c.toppingId, nameSnapshot, menu.toppings, isArabic)}${TOPPING_SUFFIX}`;
            }
            if (c.extraIngrId != null) {
                return addLocalizedName(c.extraIngrId, nameSnapshot, menu.extras, isArabic);
            }
            return nameSnapshot;
        })
        .filter(Boolean);
    if (additionNames.length > 0) parts.push(buildAdditionTokens(additionNames));

    const removed: RemovedComponent[] = customizations
        .filter(c => c.action === "REMOVE" && c.componentId != null)
        .map(c => {
            const componentId = c.componentId as number;
            return { id: componentId, name: removeLocalizedName(componentId, c.name ?? "", byComponentId, isArabic) };
        });
    if (removed.length > 0) parts.push(buildRemovalTokens(removed));

    return parts.join(" ");
}
