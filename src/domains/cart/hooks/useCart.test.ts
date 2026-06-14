import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { useCart } from "./useCart";
import type { CartItem, MenuItem } from "../../menu/types";

function makeCartItem(
    name: string,
    category: string,
    amount: number,
    quantity = 1,
): CartItem {
    return {
        id: 1,
        name,
        size: "M",
        category,
        isThinDough: false,
        isGarlicCrust: false,
        extraIngredients: [],
        toppings: [],
        note: "",
        quantity,
        description: "",
        amount,
        discountAmount: 0,
        comboItems: null,
        photo: "",
    };
}

function makeMenuItem(name: string, category: string, size = "M", price = 5): MenuItem {
    return {
        id: 1,
        name,
        size,
        category,
        available: true,
        is_best_seller: false,
        photo: "",
        price,
        description: "",
    };
}

const MENU_WITH_COMBOS: MenuItem[] = [
    makeMenuItem("Pizza Combo", "Combo Deals", "M", 5),
    makeMenuItem("Pizza Combo", "Combo Deals", "L", 7),
    makeMenuItem("Detroit Combo", "Combo Deals", "M", 6),
];

describe("useCart — initial state", () => {
    it("starts with an empty cart", () => {
        const { result } = renderHook(() => useCart([], false));
        expect(result.current.cartItems).toEqual([]);
    });

    it("initial totalPrice is '0.00'", () => {
        const { result } = renderHook(() => useCart([], false));
        expect(result.current.totalPrice).toBe("0.00");
    });

    it("all popup booleans are false initially", () => {
        const { result } = renderHook(() => useCart([], false));
        expect(result.current.pizzaPopupOpen).toBe(false);
        expect(result.current.upsellPopupOpen).toBe(false);
        expect(result.current.cartOpen).toBe(false);
        expect(result.current.comboPopupOpen).toBe(false);
        expect(result.current.genericPopupOpen).toBe(false);
    });

    it("upsellItem and upsellType are null initially", () => {
        const { result } = renderHook(() => useCart([], false));
        expect(result.current.upsellItem).toBeNull();
        expect(result.current.upsellType).toBeNull();
    });
});

describe("useCart — handleAddToCart (non-pizza items)", () => {
    it("adds a beverage directly to the cart without triggering upsell", () => {
        const { result } = renderHook(() => useCart([], false));
        const item = makeCartItem("Water", "Beverages", 0.5);

        act(() => {
            result.current.handleAddToCart(item);
        });

        expect(result.current.cartItems).toHaveLength(1);
        expect(result.current.cartItems[0].name).toBe("Water");
        expect(result.current.upsellPopupOpen).toBe(false);
    });

    it("merges two identical non-pizza items by incrementing quantity", () => {
        const { result } = renderHook(() => useCart([], false));
        const item = makeCartItem("Ranch Sauce", "Sauces", 1.5);

        act(() => {
            result.current.handleAddToCart(item);
        });
        act(() => {
            result.current.handleAddToCart(item);
        });

        expect(result.current.cartItems).toHaveLength(1);
        expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it("adds two different non-pizza items as separate entries", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 0.5));
        });
        act(() => {
            result.current.handleAddToCart(makeCartItem("Ranch Sauce", "Sauces", 1.5));
        });

        expect(result.current.cartItems).toHaveLength(2);
    });

    it("closes the pizza popup and clears popupGroup after adding a non-pizza item", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.setPizzaPopupOpen(true);
        });
        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 0.5));
        });

        expect(result.current.pizzaPopupOpen).toBe(false);
        expect(result.current.popupGroup).toBeNull();
    });
});

describe("useCart — handleAddToCart (pizza upsell)", () => {
    it("opens the upsell popup for a pizza item when upsell not yet declined", () => {
        const { result } = renderHook(() => useCart(MENU_WITH_COMBOS, false));
        const pizza = makeCartItem("Margherita", "Pizzas", 3.5);

        act(() => {
            result.current.handleAddToCart(pizza);
        });

        expect(result.current.upsellPopupOpen).toBe(true);
        expect(result.current.upsellType).toBe("pizza");
        expect(result.current.upsellItem?.name).toBe("Margherita");
    });

    it("does NOT add pizza to cartItems while upsell popup is open", () => {
        const { result } = renderHook(() => useCart(MENU_WITH_COMBOS, false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Margherita", "Pizzas", 3.5));
        });

        expect(result.current.cartItems).toHaveLength(0);
    });

    it("adds a pizza directly when upsellDeclined=true, bypassing upsell", () => {
        const { result } = renderHook(() => useCart(MENU_WITH_COMBOS, false));
        const pizza = makeCartItem("Margherita", "Pizzas", 3.5);

        act(() => {
            result.current.handleAddToCart(pizza, true);
        });

        expect(result.current.upsellPopupOpen).toBe(false);
        expect(result.current.cartItems).toHaveLength(1);
        expect(result.current.cartItems[0].name).toBe("Margherita");
    });

    it("opens the upsell popup for a brick pizza (Detroit Brick) category", () => {
        const { result } = renderHook(() => useCart(MENU_WITH_COMBOS, false));
        const brick = makeCartItem("Pepperoni Detroit Brick", "Brick Pizzas", 4.5);

        act(() => {
            result.current.handleAddToCart(brick);
        });

        expect(result.current.upsellPopupOpen).toBe(true);
        expect(result.current.upsellType).toBe("brick");
    });
});

describe("useCart — removeFromCart", () => {
    it("removes an item that matches name, amount, and quantity", () => {
        const { result } = renderHook(() => useCart([], false));
        const item = makeCartItem("Ranch Sauce", "Sauces", 1.5);

        act(() => {
            result.current.handleAddToCart(item);
        });
        act(() => {
            result.current.removeFromCart("Ranch Sauce", 1.5, 1);
        });

        expect(result.current.cartItems).toHaveLength(0);
    });

    it("does not remove an item when name does not match", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 0.5));
        });
        act(() => {
            result.current.removeFromCart("Ranch Sauce", 0.5, 1);
        });

        expect(result.current.cartItems).toHaveLength(1);
    });
});

describe("useCart — handleRemoveItemFromCart", () => {
    it("removes the exact item by reference", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 0.5));
        });

        const [addedItem] = result.current.cartItems;

        act(() => {
            result.current.handleRemoveItemFromCart(addedItem);
        });

        expect(result.current.cartItems).toHaveLength(0);
    });
});

describe("useCart — handleChangeQuantity", () => {
    it("updates quantity to the specified value", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 0.5));
        });

        const [item] = result.current.cartItems;

        act(() => {
            result.current.handleChangeQuantity(item, 3);
        });

        expect(result.current.cartItems[0].quantity).toBe(3);
    });

    it("ignores quantity changes to 0 or below", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 0.5));
        });

        const [item] = result.current.cartItems;

        act(() => {
            result.current.handleChangeQuantity(item, 0);
        });

        expect(result.current.cartItems[0].quantity).toBe(1);
    });
});

describe("useCart — totalPrice", () => {
    it("computes total as sum of (amount × quantity) across all items", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 2, 1));
        });
        act(() => {
            result.current.handleAddToCart(makeCartItem("Ranch Sauce", "Sauces", 1.5, 2));
        });

        // 2×1 + 1.5×2 = 5.00
        expect(result.current.totalPrice).toBe("5.00");
    });

    it("accounts for discountAmount in the total", () => {
        const { result } = renderHook(() => useCart([], false));
        const discountedItem: CartItem = { ...makeCartItem("Water", "Beverages", 10, 1), discountAmount: 50 };

        act(() => {
            result.current.handleAddToCart(discountedItem, true);
        });

        // 10 × (1 - 0.5) × 1 = 5.00
        expect(result.current.totalPrice).toBe("5.00");
    });

    it("decreases when an item is removed", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 2, 1));
        });
        act(() => {
            result.current.handleAddToCart(makeCartItem("Ranch Sauce", "Sauces", 1.5, 1));
        });

        const [first] = result.current.cartItems;

        act(() => {
            result.current.handleRemoveItemFromCart(first);
        });

        expect(result.current.totalPrice).toBe("1.50");
    });
});

describe("useCart — handleUpsellDecline", () => {
    it("adds the pending pizza to the cart after declining upsell", () => {
        const { result } = renderHook(() => useCart(MENU_WITH_COMBOS, false));
        const pizza = makeCartItem("Margherita", "Pizzas", 3.5);

        act(() => {
            result.current.handleAddToCart(pizza);
        });
        expect(result.current.upsellPopupOpen).toBe(true);

        act(() => {
            result.current.handleUpsellDecline();
        });

        expect(result.current.upsellPopupOpen).toBe(false);
        expect(result.current.cartItems).toHaveLength(1);
        expect(result.current.cartItems[0].name).toBe("Margherita");
    });

    it("clears upsellItem and upsellType after declining", () => {
        const { result } = renderHook(() => useCart(MENU_WITH_COMBOS, false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Margherita", "Pizzas", 3.5));
        });
        act(() => {
            result.current.handleUpsellDecline();
        });

        expect(result.current.upsellItem).toBeNull();
        expect(result.current.upsellType).toBeNull();
    });
});

describe("useCart — handleDiscountChange", () => {
    it("updates the discountAmount on the specified item", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.handleAddToCart(makeCartItem("Water", "Beverages", 10, 1));
        });

        const [item] = result.current.cartItems;

        act(() => {
            result.current.handleDiscountChange(item, 20);
        });

        expect(result.current.cartItems[0].discountAmount).toBe(20);
    });
});

// Jest mock — no jest.Mock<> type annotation (no @types/jest).
// Spy used only to assert call count, not to stub return value.
describe("useCart — setters exposed by the hook", () => {
    it("setCartOpen updates cartOpen state", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.setCartOpen(true);
        });

        expect(result.current.cartOpen).toBe(true);
    });

    it("setEditMode updates editMode state", () => {
        const { result } = renderHook(() => useCart([], false));

        act(() => {
            result.current.setEditMode(true);
        });

        expect(result.current.editMode).toBe(true);
    });
});
