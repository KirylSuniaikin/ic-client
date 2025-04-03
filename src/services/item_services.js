export function groupItemsByCategory(items) {
    const bestsellers = items.filter(x => x.isBestSeller === true);
    const combos = items.filter(x => x.category === 'Combo Deals');
    const pizzas = items.filter(x => x.category === 'Pizzas');
    const sides = items.filter(x => x.category === 'Sides');
    const beverages = items.filter(x => x.category === 'Beverages');
    const sauces = items.filter(x => x.category === 'Sauces');

    return {
        bestsellers,
        combos,
        pizzas,
        sides,
        beverages,
        sauces,
    };
}