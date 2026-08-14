// Covers the delivery wiring HomePageModals owns (DELIVERY_SPEC.md §1.5 / §1.7): who receives the
// cart's checkout tap, and what is paid for afterwards. Every popup it composes has its own suite,
// so the children are mocked to probes and only this file's own logic is exercised.
import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../shared/i18n";

jest.mock("../shared/api/delivery");
// lottie-web touches a canvas jsdom doesn't provide; the popup tree pulls it in transitively.
// Same stub the other page-level suites use (OrderStatusPage.test.tsx).
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));
const mockUseCustomerAuth = jest.fn<{ token: string | null }, []>(() => ({ token: "tok-1" }));
jest.mock("../domains/customer-auth/context/CustomerAuthProvider", () => ({
    useCustomerAuth: () => mockUseCustomerAuth(),
}));

// Probes, not renders: each of these has its own suite, and mounting them here would drag in the
// menu/cart trees this file says nothing about.
const mockCartPopup = jest.fn();
jest.mock("../domains/cart/components/CartComponent", () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockCartPopup(props);
        return <div>CartPopup</div>;
    },
}));
const mockDeliveryDrawer = jest.fn();
jest.mock("../domains/delivery/components/DeliveryCheckoutDrawer", () => ({
    DeliveryCheckoutDrawer: (props: unknown) => {
        mockDeliveryDrawer(props);
        return <div>DeliveryCheckoutDrawer</div>;
    },
}));
jest.mock("../domains/delivery/components/KeetaFallbackCard", () => ({
    KeetaFallbackCard: () => <div>KeetaFallbackCard</div>,
}));
jest.mock("../shared/components/ErrorSnackbar", () => ({
    __esModule: true,
    default: () => <div>ErrorSnackbar</div>,
}));

import HomePageModals from "./HomePageModals";
import { payForDelivery } from "../shared/api/delivery";
import type { CustomerAddress, DeliveryAvailability, DeliveryPaymentMethod } from "../domains/delivery/types";
import type { UseCartResult } from "../domains/cart/hooks/useCart";
import type { UseCheckoutResult } from "../domains/order/hooks/useCheckout";

const mockPay = jest.mocked(payForDelivery);

const ADDRESS: CustomerAddress = {
    id: "addr-1", label: "Home", block: "338", road: "3801", building: "12", flat: null,
    note: null, latitude: 26.2285, longitude: 50.586,
};

// What useCheckout hands over: already built, already validated, not yet created (§1.7).
const PENDING_ORDER = {
    tel: "33112233", customer_name: "Andrew", type: "Delivery",
    payment_type: "Card (Through card machine)", branchId: "branch-default", notes: "",
    items: [], amount_paid: 12.5, idempotency_key: "idem-1",
};

const AVAILABLE: DeliveryAvailability = {
    available: true, reason: null, branchId: "branch-nearest", etaMinutesMin: 20, etaMinutesMax: 30,
};

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

// Only the fields these paths touch are set; the rest of the two hook surfaces is irrelevant here
// and spelling them all out would be noise that rots on the next hook change.
function createCart(overrides: Record<string, unknown> = {}): UseCartResult {
    return {
        cartItems: [],
        setCartItems: jest.fn(),
        setCartOpen: jest.fn(),
        cartOpen: true,
        ...overrides,
    } as unknown as UseCartResult;
}

function createCheckout(overrides: Record<string, unknown> = {}): UseCheckoutResult {
    return {
        orderType: "Pick Up",
        setOrderType: jest.fn(),
        paymentMethod: "Card (Through card machine)",
        handleCheckout: jest.fn(),
        setShowOrderConfirmed: jest.fn(),
        pendingDeliveryOrder: null,
        setPendingDeliveryOrder: jest.fn(),
        ...overrides,
    } as unknown as UseCheckoutResult;
}

function renderModals(
    cartOverrides: Record<string, unknown> = {},
    checkoutOverrides: Record<string, unknown> = {}
): void {
    render(
        <I18nextProvider i18n={i18n}>
            <HomePageModals
                cart={createCart(cartOverrides)}
                checkout={createCheckout(checkoutOverrides)}
                menuData={[]}
                toppings={[]}
                extraIngredients={[]}
                availableBranches={[]}
                isSDoughAvailable={false}
                phone="33112233"
                username="Andrew"
                branchSelector={null}
                setBranchSelector={jest.fn()}
                refreshMenu={jest.fn(async () => undefined)}
                pizzas={[]}
                brickPizzas={[]}
                beverages={[]}
                sauces={[]}
                isAdmin={false}
                isKiosk={false}
                adminBranchId={null}
            />
        </I18nextProvider>
    );
}

function capturedOnConfirm(): (
    address: CustomerAddress, availability: DeliveryAvailability, method: DeliveryPaymentMethod
) => void {
    const calls = mockDeliveryDrawer.mock.calls;
    const props = calls[calls.length - 1][0] as {
        onConfirm: (a: CustomerAddress, av: DeliveryAvailability, m: DeliveryPaymentMethod) => void;
    };
    return props.onConfirm;
}

describe("HomePageModals — delivery checkout hand-off", () => {
    beforeEach(() => {
        mockCartPopup.mockClear();
        mockDeliveryDrawer.mockClear();
        mockPay.mockReset();
        mockPay.mockResolvedValue({ orderId: "101", status: "PAID", stub: false });
        mockUseCustomerAuth.mockReturnValue({ token: "tok-1" });
    });

    it("opens the delivery checkout once useCheckout holds an order for payment", async () => {
        renderModals({}, { orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER });

        expect(mockDeliveryDrawer).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
    });

    it("stays shut for a pickup order", async () => {
        renderModals({}, { orderType: "Pick Up", pendingDeliveryOrder: null });

        expect(mockDeliveryDrawer).toHaveBeenCalledWith(expect.objectContaining({ open: false }));
    });

    /**
     * §1.4.5: the order is filed against the branch the gate resolved for that pin. Using the
     * default branch would send it to the wrong kitchen — which fails silently, so it is asserted.
     */
    it("pays with the chosen method and files against the branch the gate resolved", async () => {
        const setCartItems = jest.fn();
        const setPendingDeliveryOrder = jest.fn();
        renderModals({ setCartItems },
            { orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER, setPendingDeliveryOrder });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "BENEFIT"); });

        await waitFor(() => expect(mockPay).toHaveBeenCalledTimes(1));
        expect(mockPay).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "BENEFIT",
                addressId: "addr-1",
                order: expect.objectContaining({
                    type: "Delivery",
                    payment_type: "BENEFIT",
                    // Overrides the branch the cart defaulted to, not the pin's nearest branch.
                    branchId: "branch-nearest",
                    tel: "33112233",
                    idempotency_key: "idem-1",
                }),
            })
        );
        await waitFor(() => expect(setCartItems).toHaveBeenCalledWith([]));
    });

    /** A stubbed order must never read as a real charge. */
    it("says so when the payment was stubbed", async () => {
        mockPay.mockResolvedValue({ orderId: "101", status: "PAID", stub: true });
        renderModals({}, { orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "CARD"); });

        expect(await screenFindText(/test mode/i)).toBeTruthy();
    });

    it("surfaces a payment failure instead of clearing the cart", async () => {
        const setCartItems = jest.fn();
        mockPay.mockRejectedValue(new Error("Card declined"));
        renderModals({ setCartItems }, { orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "CARD"); });

        expect(await screenFindText(/Card declined/)).toBeTruthy();
        expect(setCartItems).not.toHaveBeenCalled();
    });
});

/** The notice lands in a MUI Snackbar, which renders in a portal — query the whole document. */
async function screenFindText(pattern: RegExp): Promise<HTMLElement> {
    return await waitFor(() => {
        const match = Array.from(document.body.querySelectorAll("*")).find(
            node => node.children.length === 0 && pattern.test(node.textContent ?? "")
        );
        if (!match) throw new Error(`No element matching ${String(pattern)}`);
        return match as HTMLElement;
    });
}
