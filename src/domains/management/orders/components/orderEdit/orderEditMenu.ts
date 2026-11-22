import type { CartItem, Group, MenuItem } from "../../../../menu/types";
import { groupItemsByName } from "../../../../../shared/utils/menuUtils";

export interface EditCategory {
    name: string;
    groups: Group[];
}

/** The spec's category order; anything else the menu carries follows in the menu's own order. */
const CATEGORY_ORDER = [
    "Pizzas",
    "Brick Pizzas",
    "Baguette Pizzas",
    "Combo Deals",
    "Sides",
    "Sauces",
    "Beverages",
];

function categoryRank(category: string, firstSeen: string[]): number {
    const fixed = CATEGORY_ORDER.indexOf(category);
    return fixed !== -1 ? fixed : CATEGORY_ORDER.length + firstSeen.indexOf(category);
}

/**
 * Menu items grouped the way the menu page groups them (one group per name, sizes inside), then
 * by category. groupItemsByName rather than groupAvailableItemsByName: the admin variant flips
 * every stopped item to available in place, and the editor must grey out what the shop has stopped.
 */
export function buildEditCategories(menu: MenuItem[]): EditCategory[] {
    const firstSeen: string[] = [];
    const byCategory = new Map<string, Group[]>();
    for (const group of groupItemsByName(menu)) {
        const category = group.items[0].category;
        const groups = byCategory.get(category) ?? [];
        if (groups.length === 0) {
            byCategory.set(category, groups);
            firstSeen.push(category);
        }
        groups.push(group);
    }
    return firstSeen
        .slice()
        .sort((a, b) => categoryRank(a, firstSeen) - categoryRank(b, firstSeen))
        .map(name => ({ name, groups: byCategory.get(name) ?? [] }));
}

export function isGroupAvailable(group: Group): boolean {
    return group.items.some(item => item.available);
}

/** The variant a single tap adds, and the price a row quotes: the cheapest available size. */
export function cheapestAvailable(group: Group): MenuItem | undefined {
    return group.items
        .filter(item => item.available)
        .reduce<MenuItem | undefined>((best, item) => (best === undefined || item.price < best.price ? item : best), undefined);
}

/** Which popup the menu page opens for a group (HomePage.handleOpenPopup), or "simple" for one tap. */
export type ItemPopupKind = "pizza" | "baguette" | "generic" | "pizzaCombo" | "detroitCombo" | "simple";

// Pizza Rolls is a side, but it has a topping choice the menu asks for in its popup.
const SIDES_WITH_OPTIONS = new Set(["Pizza Rolls"]);

export function popupKindFor(group: Group): ItemPopupKind {
    const { category, name } = group.items[0];
    if (category === "Pizzas") return "pizza";
    if (category === "Baguette Pizzas") return "baguette";
    if (category === "Brick Pizzas" || SIDES_WITH_OPTIONS.has(name)) return "generic";
    if (category === "Combo Deals" && name === "Pizza Combo") return "pizzaCombo";
    if (category === "Combo Deals" && name === "Detroit Combo") return "detroitCombo";
    return "simple";
}

/** The popups whose `editItem` mode can reopen an existing line — the cart's edit buttons. */
export function lineEditKind(item: CartItem): "pizza" | "pizzaCombo" | "detroitCombo" | null {
    if (item.category === "Pizzas") return "pizza";
    if (item.category === "Combo Deals" && item.name === "Pizza Combo" && (item.comboItems?.length ?? 0) > 0) return "pizzaCombo";
    if (item.category === "Combo Deals" && item.name === "Detroit Combo") return "detroitCombo";
    return null;
}

/** A one-tap line, shaped like the cart lines useMenuData builds for recommended items. */
export function menuItemToCartItem(item: MenuItem): CartItem {
    return {
        id: item.id, name: item.name, size: item.size,
        category: item.category, photo: item.photo, amount: item.price, quantity: 1,
        isThinDough: false, isGarlicCrust: false, extraIngredients: [], toppings: [],
        note: "", description: "", discountAmount: 0, comboItems: null,
    };
}
