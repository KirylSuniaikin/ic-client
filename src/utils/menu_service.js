export function groupItemsByName(data) {
    const map = new Map();

    data.forEach(item => {
        if (!map.has(item.name)) {
            map.set(item.name, {
                name: item.name,
                category: item.category,
                is_best_seller: item.is_best_seller,
                items: []
            });
        }
        map.get(item.name).items.push(item);
    });

    return  Array.from(map.values()).filter(group => group.items.length > 0);
}


export function groupAvailableItemsByName(data) {
    const map = new Map();

    data.forEach(item => {
        if (!item.available) {
            return;
        }

        if (!map.has(item.name)) {
            map.set(item.name, {
                name: item.name,
                category: item.category,
                is_best_seller: item.is_best_seller,
                items: []
            });
        }
        map.get(item.name).items.push(item);
    });

    const filteredGroups = Array.from(map.values()).filter(group => group.items.length > 0);
    localStorage.setItem("availableMenuGroups", JSON.stringify(filteredGroups));
    return filteredGroups;
}