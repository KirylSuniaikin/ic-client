import type { Group } from '../management/types/menuTypes';

// Local type that includes the category/is_best_seller fields present in the
// grouped menu data returned by the API (Group only has name + items).
type GroupWithMeta = Group & {
    category: string;
    is_best_seller: boolean;
};

type CategoryGroups = {
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
