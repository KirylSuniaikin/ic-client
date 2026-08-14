import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { DeliveryCheckoutDrawer } from "./DeliveryCheckoutDrawer";
import { getDeliveryAvailability, listAddresses } from "../../../shared/api/delivery";
import type { CustomerAddress } from "../types";

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
            <DeliveryCheckoutDrawer open onClose={jest.fn()} onConfirm={onConfirm} onUnavailable={onUnavailable} />
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

    /** §1.2 step 2 — the gate runs again immediately before payment, because state moves. */
    it("re-checks availability on Place order and confirms when it passes", async () => {
        const { onConfirm } = renderDrawer();
        // Wait for the ETA fetch to settle: while it is in flight the button renders a spinner
        // and has no accessible name.
        await screen.findByText(/20–30 min/);
        mockGate.mockClear();

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(mockGate).toHaveBeenCalledWith({ latitude: 26.2285, longitude: 50.586 });
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
