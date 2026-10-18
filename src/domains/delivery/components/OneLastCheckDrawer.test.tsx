import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { OneLastCheckDrawer } from "./OneLastCheckDrawer";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { sheetHandleCount } from "../../../shared/components/sheetHandle.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
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

    it("names the method it was given", () => {
        renderSheet();

        expect(screen.getByText("Paying with")).toBeTruthy();
        expect(screen.getByText("Card")).toBeTruthy();
    });

    // Owner, 19 Oct 2026: the delivery checkout picks its method on the payment page after this sheet.
    it("leaves the method out when none is chosen yet", () => {
        renderSheet({ paymentLabel: undefined });

        expect(screen.queryByText("Paying with")).toBeNull();
        expect(screen.getByRole("button", { name: /looks good/i })).toBeTruthy();
    });

    /** Confirming with no address would send an unroutable order to a paid checkout. */
    it("cannot be confirmed without an address", () => {
        renderSheet({ address: null });
        const confirm = screen.getByRole("button", { name: /looks good/i }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
    });

    /**
     * A disabled button with a blank line above it looks broken rather than incomplete. This is
     * the last screen before a charge — it has to say what is missing.
     */
    it("says no address is selected rather than showing an empty line", () => {
        renderSheet({ address: null });

        expect(screen.getByText("No address selected")).toBeTruthy();
    });

    /**
     * The pin-only address (§12.7: the pin is the single value everything downstream depends on).
     * Every Bahrain part is null, `formatAddressLine` returns "", and the sheet must name it
     * rather than render the address block with nothing in it.
     */
    it("names a bare pin rather than leaving the address line empty", () => {
        renderSheet({ address: { ...ADDRESS, block: null, road: null, building: null, flat: null } });

        expect(screen.getByText("Pinned location")).toBeTruthy();
    });

    /**
     * The discounted cart (DELIVERY_COVERAGE_MATRIX.md defect D-3). The lines print at full price
     * and the saving gets its own row, so the numbers on this screen add up: lines − discount =
     * total. Before this they did not, on the last screen before a charge.
     */
    describe("a discounted cart", () => {
        const DISCOUNTED = [
            { name: "Pepperoni", quantity: 2, amount: 3.5, discountAmount: 50 } as CartItem,
            { name: "Coke", quantity: 1, amount: 0.8 } as CartItem,
        ];

        it("keeps the line at its full price", () => {
            renderSheet({ items: DISCOUNTED });

            // 2 x 3.50, not 2 x 1.75 — the customer recognises the price they chose.
            expect(screen.getByText("7.00")).toBeTruthy();
        });

        it("names the saving on its own row", () => {
            renderSheet({ items: DISCOUNTED });

            expect(screen.getByText("Discount")).toBeTruthy();
            // 50% off 2 x 3.50.
            expect(screen.getByText("-3.50")).toBeTruthy();
        });

        it("charges the discounted total, and the rows add up to it", () => {
            renderSheet({ items: DISCOUNTED });

            // 7.00 + 0.80 - 3.50
            expect(screen.getByText("4.30")).toBeTruthy();
        });

        /** A "-0.00" row on every undiscounted cart is noise; the ordinary cart must not grow one. */
        it("says nothing about a discount when there is none", () => {
            renderSheet();

            expect(screen.queryByText("Discount")).toBeNull();
        });
    });

    /** The method is chosen a screen earlier; this is the last chance to notice it is wrong. */
    it("names the payment method the order is about to be charged to", () => {
        renderSheet({ paymentLabel: "Benefit" });

        expect(screen.getByText("Benefit")).toBeTruthy();
    });
});

describe("OneLastCheckDrawer on PC", () => {
    afterEach(() => {
        clearMatchMedia();
    });

    it("is a centred 520px dialog with no handle whose Looks good still confirms", () => {
        stubMatchMedia(true);
        const { onConfirm } = renderSheet();

        const paper = document.querySelector(".MuiDialog-paper");
        expect(paper).toBeTruthy();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        expect(emotionRulesFor(paper as Element)).toContain("width:min(520px, 92vw)");
        expect(sheetHandleCount(paper as Element)).toBe(0);

        fireEvent.click(screen.getByRole("button", { name: /looks good/i }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("shows a Close button, since a centred dialog has no swipe to dismiss it", () => {
        stubMatchMedia(true);
        const { onClose } = renderSheet();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the phone sheet free of a Close button", () => {
        stubMatchMedia(false);
        renderSheet();

        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });
});
