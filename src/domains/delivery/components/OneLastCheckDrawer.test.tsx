import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { OneLastCheckDrawer } from "./OneLastCheckDrawer";
import type { CustomerAddress } from "../types";
import type { CartItem } from "../../menu/types";

const ADDRESS: CustomerAddress = {
    id: "a1", label: "Home", block: "338", road: "3801", building: "12", flat: null,
    note: null, latitude: 26.2285, longitude: 50.586,
};

const ITEMS = [
    { name: "Pepperoni", quantity: 2, amount: 3.5 } as CartItem,
    { name: "Coke", quantity: 1, amount: 0.8 } as CartItem,
];

function renderSheet(overrides: Partial<React.ComponentProps<typeof OneLastCheckDrawer>> = {}) {
    const onConfirm = jest.fn<void, []>();
    const onEdit = jest.fn<void, []>();
    const onClose = jest.fn<void, []>();
    render(
        <I18nextProvider i18n={i18n}>
            <OneLastCheckDrawer
                open address={ADDRESS} items={ITEMS} paymentLabel="Card"
                onConfirm={onConfirm} onEdit={onEdit} onClose={onClose} {...overrides}
            />
        </I18nextProvider>
    );
    return { onConfirm, onEdit, onClose };
}

describe("OneLastCheckDrawer", () => {
    it("shows the Bahrain address parts, not a formatted street line", () => {
        renderSheet();
        expect(screen.getByText(/Block 338, Road 3801, Building 12/)).toBeTruthy();
    });

    it("lists the items and the total", () => {
        renderSheet();
        expect(screen.getByText("2 × Pepperoni")).toBeTruthy();
        // 2 x 3.50 + 1 x 0.80
        expect(screen.getByText("7.80")).toBeTruthy();
    });

    it("confirms and offers an escape back to the cart", () => {
        const { onConfirm, onEdit } = renderSheet();

        fireEvent.click(screen.getByRole("button", { name: /looks good/i }));
        fireEvent.click(screen.getByRole("button", { name: /edit order/i }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    /** Confirming with no address would send an unroutable order to a paid checkout. */
    it("cannot be confirmed without an address", () => {
        renderSheet({ address: null });
        const confirm = screen.getByRole("button", { name: /looks good/i }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
    });
});
