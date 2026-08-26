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
// HomePageModals seeds the homepage island itself on the delivery path (the pickup path does it
// from useCheckout). Mocked rather than wrapped in a real provider: this suite renders the modals
// bare, and the provider needs the whole customer-auth stack behind it.
const mockRefreshActiveOrder = jest.fn();
jest.mock("../domains/customer-auth/context/CustomerAuthUiProvider", () => ({
    useCustomerAuthUi: () => ({ refreshActiveOrder: mockRefreshActiveOrder }),
}));

jest.mock("../shared/components/ErrorSnackbar", () => ({
    __esModule: true,
    default: () => <div>ErrorSnackbar</div>,
}));

// Both have their own suites (BranchPickerDrawer.test.tsx / BranchSwitchWarningDrawer.test.tsx) —
// probes here, same as CartPopup/DeliveryCheckoutDrawer above, so this file only exercises the
// wiring it owns (task-spec.md §6.4: which mount serves the gate vs. the voluntary switch).
const mockBranchPickerDrawer = jest.fn();
jest.mock("../domains/branch/components/BranchPickerDrawer", () => ({
    BranchPickerDrawer: (props: unknown) => {
        mockBranchPickerDrawer(props);
        return <div>BranchPickerDrawer</div>;
    },
}));
const mockBranchSwitchWarningDrawer = jest.fn();
jest.mock("../domains/branch/components/BranchSwitchWarningDrawer", () => ({
    BranchSwitchWarningDrawer: (props: unknown) => {
        mockBranchSwitchWarningDrawer(props);
        return <div>BranchSwitchWarningDrawer</div>;
    },
}));

import HomePageModals from "./HomePageModals";
import { payForDelivery } from "../shared/api/delivery";
import type { CustomerAddress, DeliveryAvailability, DeliveryPaymentMethod } from "../domains/delivery/types";
import type { UseKioskCheckoutResult } from "../domains/kiosk/hooks/useKioskCheckout";
import type { UseCartResult } from "../domains/cart/hooks/useCart";
import type { UseCheckoutResult } from "../domains/order/hooks/useCheckout";
import type { UseBranchSwitchResult } from "../domains/branch/hooks/useBranchSwitch";
import type { IBranch } from "../domains/management/inventory/types";

const mockPay = jest.mocked(payForDelivery);

const ADDRESS: CustomerAddress = {
    id: "addr-1", label: "Home", block: "338", road: "3801", building: "12", flat: null,
    note: null, latitude: 26.2285, longitude: 50.586,
};

// Kiosk is irrelevant to the delivery paths here, so it is parked in its idle state — the
// prop is required (added on main), not optional.
const KIOSK_IDLE = {
    phase: "idle",
    submitting: false,
    checkoutError: null,
    placedOrderId: null,
    isSheetOpen: false,
    startPhoneStep: jest.fn(),
    closePhoneStep: jest.fn(),
    submitPhone: jest.fn(),
    finishSession: jest.fn(),
} as unknown as UseKioskCheckoutResult;

// What useCheckout hands over: already built, already validated, not yet created (§1.7).
const PENDING_ORDER = {
    tel: "33112233", customer_name: "Andrew", type: "Delivery",
    payment_type: "Card (Through card machine)", branchId: "branch-default", notes: "",
    items: [], amount_paid: 12.5, idempotency_key: "idem-1",
};

const AVAILABLE: DeliveryAvailability = {
    available: true, reason: null, branchId: "branch-nearest", etaMinutesMin: 20, etaMinutesMax: 30,
};

// The hosted payment page is reached with a full-page `window.location.assign` — jsdom's real
// navigation throws "not implemented", so `window.location` is replaced with a plain object
// carrying a spy, mirroring CustomerProfilePopup.test.tsx / shared/api/client.test.ts.
const mockLocationAssign = jest.fn<void, [string]>();

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    Object.defineProperty(window, "location", {
        writable: true,
        configurable: true,
        value: { assign: mockLocationAssign },
    });
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

function createBranchSwitch(overrides: Record<string, unknown> = {}): UseBranchSwitchResult {
    return {
        pickerOpen: false,
        openPicker: jest.fn(),
        closePicker: jest.fn(),
        handleBranchSelected: jest.fn(),
        warningOpen: false,
        warningLoading: false,
        warningTargetBranch: null,
        warningUnavailableNames: [],
        warningError: null,
        confirmSwitch: jest.fn(),
        cancelSwitch: jest.fn(),
        ...overrides,
    } as unknown as UseBranchSwitchResult;
}

function renderModals(
    cartOverrides: Record<string, unknown> = {},
    checkoutOverrides: Record<string, unknown> = {},
    modalsOverrides: Record<string, unknown> = {}
): void {
    render(
        <I18nextProvider i18n={i18n}>
            <HomePageModals
                cart={createCart(cartOverrides)}
                checkout={createCheckout(checkoutOverrides)}
                keetaOpen={false}
                setKeetaOpen={jest.fn()}
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
                kiosk={KIOSK_IDLE}
                adminBranchId={null}
                customerBranchGateOpen={false}
                onCustomerBranchSelect={jest.fn()}
                branchSwitch={createBranchSwitch()}
                {...modalsOverrides}
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
        mockRefreshActiveOrder.mockReset();
        mockLocationAssign.mockClear();
        // What the server actually sends (DeliveryPaymentResultTO): the order exists, it is NOT
        // paid — `status` is "Pending Payment" on a 201 — and the redirect is the stub's, which
        // is the only provider wired up today.
        mockPay.mockResolvedValue({
            orderNo: 101, status: "Pending Payment",
            redirectUrl: "https://stub.local/checkout/101", stub: true,
        });
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

    // The island is fed by the backend's active-order endpoint, so it only picks the new order up
    // when something asks it to refetch. Without this the widget stays empty until a reload.
    it("seeds the homepage island once the delivery order is paid for", async () => {
        renderModals({}, { orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "CARD"); });

        await waitFor(() => expect(mockRefreshActiveOrder).toHaveBeenCalledTimes(1));
    });

    it("does not seed the island when the payment fails", async () => {
        mockPay.mockRejectedValue(new Error("Card declined"));
        renderModals({}, { orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "CARD"); });

        await waitFor(() => expect(mockPay).toHaveBeenCalledTimes(1));
        expect(mockRefreshActiveOrder).not.toHaveBeenCalled();
    });

    /** A stubbed order must never read as a real charge. */
    it("says so when the payment was stubbed", async () => {
        mockPay.mockResolvedValue({
            orderNo: 101, status: "Pending Payment",
            redirectUrl: "https://stub.local/checkout/101", stub: true,
        });
        renderModals({}, { orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "CARD"); });

        expect(await screenFindText(/test mode/i)).toBeTruthy();
    });

    /**
     * H2: the response carries a `redirectUrl` and a `Pending Payment` status — the order is
     * created but nothing has been charged. The stub auto-approves, so today the confirmation is
     * accidentally correct; the day EazyPay is switched on, confirming here would tell the
     * customer they had paid and they would never reach the payment page at all.
     */
    it("sends the customer to the hosted payment page once the provider is real", async () => {
        const setShowOrderConfirmed = jest.fn();
        mockPay.mockResolvedValue({
            orderNo: 101, status: "Pending Payment",
            redirectUrl: "https://pay.example/session/abc", stub: false,
        });
        renderModals({}, {
            orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER, setShowOrderConfirmed,
        });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "CARD"); });

        await waitFor(() =>
            expect(mockLocationAssign).toHaveBeenCalledWith("https://pay.example/session/abc"));
        expect(setShowOrderConfirmed).not.toHaveBeenCalled();
        expect(mockRefreshActiveOrder).not.toHaveBeenCalled();
    });

    /** The stub has no page to visit, so its path is unchanged: confirm, never navigate. */
    it("keeps the stubbed order on the confirmation screen instead of redirecting", async () => {
        const setShowOrderConfirmed = jest.fn();
        renderModals({}, {
            orderType: "Delivery", pendingDeliveryOrder: PENDING_ORDER, setShowOrderConfirmed,
        });

        await act(async () => { capturedOnConfirm()(ADDRESS, AVAILABLE, "CARD"); });

        await waitFor(() => expect(setShowOrderConfirmed).toHaveBeenCalledWith(true));
        expect(mockLocationAssign).not.toHaveBeenCalled();
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

// task-spec.md §6.2/§6.4 — one BranchPickerDrawer mount serves both the mandatory entry gate and
// the voluntary re-entry switch (ST6 re-edits the mount ST4 added). BranchPickerDrawer itself has
// its own suite, so it is a probe here — only the wiring is asserted.
describe("HomePageModals — BranchPickerDrawer mount (gate vs. voluntary switch)", () => {
    const BRANCHES: IBranch[] = [
        { id: "b-1", externalId: "ext-1", branchNo: 1, branchName: "Downtown", locale: "en", latitude: null, longitude: null },
    ];

    beforeEach(() => {
        mockCartPopup.mockClear();
        mockDeliveryDrawer.mockClear();
        mockBranchPickerDrawer.mockClear();
        mockBranchSwitchWarningDrawer.mockClear();
    });

    it("does not mount the picker when neither the gate nor the switch picker is open", () => {
        renderModals({}, {}, { customerBranchGateOpen: false, availableBranches: BRANCHES });

        expect(mockBranchPickerDrawer).not.toHaveBeenCalled();
    });

    it("mounts the picker as non-dismissable when the mandatory gate is open", () => {
        const onCustomerBranchSelect = jest.fn();
        renderModals({}, {}, {
            customerBranchGateOpen: true,
            availableBranches: BRANCHES,
            onCustomerBranchSelect,
        });

        expect(mockBranchPickerDrawer).toHaveBeenLastCalledWith(expect.objectContaining({
            open: true,
            branches: BRANCHES,
            dismissable: false,
            onClose: undefined,
            onSelect: onCustomerBranchSelect,
        }));
    });

    it("reports the selected branch via onCustomerBranchSelect when the gate is open", () => {
        const onCustomerBranchSelect = jest.fn();
        renderModals({}, {}, {
            customerBranchGateOpen: true,
            availableBranches: BRANCHES,
            onCustomerBranchSelect,
        });

        const { onSelect } = mockBranchPickerDrawer.mock.calls[0][0] as { onSelect: (b: IBranch) => void };
        onSelect(BRANCHES[0]);

        expect(onCustomerBranchSelect).toHaveBeenCalledWith(BRANCHES[0]);
    });

    it("mounts the picker as dismissable, wired to the branch switch, when only the re-entry picker is open", () => {
        const branchSwitch = createBranchSwitch({ pickerOpen: true });
        renderModals({}, {}, { availableBranches: BRANCHES, branchSwitch });

        expect(mockBranchPickerDrawer).toHaveBeenLastCalledWith(expect.objectContaining({
            open: true,
            branches: BRANCHES,
            dismissable: true,
            onClose: branchSwitch.closePicker,
            onSelect: branchSwitch.handleBranchSelected,
        }));
    });

    it("the mandatory gate wins non-dismissable behaviour when both happen to be open", () => {
        const branchSwitch = createBranchSwitch({ pickerOpen: true });
        renderModals({}, {}, { customerBranchGateOpen: true, availableBranches: BRANCHES, branchSwitch });

        expect(mockBranchPickerDrawer).toHaveBeenLastCalledWith(expect.objectContaining({
            open: true,
            dismissable: false,
            onClose: undefined,
        }));
    });
});

// task-spec.md §6.4 — the cart-loss warning drawer this file mounts off useBranchSwitch's state.
describe("HomePageModals — branch-switch cart-loss warning", () => {
    beforeEach(() => {
        mockCartPopup.mockClear();
        mockDeliveryDrawer.mockClear();
        mockBranchSwitchWarningDrawer.mockClear();
    });

    it("wires BranchSwitchWarningDrawer's props straight from the branchSwitch hook result", () => {
        const branchSwitch = createBranchSwitch({
            warningOpen: true,
            warningLoading: true,
            warningTargetBranch: { id: "b-2", externalId: "ext-2", branchNo: 2, branchName: "Seef", locale: "en", latitude: null, longitude: null },
            warningUnavailableNames: ["Pepperoni Pizza"],
            warningError: null,
        });
        renderModals({}, {}, { branchSwitch });

        expect(mockBranchSwitchWarningDrawer).toHaveBeenLastCalledWith(expect.objectContaining({
            open: true,
            loading: true,
            targetBranch: branchSwitch.warningTargetBranch,
            unavailableNames: ["Pepperoni Pizza"],
            error: null,
            onConfirm: branchSwitch.confirmSwitch,
            onCancel: branchSwitch.cancelSwitch,
        }));
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
