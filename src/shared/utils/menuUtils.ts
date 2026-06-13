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

export function groupAvailableItemsByName(data: MenuItem[]): Group[] {
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
