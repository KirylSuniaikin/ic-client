import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { DeliveryCheckoutDrawer } from "./DeliveryCheckoutDrawer";
import { getDeliveryAvailability, listAddresses } from "../../../shared/api/delivery";
import type { CustomerAddress } from "../types";
import type { CartItem } from "../../menu/types";

jest.mock("../../../shared/api/delivery");
jest.mock("../../customer-auth/context/CustomerAuthProvider", () => ({
    useCustomerAuth: () => ({ token: "tok-1" }),
}));

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const mockList = jest.mocked(listAddresses);
const mockGate = jest.mocked(getDeliveryAvailability);

const ADDRESS: CustomerAddress = {
    id: "a1", label: "Home", block: "338", road: "3801", building: "12", flat: null,
    note: null, latitude: 26.2285, longitude: 50.586,
};

const AVAILABLE = { available: true, reason: null, branchId: "b1", etaMinutesMin: 20, etaMinutesMax: 30 };

// Listed on the §1.6 confirm sheet. Only name/quantity/amount are read there.
const ITEMS = [{ name: "Pepperoni", quantity: 2, amount: 3.9 } as unknown as CartItem];

beforeEach(() => {
    mockList.mockReset();
    mockGate.mockReset();
    mockList.mockResolvedValue([ADDRESS]);
    mockGate.mockResolvedValue(AVAILABLE);
});

function renderDrawer() {
    const onConfirm = jest.fn<void, [CustomerAddress, typeof AVAILABLE]>();
    const onUnavailable = jest.fn<void, [typeof AVAILABLE]>();
    render(
        <I18nextProvider i18n={i18n}>
            <DeliveryCheckoutDrawer open onClose={jest.fn()} items={ITEMS}
                                    onConfirm={onConfirm} onUnavailable={onUnavailable} />
        </I18nextProvider>
    );
    return { onConfirm, onUnavailable };
}

describe("DeliveryCheckoutDrawer", () => {
    it("preselects the newest saved address so a repeat customer can order in one tap", async () => {
        renderDrawer();
        expect(await screen.findByText(/Block 338/)).toBeTruthy();
        await waitFor(() => expect(mockGate).toHaveBeenCalledWith({ latitude: 26.2285, longitude: 50.586 }));
    });

    it("shows the ETA range for the selected pin", async () => {
        renderDrawer();
        expect(await screen.findByText(/20–30 min/)).toBeTruthy();
    });

    /**
     * §1.5 explicitly requires a fallback string. The estimate is null whenever it cannot be
     * computed honestly, and inventing a number for an order someone is waiting on is worse
     * than admitting we don't know it yet.
     */
    it("falls back to a non-committal line when no ETA can be computed", async () => {
        mockGate.mockResolvedValue({ ...AVAILABLE, etaMinutesMin: null, etaMinutesMax: null });
        renderDrawer();
        expect(await screen.findByText(/confirm your delivery time shortly/i)).toBeTruthy();
    });

    /**
     * §1.2 step 2 — the gate runs again immediately before payment, because state moves. Passing
     * it opens the §1.6 confirm sheet; the charge happens only after the customer accepts there.
     */
    it("re-checks availability on Place order and opens the confirm sheet instead of charging", async () => {
        const { onConfirm } = renderDrawer();
        // Wait for the ETA fetch to settle: while it is in flight the button renders a spinner
        // and has no accessible name.
        await screen.findByText(/20–30 min/);
        mockGate.mockClear();

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));

        expect(await screen.findByRole("button", { name: /looks good/i })).toBeTruthy();
        expect(mockGate).toHaveBeenCalledWith({ latitude: 26.2285, longitude: 50.586 });
        // The whole point of §1.6: nothing is charged until the customer accepts what it shows.
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("confirms with the gate result the sheet was opened with once the customer accepts", async () => {
        const { onConfirm } = renderDrawer();
        await screen.findByText(/20–30 min/);

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));
        fireEvent.click(await screen.findByRole("button", { name: /looks good/i }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(onConfirm).toHaveBeenCalledWith(
            expect.objectContaining({ id: "a1" }), expect.objectContaining(AVAILABLE), "CARD"
        );
    });

    it("returns to the checkout screen without charging when the customer backs out of the sheet", async () => {
        const { onConfirm } = renderDrawer();
        await screen.findByText(/20–30 min/);

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));
        fireEvent.click(await screen.findByRole("button", { name: /edit order/i }));

        await waitFor(() => expect(screen.queryByRole("button", { name: /looks good/i })).toBeNull());
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // One screen at a time (§1.6 reads as a step forward, not as a sheet dropped on top of the
    // one before it). The checkout screen must come back intact when the customer steps back.
    it("stands down while the confirm sheet is up and returns with its state on Edit order", async () => {
        renderDrawer();
        await screen.findByText(/20–30 min/);
        fireEvent.click(screen.getByRole("button", { name: /apple pay/i }));

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));
        await screen.findByRole("button", { name: /looks good/i });

        expect(screen.queryByRole("button", { name: /place order/i })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /edit order/i }));

        expect(await screen.findByRole("button", { name: /place order/i })).toBeTruthy();
        // The method survives the round trip — it lives in this component, not in the sheet.
        expect(screen.getByRole("button", { name: /apple pay/i }).getAttribute("aria-pressed")).toBe("true");
    });

    it("routes to the Keeta fallback instead of confirming when the final gate refuses", async () => {
        const { onConfirm, onUnavailable } = renderDrawer();
        await screen.findByText(/20–30 min/);
        mockGate.mockResolvedValue({ available: false, reason: "NO_COURIER", branchId: "b1",
            etaMinutesMin: null, etaMinutesMax: null });

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));

        await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("cannot place an order with no address", async () => {
        mockList.mockResolvedValue([]);
        renderDrawer();

        await waitFor(() => {
            const button = screen.getByRole("button", { name: /place order/i }) as HTMLButtonElement;
            expect(button.disabled).toBe(true);
        });
    });
});
