import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// CartPopup renders its copy via useTranslation, so initialize the real i18n instance the
// same way app/providers.tsx does.
import "../../../shared/i18n";

import CartPopup from "./CartComponent";
import type { CartItem } from "../../menu/types";

function makeCartItem(): CartItem {
    return {
        id: 1,
        name: "Water",
        size: "M",
        category: "Beverages",
        isThinDough: false,
        isGarlicCrust: false,
        extraIngredients: [],
        toppings: [],
        note: "",
        quantity: 1,
        description: "",
        amount: 2.5,
        discountAmount: 0,
        comboItems: null,
        photo: "",
    };
}

const ITEMS: CartItem[] = [makeCartItem()];

function renderCart(overrides: Partial<React.ComponentProps<typeof CartPopup>> = {}) {
    const props: React.ComponentProps<typeof CartPopup> = {
        open: true,
        onClose: jest.fn<void, []>(),
        items: ITEMS,
        onChangeQuantity: jest.fn(),
        onChangeSize: jest.fn(),
        onRemoveItem: jest.fn(),
        onCheckout: jest.fn(),
        openPizzaEditPopUp: jest.fn(),
        openPizzaComboEditPopup: jest.fn(),
        openDetroitComboEditPopup: jest.fn(),
        isAdmin: false,
        handleDiscountChange: jest.fn(),
        menuData: [],
        ...overrides,
    };
    render(<CartPopup {...props} />);
    return props;
}

describe("CartPopup — order note field", () => {
    // Guests still enter their note in ClientInfoPopup, so showing one here too would give
    // them two competing note fields.
    it("does not render the note field by default (guest checkout)", () => {
        renderCart();

        expect(screen.queryByLabelText(/order note/i)).toBeNull();
    });

    it("renders the note field when showNoteField is set (logged-in customer)", () => {
        renderCart({ showNoteField: true });

        expect(screen.getByLabelText(/order note/i)).toBeTruthy();
    });

    it("calls onNoteChange as the customer types", () => {
        const onNoteChange = jest.fn<void, [string]>();
        renderCart({ showNoteField: true, note: "", onNoteChange });

        fireEvent.change(screen.getByLabelText(/order note/i), { target: { value: "no onions" } });

        expect(onNoteChange).toHaveBeenCalledWith("no onions");
    });

    // The note is the 6th handleCheckout arg (notes); a logged-in customer skips the popup, so
    // this is the only path that carries their note to the order.
    it("passes the note to onCheckout when the customer checks out", () => {
        const onCheckout = jest.fn();
        renderCart({ showNoteField: true, note: "extra spicy", onCheckout });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, null, null, "extra spicy");
    });
});
