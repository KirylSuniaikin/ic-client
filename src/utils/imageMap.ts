export const imageMap: Record<string, string> = {
  "Pepperoni": "/menuImages/Pepperoni-Pizza.webp",
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

export function mapItemImage(item: any): any {
    if (!item) return item;
    return {
        ...item,
        photo: imageMap[item.name] || item.photo,
        comboItemTO: Array.isArray(item.comboItemTO) ? item.comboItemTO.map((ci: any) => ({
            ...ci,
            photo: imageMap[ci.name] || ci.photo
        })) : item.comboItemTO,
        comboItems: Array.isArray(item.comboItems) ? item.comboItems.map((ci: any) => ({
            ...ci,
            photo: imageMap[ci.name] || ci.photo
        })) : item.comboItems
    };
}

export function mapOrderImages(order: any): any {
    if (order && Array.isArray(order.items)) {
        order.items = order.items.map(mapItemImage);
    }
    return order;
}

export function mapOrdersImages(orders: any[]): any[] {
    if (Array.isArray(orders)) {
        return orders.map(mapOrderImages);
    }
    return orders;
}