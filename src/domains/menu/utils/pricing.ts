import type { ExtraIngr, Topping } from "../types";
import { ingredientNames } from "./customizations";

/**
 * Single home for the per-unit price of a customized pizza line.
 *
 * The price of a line is only ever `base size price + selected extras + selected drizzles`, but
 * it used to be computed inline in the popup AND (incorrectly, base-only) in the cart's size
 * toggle — so changing size after customizing silently gave the extras away for free. Every
 * caller now goes through {@link pizzaUnitPrice} so there is one place that can be wrong.
 *
 * Unknown names contribute nothing on purpose: the popups render free pseudo-ingredients
 * ("garlic crust", "cherry") that have no catalog row at all.
 */

/** Extras are per-size catalog rows, so their price is only defined relative to a size. */
export function extrasCost(names: string[], extras: ExtraIngr[], size: string | null): number {
    const forSize = extras.filter(extra => extra.size === size);
    return names.reduce((sum, name) => {
        const found = forSize.find(extra => extra.name === name);
        return sum + (found?.price ?? 0);
    }, 0);
}

/** The drizzle catalog is not size-scoped — one row per name. */
export function toppingsCost(names: string[], toppings: Topping[]): number {
    return names.reduce((sum, name) => {
        const found = toppings.find(topping => topping.name === name);
        return sum + (found?.price ?? 0);
    }, 0);
}

export type PizzaUnitPriceInput = {
    basePrice: number;
    size: string | null;
    /** Accepts either runtime shape — see {@link ingredientNames}. */
    extraIngredients?: ReadonlyArray<string | { name?: string | null }> | null;
    toppings?: ReadonlyArray<string | { name?: string | null }> | null;
    extrasCatalog: ExtraIngr[];
    toppingsCatalog: Topping[];
};

export function pizzaUnitPrice(input: PizzaUnitPriceInput): number {
    return input.basePrice
        + extrasCost(ingredientNames(input.extraIngredients), input.extrasCatalog, input.size)
        + toppingsCost(ingredientNames(input.toppings), input.toppingsCatalog);
}
