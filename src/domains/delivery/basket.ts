// Maps the cart to the basket the availability gate sizes (see DeliveryBasketLine). Kept beside the
// delivery types so the cart and the checkout drawer build it the same way.
import type { CartItem } from '../menu/types';
import type { DeliveryBasketLine } from './types';

export function toDeliveryBasket(items: CartItem[]): DeliveryBasketLine[] {
    return items.map((item) => {
        const line: DeliveryBasketLine = {
            id: item.id,
            quantity: item.quantity,
            isThinDough: item.isThinDough,
        };
        // Older cart shapes never carried the field, so undefined is treated like null.
        if (item.comboItems && item.comboItems.length > 0) {
            line.comboItems = item.comboItems.map((child) => ({
                id: child.id,
                quantity: child.quantity,
                isThinDough: child.isThinDough,
            }));
        }
        return line;
    });
}

/** A stable string for "did the basket change" — id, quantity, dough and combo children per line. */
export function basketSignature(basket: DeliveryBasketLine[]): string {
    return JSON.stringify(basket);
}
