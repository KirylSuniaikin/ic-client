export function groupItemsByCategory(groups) {
    const bestsellers = groups.filter(x => x.is_best_seller === true);
    const brickPizzas = groups.filter(x => x.category === 'Brick Pizzas');
    const combos = groups.filter(x => x.category === 'Combo Deals');
    const pizzas = groups.filter(x => x.category === 'Pizzas');
    const sides = groups.filter(x => x.category === 'Sides');
    const beverages = groups.filter(x => x.category === 'Beverages');
    const sauces = groups.filter(x => x.category === 'Sauces');
    console.log(brickPizzas);
    return {
        bestsellers,
        brickPizzas,
        combos,
        pizzas,
        sides,
        beverages,
        sauces,
    };
}