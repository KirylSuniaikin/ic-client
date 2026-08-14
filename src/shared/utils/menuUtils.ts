import type { MenuItem, Group } from '../../domains/menu/types';

type MenuGroup = {
    name: string;
    category: string;
    is_best_seller: boolean;
    isAvailable: boolean;
    items: MenuItem[];
};

type GroupWithMeta = Group & {
    category: string;
    is_best_seller: boolean;
};

export type CategoryGroups = {
    bestsellers: Group[];
    brickPizzas: Group[];
    combos: Group[];
    pizzas: Group[];
    sides: Group[];
    beverages: Group[];
    sauces: Group[];
    ramadan: Group[];
    pizzaBaguettes: Group[];
};

// Mirrors the order MenuSections renders its rows in, top to bottom. KEEP IN SYNC with the
// `sections` array there: the image preloader walks the menu in this order to decide which photos
// the customer sees first, so if the two drift apart it warms the wrong images and the customer is
// back to looking at empty cards.
export const MENU_SECTION_ORDER = [
    "ramadan",
    "bestsellers",
    "pizzaBaguettes",
    "brickPizzas",
    "combos",
    "pizzas",
    "sides",
    "sauces",
    "beverages",
] as const satisfies readonly (keyof CategoryGroups)[];

export function groupItemsByName(data: MenuItem[]): Group[] {
    if (!data || !Array.isArray(data)) {
        return [];
    }

    const map = new Map<string, MenuGroup>();

    data.forEach(item => {
        if (!map.has(item.name)) {
            map.set(item.name, {
                name: item.name,
                category: item.category,
                is_best_seller: item.is_best_seller,
                isAvailable: false,
                items: []
            });
        }
        const group = map.get(item.name)!;
        group.items.push(item);
        if (item.available) group.isAvailable = true;
    });

    // Cast is safe: MenuGroup is a structural superset of Group
    return Array.from(map.values()).filter(group => group.items.length > 0) as Group[];
}

export function groupAvailableItemsByName(data: MenuItem[], isAdmin?: boolean): Group[] {
    if (!data || !Array.isArray(data)) {
        return [];
    }

    const map = new Map<string, MenuGroup>();

    data.forEach(item => {
        if (!map.has(item.name)) {
            map.set(item.name, {
                name: item.name,
                category: item.category,
                is_best_seller: item.is_best_seller,
                isAvailable: isAdmin ? true : false,
                items: []
            });
        }
        const group = map.get(item.name)!;
        group.items.push(item);
        if (!item.available && isAdmin) {
            item.available = true;
        }
        if (item.available) group.isAvailable = true;
    });

    // Cast is safe: MenuGroup is a structural superset of Group
    return Array.from(map.values()).filter(group => group.items.length > 0) as Group[];
}

export function groupItemsByCategory(groups: GroupWithMeta[]): CategoryGroups {
    const bestsellers = groups.filter(x => x.is_best_seller === true);
    const pizzaBaguettes = groups.filter(x => x.category === 'Baguette Pizzas');
    const brickPizzas = groups.filter(x => x.category === 'Brick Pizzas');
    const combos = groups.filter(x => x.category === 'Combo Deals');
    const pizzas = groups.filter(x => x.category === 'Pizzas');
    const sides = groups.filter(x => x.category === 'Sides');
    const beverages = groups.filter(x => x.category === 'Beverages');
    const sauces = groups.filter(x => x.category === 'Sauces');
    const ramadan = groups.filter(x => x.category === 'Ramadan');
    return {
        bestsellers,
        brickPizzas,
        combos,
        pizzas,
        sides,
        beverages,
        sauces,
        ramadan,
        pizzaBaguettes
    };
}

// The item a group is represented by on the menu card (its photo, price and name).
// MenuItemCardHorizontal and the image preloader MUST agree on this: the preloader warms the
// browser cache by URL, so picking a different item there would fetch a photo the card never
// renders and leave the card itself uncached.
export function pickDefaultItem(group: Group): MenuItem {
    return group.items.find(i => i.size === "S") || group.items[0];
}

// Photo URLs of the first `limit` cards in render order — the ones the customer sees first, and
// therefore the only ones worth blocking the loader on. Walks sections in MENU_SECTION_ORDER so
// this matches what MenuSections paints top to bottom.
export function collectPreloadUrls(groups: CategoryGroups, limit: number): string[] {
    const urls: string[] = [];

    for (const section of MENU_SECTION_ORDER) {
        for (const group of groups[section]) {
            if (urls.length >= limit) return urls;
            // Groups can repeat across sections (a bestseller also appears in its own category),
            // and an item may carry no photo at all — neither is worth a preload slot.
            const photo = pickDefaultItem(group)?.photo;
            if (photo && !urls.includes(photo)) urls.push(photo);
        }
    }

    return urls;
}
