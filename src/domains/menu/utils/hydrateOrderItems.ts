import { imageMap } from "../../../shared/utils/imageMap";
import type { CartItem, Customization, Topping } from "../types";
import {
    extrasFromCustomizations,
    parseExtrasNames,
    splitAdditionNames,
    splitNote,
    toppingsFromCustomizations,
} from "./customizations";

/**
 * An existing order's line as the edit flows receive it: the board's `Order.items` for the
 * order-edit popup, or the same order JSON-parsed back out of `localStorage.orderToEdit` for the
 * route-based edit mode. Combo children may carry an `id`/`photo` the order type does not declare.
 */
export type EditableOrderItem = {
    id?: number;
    name: string;
    size: string;
    category: string;
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    toppings?: Topping[];
    description: string;
    note?: string;
    quantity: number;
    amount: number | string;
    discountAmount?: number;
    photo?: string;
    customizations?: Customization[];
    comboItemTO?: Array<Partial<CartItem> & { description?: string }>;
};

function parseItemNote(rawDesc: string): string {
    // Delegate to the shared note-boundary heuristic (customizations.ts) so this stays in
    // lockstep with localizeDescription.ts, which needs the same boundary to leave the note
    // untouched during localization.
    return splitNote(rawDesc).noteText;
}

function parseExtraIngr(rawDesc: string): string[] {
    // Delegate to the shared additions parser (customizations.ts) so this stays in lockstep
    // with the grammar it emits — it already accepts both the new grouped `+(a, b)` and the
    // legacy `(+X +Y)` shape, and its regexes only ever match `+`-prefixed groups so `-(x)`
    // removal tokens can't be misread as extras.
    return parseExtrasNames(rawDesc);
}

/**
 * Rebuilds a line's extras/drizzle name lists in the shape the popups expect (plain names, one
 * list per catalog). Order responses carry no `toppings` field and pack both catalogs into a
 * single `+(a, b)` description group, so hydrating extras straight from that group dropped every
 * drizzle into the extras list — where it matched no extra-ingredient row and lost its price on
 * re-save. Prefer the structural customizations; fall back to splitting the description group.
 */
function hydrateAdditions(customizations: Customization[], rawDesc: string): { extras: string[]; toppings: string[] } {
    const structuralExtras = extrasFromCustomizations(customizations);
    const structuralToppings = toppingsFromCustomizations(customizations);
    if (structuralExtras.length > 0 || structuralToppings.length > 0) {
        return { extras: structuralExtras, toppings: structuralToppings };
    }
    return splitAdditionNames(parseExtraIngr(rawDesc));
}

function normalizeComboItem(ci: Partial<CartItem>): {
    id: number | undefined; name: string; category: string; size: string;
    quantity: number; isGarlicCrust: boolean; isThinDough: boolean;
    note: string; extraIngredients: string[]; description: string;
    customizations: Customization[];
} {
    return {
        id: ci?.id, name: ci?.name ?? "", category: ci?.category ?? "", size: ci?.size ?? "",
        quantity: ci?.quantity ?? 1, isGarlicCrust: !!ci?.isGarlicCrust, isThinDough: !!ci?.isThinDough,
        // Prefer the real note field the response now carries; fall back to parsing the legacy
        // `+<note>` tail out of description for pre-migration orders that never had it.
        note: ci?.note ?? parseItemNote(ci?.description ?? ""), extraIngredients: parseExtraIngr(ci?.description ?? ""),
        // Raw description + structural customizations pass through so combo popups can
        // re-hydrate removal state (legacy orders fall back to the `-(x)` tokens in description).
        description: ci?.description ?? "",
        customizations: ci?.customizations ?? [],
    };
}

/**
 * Turns an existing order's lines into cart lines the item popups can edit (their `editItem`
 * mode) and the edit request can re-send. Moved out of useMenuData unchanged so the order-board
 * edit popup hydrates lines exactly the way the route-based edit mode does.
 */
export function hydrateOrderItemsForEdit(items: EditableOrderItem[]): CartItem[] {
    const normalized = items.map(item => {
        const additions = hydrateAdditions(item.customizations ?? [], item.description);
        return {
            ...item,
            photo: imageMap[item.name] || item.photo,
            quantity: item.quantity || 1,
            discountAmount: item.discountAmount ?? 0,
            amount: parseFloat(String(item.amount)),
            // Prefer the real note field the response now carries; fall back to
            // parsing the legacy `+<note>` tail out of description for
            // pre-migration orders that never had it.
            note: item.note ?? parseItemNote(item.description),
            extraIngredients: additions.extras,
            // The order response carries no topping list of its own, so drizzles
            // are recovered from the customizations (or the description group).
            toppings: additions.toppings,
            // Structural customizations pass through; legacy orders without them
            // are re-hydrated by the popups from the `-(x)` description tokens.
            customizations: item.customizations ?? [],
            comboItems: Array.isArray(item.comboItemTO)
                ? item.comboItemTO.map((ci: Partial<CartItem> & { description?: string }) => ({
                    ...normalizeComboItem(ci),
                    // ci comes from JSON.parse; photo is present at runtime but not in Partial<CartItem>
                    photo: imageMap[ci.name ?? ''] || ci.photo,
                }))
                : [],
        };
    });
    // safe because: the source is an order response (or its JSON.parse'd localStorage copy) whose
    // extraIngredients/toppings are raw name strings rather than ExtraIngr[]/Topping[]; the cart
    // and popups consume these by name at runtime (ingredientNames). The shape does not
    // structurally overlap CartItem, so a checked double-cast is required.
    return normalized as unknown as CartItem[];
}
