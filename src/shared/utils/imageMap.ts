import type { Order, OrderItem, ComboItemTO } from '../../domains/order/types';

export const imageMap: Record<string, string> = {
  "Pepperoni": "/menuImages/Pepperoni-Pizza.webp",
    "Marinara Sauce": "/menuImages/Marinara-Sauce.webp",
  "Hot Honey Sauce": "/menuImages/Hot-Honey-Sauce.webp",
  "Cheesy Garlic Baguette": "/menuImages/Garlic-Baguette.webp",
  "Coca Cola Zero": "/menuImages/Cola-Zero.webp",
  "Margherita": "/menuImages/Margherita-Pizza.webp",
  "BBQ Chicken Ranch": "/menuImages/BBQ-Pizza.webp",
  "Smoked Turkey And Mushroom": "/menuImages/Smoked-Turkey-Pizza.webp",
  "Four Cheese": "/menuImages/four-c.webp",
  "Seafood": "/menuImages/Seafood-Pizza.webp",
  "Hawaiian": "/menuImages/Hawaiian-Pizza.webp",
  "Vegetarian": "/menuImages/Vegetarian-Pizza.webp",
  "Veggie Mexican": "/menuImages/VMexican-Pizza.webp",
  "Ranch Sauce": "/menuImages/Ranch-Sauce.webp",
  "BBQ Sauce": "/menuImages/BBQ-Sauce.webp",
  "Honey Mustard Sauce": "/menuImages/Mustard-Honey.webp",
  "Coca Cola": "/menuImages/Cola.webp",
  "7Up Diet": "/menuImages/7Up-Diet.webp",
  "Fanta Orange": "/menuImages/Fanta.webp",
  "Kinza Cola": "/menuImages/Kinza-Cola.webp",
  "Water": "/menuImages/Wodichka.webp",
  "Pepperoni Detroit Brick": "/menuImages/Pepperoni-Brick.webp",
  "Smoked Turkey And Mushroom Detroit Brick": "/menuImages/Smoked-Turkey-Brick.webp",
  "BBQ Chicken Ranch Detroit Brick": "/menuImages/BBQ-Brick.webp",
  "Margherita Detroit Brick": "/menuImages/Margherita-Brick.webp",
  "Mirinda Citrus": "/menuImages/Mirinda.webp",
  "7Up": "/menuImages/7Up.webp",
  "Pizza Combo": "/menuImages/Pizza-Combo.webp",
  "Detroit Combo": "/menuImages/Detroit-Combo.webp",
  "BBQ Chicken Ranch Baguette Pizza": "/menuImages/BBQ-Chicken-Ranch-Baguette-Pizza.webp",
  "Pepperoni Baguette Pizza": "/menuImages/Pepperoni-Baguette.webp",
  "Smoked Turkey & Mushroom Baguette Pizza": "/menuImages/Smoked-Turkey-Mushroom-Baguette-Pizza.webp",
};

// ComboItemTO does not declare photo; this local extension captures what the API
// actually returns at runtime so we can map photos without changing the shared type.
type ComboItemWithPhoto = ComboItemTO & { photo?: string };

// OrderItem with comboItemTO widened to include the runtime photo field,
// plus comboItems (from CartItem shape) for backward-compatibility with callers.
type OrderItemExtended = Omit<OrderItem, 'comboItemTO'> & {
    comboItemTO?: ComboItemWithPhoto[];
    comboItems?: ComboItemWithPhoto[];
};

export function mapItemImage(item: OrderItemExtended): OrderItemExtended {
    return {
        ...item,
        photo: imageMap[item.name] || item.photo,
        comboItemTO: Array.isArray(item.comboItemTO)
            ? item.comboItemTO.map((ci) => ({
                ...ci,
                photo: imageMap[ci.name] || ci.photo,
            }))
            : item.comboItemTO,
        comboItems: Array.isArray(item.comboItems)
            ? item.comboItems.map((ci) => ({
                ...ci,
                photo: imageMap[ci.name] || ci.photo,
            }))
            : item.comboItems,
    };
}

export function mapOrderImages(order: Order): Order {
    if (order && Array.isArray(order.items)) {
        // OrderItem is structurally compatible with OrderItemExtended; the cast is safe
        order.items = order.items.map((item) => mapItemImage(item as OrderItemExtended) as OrderItem);
    }
    return order;
}

export function mapOrdersImages(orders: Order[]): Order[] {
    if (Array.isArray(orders)) {
        return orders.map(mapOrderImages);
    }
    return orders;
}
