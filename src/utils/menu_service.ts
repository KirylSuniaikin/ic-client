import type { MenuItem, Group } from '../management/types/menuTypes';

// Local type for the map values which carry extra metadata not present in Group.
// The final return casts to Group[] since callers only need name + items.
type MenuGroup = {
    name: string;
    category: string;
    is_best_seller: boolean;
    isAvailable: boolean;
    items: MenuItem[];
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

    const filteredGroups = Array.from(map.values()).filter(group => group.items.length > 0);
    localStorage.setItem("availableMenuGroups", JSON.stringify(filteredGroups));
    // Cast is safe: MenuGroup is a structural superset of Group
    return filteredGroups as Group[];
}
