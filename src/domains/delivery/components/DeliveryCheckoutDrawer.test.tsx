import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { DeliveryCheckoutDrawer } from "./DeliveryCheckoutDrawer";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { sheetHandleCount } from "../../../shared/components/sheetHandle.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import { createAddress, getDeliveryAvailability, listAddresses, updateAddress } from "../../../shared/api/delivery";
import type { CustomerAddress, DeliveryPaymentMethod } from "../types";
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
const mockCreate = jest.mocked(createAddress);
const mockUpdate = jest.mocked(updateAddress);

const ADDRESS: CustomerAddress = {
    id: "a1", label: "Home", block: "338", road: "3801", building: "12", flat: null,
    note: null, latitude: 26.2285, longitude: 50.586,
};

const AVAILABLE = { available: true, reason: null, branchId: "b1", etaMinutesMin: 20, etaMinutesMax: 30 };

// Listed on the §1.6 confirm sheet. Only name/quantity/amount are read there.
const ITEMS = [{ id: 7, name: "Pepperoni", quantity: 2, amount: 3.9, isThinDough: false, comboItems: null } as unknown as CartItem];
const BASKET = [{ id: 7, quantity: 2, isThinDough: false }];

beforeEach(() => {
    mockList.mockReset();
    mockGate.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockList.mockResolvedValue([ADDRESS]);
    mockGate.mockResolvedValue(AVAILABLE);
});

function renderDrawer() {
    const onConfirm = jest.fn<void, [CustomerAddress, typeof AVAILABLE, DeliveryPaymentMethod]>();
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
        await waitFor(() => expect(mockGate).toHaveBeenCalledWith({ latitude: 26.2285, longitude: 50.586 }, BASKET));
    });

    it("sends the basket with the Place order pin check so the server can refuse an order too big for the couriers", async () => {
        const { onUnavailable } = renderDrawer();
        await screen.findByText(/20–30 min/);
        mockGate.mockClear();
        mockGate.mockResolvedValue({ ...AVAILABLE, available: false, reason: "INSUFFICIENT_COURIERS" });

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));

        await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
        expect(mockGate).toHaveBeenCalledWith({ latitude: 26.2285, longitude: 50.586 }, BASKET);
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
        expect(mockGate).toHaveBeenCalledWith({ latitude: 26.2285, longitude: 50.586 }, BASKET);
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

    /**
     * §1.5 block 4. `payment_type` carries the EazyPay method onto the order, so it is real data
     * even while the provider is stubbed — and the only assertion that existed used the default,
     * which a component that ignored the toggle entirely would still satisfy.
     */
    it("carries a non-default payment method all the way to the caller", async () => {
        const { onConfirm } = renderDrawer();
        await screen.findByText(/20–30 min/);

        fireEvent.click(screen.getByRole("button", { name: /benefit/i }));
        fireEvent.click(screen.getByRole("button", { name: /place order/i }));
        fireEvent.click(await screen.findByRole("button", { name: /looks good/i }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        expect(onConfirm.mock.calls[0][2]).toBe("BENEFIT");
    });

    /**
     * The §1.6 sheet names the method, so a wrong choice is catchable before the charge.
     *
     * Read out of the "Paying with" block specifically: "Apple Pay" is also the label of the
     * toggle button on the screen behind, so a document-wide query would pass with the confirm
     * sheet hard-coded to Card.
     */
    it("names the chosen method on the confirm sheet", async () => {
        renderDrawer();
        await screen.findByText(/20–30 min/);

        fireEvent.click(screen.getByRole("button", { name: /apple pay/i }));
        fireEvent.click(screen.getByRole("button", { name: /place order/i }));
        await screen.findByRole("button", { name: /looks good/i });

        const payingWith = screen.getByText("Paying with").nextElementSibling;
        expect(payingWith?.textContent).toBe("Apple Pay");
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

    describe("editing a saved address (the pencil)", () => {
        it("opens the editor seeded with that address rather than a blank form", async () => {
            renderDrawer();
            await screen.findByText(/Block 338/);

            fireEvent.click(screen.getByRole("button", { name: /edit address/i }));

            expect(await screen.findByRole("button", { name: /save changes/i })).toBeTruthy();
            expect((screen.getByLabelText(/building/i) as HTMLInputElement).value).toBe("12");
        });

        /**
         * The pin drives nearest-branch routing, the radius check and the ETA, and this row may
         * already be attached to an order a courier is running. The pencil must not offer to move
         * it, and the PATCH must not carry one.
         */
        it("does not offer to move the pin, and sends text only", async () => {
            mockUpdate.mockResolvedValue({ ...ADDRESS, building: "14" });
            renderDrawer();
            await screen.findByText(/Block 338/);

            fireEvent.click(screen.getByRole("button", { name: /edit address/i }));
            await screen.findByRole("button", { name: /save changes/i });

            expect(screen.queryByRole("button", { name: /use my current location/i })).toBeNull();
            expect(screen.queryByRole("button", { name: /update location/i })).toBeNull();

            fireEvent.change(screen.getByLabelText(/building/i), { target: { value: "14" } });
            fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

            await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
            const [, addressId, body] = mockUpdate.mock.calls[0];
            expect(addressId).toBe("a1");
            expect(body).toEqual({
                label: "Home", block: "338", road: "3801", building: "14", flat: null, note: null,
            });
            expect(body).not.toHaveProperty("latitude");
            expect(body).not.toHaveProperty("longitude");
        });

        it("shows the corrected text in the list once the edit lands", async () => {
            mockUpdate.mockResolvedValue({ ...ADDRESS, building: "14" });
            renderDrawer();
            await screen.findByText(/Block 338/);

            fireEvent.click(screen.getByRole("button", { name: /edit address/i }));
            await screen.findByRole("button", { name: /save changes/i });
            fireEvent.change(screen.getByLabelText(/building/i), { target: { value: "14" } });
            fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

            expect(await screen.findByText(/Building 14/)).toBeTruthy();
        });

        // Reaching for the pencil is not a choice of where to deliver.
        it("does not change the selection when the pencil is clicked", async () => {
            const second: CustomerAddress = { ...ADDRESS, id: "a2", label: "Office", building: "99" };
            mockList.mockResolvedValue([ADDRESS, second]);
            renderDrawer();
            await screen.findByText(/Building 99/);

            fireEvent.click(screen.getAllByRole("button", { name: /edit address/i })[1]);
            await screen.findByRole("button", { name: /save changes/i });

            // Seeded from the row whose pencil was clicked, not from the selected one.
            expect((screen.getByLabelText(/building/i) as HTMLInputElement).value).toBe("99");
        });
    });

    /**
     * The server folds a re-save of the same doorstep onto the existing row and returns it. The
     * customer must end up on that address — not looking at a duplicate, and not at an error.
     */
    it("selects the existing address when a save is deduplicated server-side", async () => {
        mockCreate.mockResolvedValue(ADDRESS);
        renderDrawer();
        await screen.findByText(/Block 338/);

        fireEvent.click(screen.getByRole("button", { name: /add a new address/i }));
        // The picker seeds no pin, so drive the save through the location capture it requires.
        Object.defineProperty(global.navigator, "geolocation", {
            value: { getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
                    ok({ coords: { latitude: 26.2286, longitude: 50.586 } }) },
            configurable: true,
        });
        fireEvent.click(await screen.findByRole("button", { name: /use my current location/i }));
        await waitFor(() => expect(
            (screen.getByRole("button", { name: /save address/i }) as HTMLButtonElement).disabled
        ).toBe(false));
        fireEvent.click(screen.getByRole("button", { name: /save address/i }));

        await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
        // One row, not two: the returned address was already in the list.
        expect(await screen.findAllByText(/Block 338/)).toHaveLength(1);
    });
});

describe("DeliveryCheckoutDrawer on PC", () => {
    afterEach(() => {
        clearMatchMedia();
    });

    it("is a centred 520px dialog with no handle, and Place order still leads to the confirm step", async () => {
        stubMatchMedia(true);
        const { onConfirm } = renderDrawer();
        await screen.findByText(/20–30 min/);

        const paper = document.querySelector(".MuiDialog-paper");
        expect(paper).toBeTruthy();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        expect(emotionRulesFor(paper as Element)).toContain("width:min(520px, 92vw)");
        expect(sheetHandleCount(paper as Element)).toBe(0);

        fireEvent.click(screen.getByRole("button", { name: /place order/i }));
        fireEvent.click(await screen.findByRole("button", { name: /looks good/i }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    });
});
