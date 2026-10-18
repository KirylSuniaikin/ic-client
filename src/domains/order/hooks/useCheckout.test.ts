import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createOrder, editOrder } from "../../../shared/api/public";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { refreshCustomerToken, fetchCustomerMe, verifyOtp } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, useCustomerAuth, __resetCustomerAuthStoreForTests } from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../../customer-auth/context/CustomerAuthUiProvider";
import i18n, { DEFAULT_LANGUAGE } from "../../../shared/i18n";
import { useCheckout } from "./useCheckout";
import type { CartItem, MenuItem } from "../../menu/types";
import type { Order } from "../types";
import type { CustomerMeResponse } from "../../customer-auth/types";
import { BranchClosedError, DEFAULT_PAYMENT_METHOD } from "../types";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import { writeChosenBranch } from "../../branch/utils/customerBranch";
import type { IBranch } from "../../management/inventory/types";

// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");
// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../shared/api/management");
// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/customerAuth.ts
jest.mock("../../../shared/api/customerAuth");


const mockCreateOrder = jest.mocked(createOrder);
const mockEditOrder = jest.mocked(editOrder);
const mockGetAllBannedCstmrs = jest.mocked(getAllBannedCstmrs);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockFetchCustomerMe = jest.mocked(fetchCustomerMe);
const mockVerifyOtp = jest.mocked(verifyOtp);

// useCheckout calls useCustomerAuth() and useCustomerAuthUi() internally, so every
// renderHook needs both providers as ancestors -- mirrors app/providers.tsx wiring.
function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return React.createElement(
        CustomerAuthProvider,
        null,
        React.createElement(CustomerAuthUiProvider, null, children)
    );
}

// Combines useCheckout with useCustomerAuthUi/useCustomerAuth under the same render, so a
// test can observe the context side effects (openLogin/isLoginOpen/openOrderDetail/token)
// that the mandatory-account gate triggers, without mocking the context.
function useCheckoutWithUi(params: Parameters<typeof useCheckout>[0]) {
    const checkout = useCheckout(params);
    const ui = useCustomerAuthUi();
    const auth = useCustomerAuth();
    return { checkout, ui, auth };
}

// Awaits CustomerAuthProvider's mount-time silent refresh settling, so its state update happens
// inside `waitFor`'s act() wrapping instead of leaking into a later, unwrapped microtask.
async function waitForAuthReady(): Promise<void> {
    await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
}

const MOCK_CUSTOMER_ME: CustomerMeResponse = {
    id: "account-1",
    phone: "12345678",
    preferredBranchId: "branch-1",
    name: "Returning Customer",
    address: "Manama, Block 305",
    amountOfOrders: 4,
    lastOrderDate: "2026-06-20",
};

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

// Default every test to a logged-out (guest) customer-auth state, and isolate the module-level
// token store between tests. Tests that need a logged-in customer override mockRefreshCustomerToken.
beforeEach(() => {
    __resetCustomerAuthStoreForTests();
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    mockFetchCustomerMe.mockReset();
    mockVerifyOtp.mockReset();
    mockEditOrder.mockReset();
    localStorage.clear();
});

function makeCartItem(name: string, amount: number, quantity = 1): CartItem {
    return {
        id: 1,
        name,
        size: "M",
        category: "Beverages",
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

const MOCK_ORDER: Order = {
    id: "order-123",
    order_no: 1,
    tel: "12345678",
    customer_name: "Test",
    delivery_method: "Pick Up",
    payment_type: "Cash",
    address: "",
    notes: "",
    items: [],
    amount_paid: 2.5,
    order_type: "Pick Up",
    external_id: null,
    phone_number: "12345678",
    order_created: "2026-01-01T12:00:00",
    status: "Kitchen Phase",
    isPaid: false,
    branch_id: "branch-1",
};

const ITEMS: CartItem[] = [makeCartItem("Water", 2.5, 1)];

function makeParams(overrides: {
    isAdmin?: boolean;
    isKiosk?: boolean;
    isEditMode?: boolean;
    adminBranchId?: string | null;
    navigate?: ReturnType<typeof jest.fn>;
    cartItems?: CartItem[];
    menuData?: MenuItem[];
    onKioskCheckout?: ((items: CartItem[]) => void) | null;
} = {}) {
    const navigate = overrides.navigate ?? jest.fn<void, [string]>();
    const setCartItems = jest.fn<void, [CartItem[] | ((prev: CartItem[]) => CartItem[])]>();
    const setCartOpen = jest.fn<void, [boolean]>();
    const refreshMenu = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

    return {
        isAdmin: overrides.isAdmin ?? false,
        isKiosk: overrides.isKiosk ?? false,
        isEditMode: overrides.isEditMode ?? false,
        adminBranchId: overrides.adminBranchId ?? null,
        menuData: overrides.menuData ?? [],
        cartItems: overrides.cartItems ?? ITEMS,
        setCartItems,
        setCartOpen,
        refreshMenu,
        // react-router NavigateFunction is typed as a function -- jest.fn() satisfies it at runtime
        navigate: navigate as unknown as import("react-router-dom").NavigateFunction,
        onKioskCheckout: overrides.onKioskCheckout,
    };
}

type CheckoutApi = ReturnType<typeof useCheckout>;

/**
 * The payment page's Pay (owner, 19 Oct 2026: the cart leads to sign-in, then a page with every
 * method). Waits for the page to open, then pays with `tender` as its button does.
 */
async function payOnPage(checkout: () => CheckoutApi, tender: string): Promise<void> {
    await waitFor(() => expect(checkout().paymentPageOpen).toBe(true));
    await act(async () => {
        checkout().payWithTender(tender);
    });
}

describe("useCheckout — initial state", () => {
    it("checkoutLoading is false initially", async () => {
        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();
        expect(result.current.checkoutLoading).toBe(false);
    });

    it("all popup booleans are false initially", async () => {
        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();
        expect(result.current.phonePopupOpen).toBe(false);
        expect(result.current.isCrossSellOpen).toBe(false);
        expect(result.current.pickUpReminder).toBe(false);
        expect(result.current.unavailablePopupOpen).toBe(false);
        expect(result.current.errorSnackBarOpen).toBe(false);
        expect(result.current.blacklistSnackBarOpen).toBe(false);
    });

    it("customerPrefill is null initially", async () => {
        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();
        expect(result.current.customerPrefill).toBeNull();
    });

    it("does not include postOrderProposalOpen/Phone/Name/resolvePostOrderProposal on the returned result", async () => {
        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();

        expect(Object.prototype.hasOwnProperty.call(result.current, "postOrderProposalOpen")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result.current, "postOrderProposalPhone")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result.current, "postOrderProposalName")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result.current, "resolvePostOrderProposal")).toBe(false);
    });
});

describe("useCheckout — handleCheckout cross-sell gate (non-admin)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("opens the cross-sell popup on the first checkout call for a customer", async () => {
        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.isCrossSellOpen).toBe(true);
    });

    it("does NOT call createOrder on the first checkout call (cross-sell gate)", async () => {
        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("skips the cross-sell gate on the second checkout call and asks a guest to sign in", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        expect(result.current.checkout.isCrossSellOpen).toBe(true);

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.ui.isLoginOpen).toBe(true);
    });
});

describe("useCheckout — handleCheckout payment gate (non-admin, guest)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    // Owner, 19 Oct 2026: a guest goes from the cart straight to the phone sign-in (phone, then
    // the WhatsApp code); ClientInfoPopup's name-and-phone form is no longer on their way.
    it("asks a guest to sign in with their phone, in checkout mode with nothing prefilled", async () => {
        const params = makeParams({ isAdmin: false });
        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.ui.isLoginOpen).toBe(true);
        expect(result.current.ui.loginCheckoutMode).toBe(true);
        expect(result.current.ui.loginPrefillPhone).toBeFalsy();
        expect(result.current.checkout.phonePopupOpen).toBe(false);
        expect(result.current.checkout.paymentPageOpen).toBe(false);
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
        expect(mockFetchCustomerMe).not.toHaveBeenCalled();
    });

    it("does NOT create an order when paymentMethod is null", async () => {
        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(mockCreateOrder).not.toHaveBeenCalled();
    });
});

describe("useCheckout — handleCheckout payment gate (non-admin, logged in)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("skips ClientInfoPopup and opens the payment page, placing no order yet, when the profile has a name", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const params = makeParams({ isAdmin: false });

        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        await waitFor(() => expect(result.current.checkout.paymentPageOpen).toBe(true));
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
        expect(result.current.checkout.phonePopupOpen).toBe(false);
        expect(result.current.ui.isLoginOpen).toBe(false);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("keeps a blacklisted customer off the payment page", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([{ id: 1, telephoneNo: MOCK_CUSTOMER_ME.phone }]);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Pick Up", null, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Pick Up", null, "", null);
        });

        await waitFor(() => expect(result.current.blacklistSnackBarOpen).toBe(true));
        expect(result.current.paymentPageOpen).toBe(false);
    });

    it("sends the profile's phone/name and the payment page's method (no note)", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        // The cart supplies the delivery type ("Pick Up"); the method is the one chosen on the
        // payment page, never re-collected in ClientInfoPopup.
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Pick Up", null, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Pick Up", null, "", null);
        });
        await payOnPage(() => result.current, DEFAULT_PAYMENT_METHOD);

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            tel: MOCK_CUSTOMER_ME.phone,
            customer_name: MOCK_CUSTOMER_ME.name,
            payment_type: DEFAULT_PAYMENT_METHOD,
            type: "Pick Up",
            notes: "",
        }));
    });

    // ST5 (task-spec.md §11): a logged-in customer with a name on file re-enters handleCheckout
    // against the branch actually chosen in the picker, not DEFAULT_BRANCH_ID -- otherwise the
    // order is filed against the default branch's hours regardless of what the customer browsed.
    it("re-enters handleCheckout with the stored chosen branch id, not DEFAULT_BRANCH_ID", async () => {
        const CHOSEN_BRANCH: IBranch = {
            id: "branch-chosen",
            externalId: "ext-chosen",
            branchNo: 2,
            branchName: "Seef Branch",
            locale: "en",
            latitude: 26.23,
            longitude: 50.53,
        };
        expect(CHOSEN_BRANCH.id).not.toBe(DEFAULT_BRANCH_ID);
        writeChosenBranch(CHOSEN_BRANCH);

        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Pick Up", DEFAULT_PAYMENT_METHOD, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Pick Up", DEFAULT_PAYMENT_METHOD, "", null);
        });
        await payOnPage(() => result.current, DEFAULT_PAYMENT_METHOD);

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            branchId: CHOSEN_BRANCH.id,
        }));
        expect(mockCreateOrder).not.toHaveBeenCalledWith(expect.objectContaining({
            branchId: DEFAULT_BRANCH_ID,
        }));
    });

    // DELIVERY_SPEC.md §12.1-A: `type` was hardcoded to "Pick Up" while deliveryMethod was
    // accepted and dropped, so a Delivery order could never reach the backend. The Pick Up
    // assertion above passed for the wrong reason — it could not fail.
    it("sends the cart's delivery type through to createOrder instead of a hardcoded Pick Up", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Delivery", DEFAULT_PAYMENT_METHOD, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Delivery", DEFAULT_PAYMENT_METHOD, "", null);
        });

        // §1.7 changed where this lands: a Delivery order is built and held for payment rather
        // than created, so the type is asserted on the held order instead of on createOrder.
        await waitFor(() => expect(result.current.pendingDeliveryOrder).not.toBeNull());
        expect(result.current.pendingDeliveryOrder).toEqual(
            expect.objectContaining({ type: "Delivery" }));
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    /**
     * §1.7: the delivery order must not exist until payment succeeds — but everything before the
     * creation step still has to run, or a delivery customer would skip checks a pickup customer
     * gets. The blacklist check is the one that matters most and is asserted here.
     */
    it("holds a delivery order for payment without skipping the blacklist check", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Delivery", DEFAULT_PAYMENT_METHOD, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Delivery", DEFAULT_PAYMENT_METHOD, "", null);
        });

        await waitFor(() => expect(result.current.pendingDeliveryOrder).not.toBeNull());
        expect(mockGetAllBannedCstmrs).toHaveBeenCalled();
        // The order the drawer will pay for carries everything createOrder would have received.
        expect(result.current.pendingDeliveryOrder).toEqual(expect.objectContaining({
            tel: MOCK_CUSTOMER_ME.phone,
            customer_name: MOCK_CUSTOMER_ME.name,
            type: "Delivery",
            idempotency_key: expect.any(String),
        }));
    });

    /** A banned customer must not reach the payment screen either. */
    it("refuses a delivery order from a blacklisted customer before payment", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([{ id: 1, telephoneNo: MOCK_CUSTOMER_ME.phone }]);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Delivery", DEFAULT_PAYMENT_METHOD, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, "Delivery", DEFAULT_PAYMENT_METHOD, "", null);
        });

        await waitFor(() => expect(result.current.blacklistSnackBarOpen).toBe(true));
        expect(result.current.pendingDeliveryOrder).toBeNull();
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    // Kiosk and the admin popup legitimately pass null; they must keep defaulting to Pick Up.
    it("defaults to Pick Up when the caller passes no delivery type", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, DEFAULT_PAYMENT_METHOD, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, DEFAULT_PAYMENT_METHOD, "", null);
        });
        await payOnPage(() => result.current, DEFAULT_PAYMENT_METHOD);

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ type: "Pick Up" }));
    });

    it("falls back to ClientInfoPopup instead of sending a nameless order when the profile has no name", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce({ ...MOCK_CUSTOMER_ME, name: null });

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.phonePopupOpen).toBe(true);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("falls back to an unfilled ClientInfoPopup when the profile fetch fails", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockRejectedValueOnce(new Error("network error"));

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.phonePopupOpen).toBe(true);
        expect(result.current.customerPrefill).toBeNull();
    });

    it("never asks a signed-in customer to sign in again, and orders from the payment page", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        // Returning customer (amountOfOrders > 0) -> no pick-up reminder, straight to createOrder.
        mockFetchCustomerMe.mockResolvedValue({ ...MOCK_CUSTOMER_ME, name: "Sara" });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Sara", null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Sara", null, "Cash", "", "branch-1");
        });
        await payOnPage(() => result.current.checkout, "Cash");

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ payment_type: "Cash", customer_name: "Sara" }));
        expect(result.current.ui.isLoginOpen).toBe(false);
    });
});

// Task RW: the per-item free-text note is sent as its own `note` payload field (item AND
// combo-item), never folded into `description`.
describe("useCheckout — sends note as its own payload field (task RW)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    function itemWithNoteAndCombo(): CartItem {
        return {
            ...makeCartItem("Margherita", 5),
            description: "+(Mushroom)",
            note: "no onions please",
            comboItems: [
                {
                    id: 1,
                    name: "Cola",
                    category: "Beverages",
                    size: "",
                    isThinDough: false,
                    isGarlicCrust: false,
                    description: "",
                    note: "extra ice",
                    quantity: 1,
                },
            ],
        };
    }

    it("sends note on the item and each combo item in the create-order payload", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin" });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout([itemWithNoteAndCombo()], "12345678", "Sara", null, "Cash", "", null, true);
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            items: [expect.objectContaining({
                note: "no onions please",
                comboItems: [expect.objectContaining({ note: "extra ice" })],
            })],
        }));
    });

    it("defaults item note to an empty string when the CartItem carries none", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin" });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Sara", null, "Cash", "", null, true);
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            items: [expect.objectContaining({ note: "" })],
        }));
    });

    it("sends note on the item and each combo item in the edit-order payload", async () => {
        mockEditOrder.mockResolvedValue(MOCK_ORDER);
        localStorage.setItem("orderToEdit", JSON.stringify({ id: "555", order_no: 5, address: "" }));
        const navigateSpy = jest.fn<void, [string]>();
        const params = makeParams({ isAdmin: true, isEditMode: true, adminBranchId: "branch-admin", navigate: navigateSpy });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout([itemWithNoteAndCombo()], "12345678", "Sara", null, "Cash", "", null, true);
        });

        await waitFor(() => expect(mockEditOrder).toHaveBeenCalled());
        expect(mockEditOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                items: [expect.objectContaining({
                    note: "no onions please",
                    comboItems: [expect.objectContaining({ note: "extra ice" })],
                })],
            }),
            "555",
        );
    });
});

describe("useCheckout — blacklist check", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("opens the blacklist snackbar when the customer's phone is blacklisted", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([{ id: 1, telephoneNo: "99999999" }]);

        const navigateSpy = jest.fn<void, [string]>();
        const params = makeParams({ isAdmin: false, navigate: navigateSpy });

        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1", true);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1", true);
        });

        await waitFor(() => {
            expect(result.current.blacklistSnackBarOpen).toBe(true);
        });
    });

    it("does NOT create an order for a blacklisted customer", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([{ id: 1, telephoneNo: "99999999" }]);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1", true);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1", true);
        });

        await waitFor(() => {
            expect(result.current.blacklistSnackBarOpen).toBe(true);
        });

        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("checks the blacklist before opening the login sheet, for a guest who is not banned", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1", true);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1", true);
        });

        expect(mockGetAllBannedCstmrs).toHaveBeenCalled();
        expect(result.current.ui.isLoginOpen).toBe(true);
    });
});

describe("useCheckout — mandatory account verification gate (guest checkout)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    // From the cart, as its Checkout does: the first call is the cross-sell gate's.
    async function checkoutAsGuest(result: { current: ReturnType<typeof useCheckoutWithUi> }): Promise<void> {
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "", null, null, "Cash", "", null);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "", null, null, "Cash", "", null);
        });
    }

    it("does not call createOrder and opens the sign-in in checkout mode", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await checkoutAsGuest(result);

        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(result.current.ui.isLoginOpen).toBe(true);
        expect(result.current.ui.loginCheckoutMode).toBe(true);
        expect(result.current.checkout.phonePopupOpen).toBe(false);
    });

    it("dismissing the sheet without verifying reopens the cart and creates no order", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        const params = makeParams({ isAdmin: false });

        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        await checkoutAsGuest(result);
        expect(result.current.ui.isLoginOpen).toBe(true);

        act(() => {
            result.current.ui.closeAll();
        });

        await waitFor(() => expect(params.setCartOpen).toHaveBeenCalledWith(true));
        expect(result.current.checkout.paymentPageOpen).toBe(false);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("opens the payment page once the code is verified, and files the order under the verified profile", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "tok-verified", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue({ ...MOCK_CUSTOMER_ME, phone: "99998888", name: "Verified Name" });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await checkoutAsGuest(result);
        await act(async () => {
            await result.current.auth.login("99998888", "0000");
        });

        await waitFor(() => expect(result.current.checkout.paymentPageOpen).toBe(true));
        expect(mockCreateOrder).not.toHaveBeenCalled();
        await payOnPage(() => result.current.checkout, DEFAULT_PAYMENT_METHOD);

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            tel: "99998888", customer_name: "Verified Name", payment_type: DEFAULT_PAYMENT_METHOD,
        }));
    });

    // The rare account with no name: asked for it before the payment page, not sent nameless.
    it("asks a newly signed-in customer with no name on file for it via ClientInfoPopup", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "tok-verified", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue({ ...MOCK_CUSTOMER_ME, name: null });

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await checkoutAsGuest(result);
        await act(async () => {
            await result.current.auth.login("12345678", "0000");
        });

        await waitFor(() => expect(result.current.checkout.phonePopupOpen).toBe(true));
        expect(result.current.checkout.paymentPageOpen).toBe(false);

        await act(async () => {
            result.current.checkout.continueWithDetails("12345678", "Named Now", "branch-1");
        });

        await waitFor(() => expect(result.current.checkout.paymentPageOpen).toBe(true));
        expect(result.current.checkout.phonePopupOpen).toBe(false);
    });

    // A session that ended between the payment page and Pay: no order without a verified phone.
    it("asks for the sign-in again when the session is gone by the time the order is placed", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1", true);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1", true);
        });

        expect(result.current.ui.isLoginOpen).toBe(true);
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });
});

describe("useCheckout — executeOrderCreation", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("calls createOrder with the order data", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    it("opens the just-created order's detail (not navigate) when isKiosk is false", async () => {
        mockCreateOrder.mockResolvedValue({ ...MOCK_ORDER, id: "789" });
        const navigateSpy = jest.fn<void, [string, unknown?]>();

        const { result } = renderHook(() =>
            useCheckoutWithUi(makeParams({ isAdmin: false, isKiosk: false, navigate: navigateSpy })),
        { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(navigateSpy).not.toHaveBeenCalled();
        expect(result.current.ui.isProfileOpen).toBe(true);
        expect(result.current.ui.selectedOrderId).toBe(789);
    });

    it("calls openOrderDetail with the numeric order id and does not navigate for a logged-in customer", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-3", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockCreateOrder.mockResolvedValue({ ...MOCK_ORDER, id: "555" });
        const navigateSpy = jest.fn<void, [string, unknown?]>();

        const { result } = renderHook(() =>
            useCheckoutWithUi(makeParams({ isAdmin: false, isKiosk: false, navigate: navigateSpy })),
        { wrapper });
        await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await waitFor(() => expect(result.current.checkout.customerPrefill).toEqual(MOCK_CUSTOMER_ME));

        await act(async () => {
            await result.current.checkout.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(navigateSpy).not.toHaveBeenCalled();
        expect(result.current.ui.isProfileOpen).toBe(true);
        expect(result.current.ui.selectedOrderId).toBe(555);
    });

    it("does not call navigate at all when isKiosk is true", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const navigateSpy = jest.fn<void, [string, unknown?]>();

        const { result } = renderHook(() =>
            useCheckout(makeParams({ isAdmin: false, isKiosk: true, navigate: navigateSpy })),
        { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it("sets checkoutLoading to false after order creation (success path)", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(result.current.checkoutLoading).toBe(false);
    });

    // The production incident: a rapid multi-tap on the confirm button fired createOrder several
    // times before checkoutLoading (async React state) could flip, creating duplicate orders. The
    // synchronous submittingRef guard must let only the first concurrent call through.
    it("fires createOrder only once when invoked twice concurrently (multi-tap guard)", async () => {
        let resolveCreate: ((o: Order) => void) | undefined;
        const pending = new Promise<Order>((resolve) => { resolveCreate = resolve; });
        mockCreateOrder.mockReturnValueOnce(pending);

        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();

        const order = { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" };

        await act(async () => {
            // Two synchronous "taps" before the first request resolves.
            const first = result.current.executeOrderCreation(order, ITEMS);
            const second = result.current.executeOrderCreation(order, ITEMS);
            resolveCreate?.(MOCK_ORDER);
            await Promise.all([first, second]);
        });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    // Once the first submit has settled the guard is released, so a genuine later re-order still works.
    it("allows a second createOrder after the first has completed", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();

        const order = { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" };

        await act(async () => { await result.current.executeOrderCreation(order, ITEMS); });
        await act(async () => { await result.current.executeOrderCreation(order, ITEMS); });

        expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    });

    it("opens error snackbar when createOrder throws a generic error", async () => {
        mockCreateOrder.mockRejectedValue(new Error("Server error"));

        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(result.current.errorSnackBarOpen).toBe(true);
    });

    it("opens error snackbar and refetches the menu when the branch is closed (423)", async () => {
        mockCreateOrder.mockRejectedValue(new BranchClosedError("We're sorry, this branch is closed right now."));
        const params = makeParams();

        const { result } = renderHook(() => useCheckout(params), { wrapper });

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(result.current.errorSnackBarOpen).toBe(true);
        expect(params.refreshMenu).toHaveBeenCalled();
    });
});

describe("useCheckout — admin flow (handleCheckout)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("skips the cross-sell gate when isAdmin=true", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const navigateSpy = jest.fn<void, [string]>();
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin", navigate: navigateSpy });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        expect(result.current.isCrossSellOpen).toBe(false);
        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    // The POS popup's "Delivery Method" select defaults to "Take Out" and offers aggregator names;
    // none of them is an order type, so a counter order must still be filed as "Pick Up".
    it.each(["Take Out", "Talabat", "Jahez", "Delivery"])(
        "files an admin POS order as Pick Up even when the popup's Delivery Method is %s",
        async (posDeliveryMethod) => {
            mockCreateOrder.mockResolvedValue(MOCK_ORDER);

            const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin" });
            const { result } = renderHook(() => useCheckout(params), { wrapper });
            await waitForAuthReady();

            await act(async () => {
                await result.current.handleCheckout(ITEMS, "12345678", "Walk-in", posDeliveryMethod, "Cash", "", null, true);
            });

            expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ type: "Pick Up" }));
        },
    );

    // The backend dedupes retried requests on this client-generated key (a network-level resend of
    // the same body must not create a second order), so every create payload must carry one.
    it("sends a non-empty idempotency_key on the create payload", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin" });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            idempotency_key: expect.stringMatching(/.+/),
        }));
    });

    it("navigates to /admin/ after admin order creation", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const navigateSpy = jest.fn<void, [string]>();
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin", navigate: navigateSpy });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        await waitFor(() => {
            expect(navigateSpy).toHaveBeenCalledWith("/admin/");
        });
    });

    it("opens the adminOrderDetailsPopUp when info is not yet collected (admin flow), regardless of auth state", async () => {
        const { result } = renderHook(() =>
            useCheckout(makeParams({ isAdmin: true, adminBranchId: "branch-admin" })),
        { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.adminOrderDetailsPopUp).toBe(true);
    });

    it("never opens the login sheet for an admin checkout", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin" });

        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        expect(result.current.ui.isLoginOpen).toBe(false);
        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });
});

// The new-customer branch of finalizeOrder: the order is NOT created, it is parked in
// pendingOrder/pendingCartItems while PickUpReminderPopup asks the customer to confirm.
// HomePageModals is what turns that into a createOrder call (or, on dismiss, hands the
// cart back) -- so if these stay unset the order is lost with nothing to re-surface it.
describe("useCheckout — new customer parks the order behind the pick-up reminder", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    async function checkoutAsNewCustomer() {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        // Has an account, but has never completed an order — this, not the presence of an
        // account, is what routes a customer through the pick-up reminder.
        mockFetchCustomerMe.mockResolvedValue({ ...MOCK_CUSTOMER_ME, name: "Newcomer", amountOfOrders: 0 });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const params = makeParams({ isAdmin: false });
        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        // First call is swallowed by the cross-sell gate; the second one opens the payment page.
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Newcomer", null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Newcomer", null, "Cash", "", "branch-1");
        });
        await payOnPage(() => result.current.checkout, "Cash");

        return { result, params };
    }

    // The cart is a Drawer at the same modal z-index and portals in later, so an open cart
    // buries the reminder and checkout reads as a dead button.
    it("closes the cart when the reminder opens, so it is not buried behind the cart", async () => {
        const { result, params } = await checkoutAsNewCustomer();

        await waitFor(() => expect(result.current.checkout.pickUpReminder).toBe(true));
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
    });

    it("opens the reminder and holds the order instead of creating it", async () => {
        const { result } = await checkoutAsNewCustomer();

        await waitFor(() => expect(result.current.checkout.pickUpReminder).toBe(true));
        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(result.current.checkout.pendingOrder).toMatchObject({ tel: MOCK_CUSTOMER_ME.phone, customer_name: "Newcomer" });
        expect(result.current.checkout.pendingCartItems).toEqual(ITEMS);
    });

    // The order count is unknowable when the profile fetch fails. Treat that as a first-time
    // customer: showing the reminder to a returning customer costs one tap, whereas skipping
    // it would drop a genuine first-timer's pick-up warning.
    it("falls back to the reminder when the profile fetch fails, rather than skipping it", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockFetchCustomerMe.mockRejectedValue(new Error("profile unavailable"));
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Nobody", null, "Cash", "", "branch-1", true);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Nobody", null, "Cash", "", "branch-1", true);
        });

        await waitFor(() => expect(result.current.checkout.pickUpReminder).toBe(true));
        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(result.current.checkout.pendingOrder).not.toBeNull();
    });

    it("creates the held order when the reminder is confirmed", async () => {
        const { result } = await checkoutAsNewCustomer();
        await waitFor(() => expect(result.current.checkout.pickUpReminder).toBe(true));

        const held = result.current.checkout.pendingOrder;
        const heldItems = result.current.checkout.pendingCartItems;
        if (!held) throw new Error("pendingOrder was not parked for the reminder");

        await act(async () => {
            await result.current.checkout.executeOrderCreation(held, heldItems);
        });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
        expect(mockCreateOrder).toHaveBeenCalledWith(held);
    });
});

// Kiosk checkout is owned by useKioskCheckout (domains/kiosk) -- handleCheckout only needs to
// hand the cross-sell-gated items off to onKioskCheckout, never build/create the order itself.
describe("useCheckout — kiosk flow hands off to onKioskCheckout", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("never opens the login sheet, never calls createOrder, and fires onKioskCheckout once with the items", async () => {
        const onKioskCheckout = jest.fn<void, [CartItem[]]>();
        const params = makeParams({ isAdmin: false, isKiosk: true, onKioskCheckout });

        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        // The first call is swallowed by the cross-sell gate; the second reaches the kiosk intercept.
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        expect(result.current.ui.isLoginOpen).toBe(false);
        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(onKioskCheckout).toHaveBeenCalledTimes(1);
        expect(onKioskCheckout).toHaveBeenCalledWith(ITEMS);
    });
});

// The Customer CRM row records which language the order was placed in; the frontend stamps it
// on the built order from the active i18n language (normalized to "en" | "ar").
describe("useCheckout — stamps the checkout language on the built order", () => {
    afterEach(async () => {
        jest.clearAllMocks();
        await act(async () => { await i18n.changeLanguage(DEFAULT_LANGUAGE); });
    });

    it("stamps language 'en' by default", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: true, adminBranchId: "branch-admin" })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Sara", null, "Cash", "", null, true);
        });

        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ language: "en" }));
    });

    it("stamps language 'ar' when the UI is in Arabic", async () => {
        await act(async () => { await i18n.changeLanguage("ar"); });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: true, adminBranchId: "branch-admin" })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Sara", null, "Cash", "", null, true);
        });

        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ language: "ar" }));
    });
});

// resolveCustomerLanguage also falls back to the browser locale when the app itself is English
// (a customer who never touched the language toggle but whose device/browser is set to Arabic),
// except on the kiosk where the shared tab's browser locale reflects the store, not the customer.
describe("useCheckout — stamps language from the browser locale when the app itself is English", () => {
    const NAVIGATOR_LANGUAGE = Object.getOwnPropertyDescriptor(window.navigator, "language");
    const NAVIGATOR_LANGUAGES = Object.getOwnPropertyDescriptor(window.navigator, "languages");

    // jsdom's navigator.language is a read-only getter, so it has to be redefined rather than
    // assigned -- mirrors src/shared/i18n/languageDetection.test.ts's setBrowserLanguage helper.
    function setBrowserLanguages(languages: string[]): void {
        Object.defineProperty(window.navigator, "language", { value: languages[0], configurable: true });
        Object.defineProperty(window.navigator, "languages", { value: languages, configurable: true });
    }

    beforeEach(async () => {
        await act(async () => { await i18n.changeLanguage(DEFAULT_LANGUAGE); });
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await act(async () => { await i18n.changeLanguage(DEFAULT_LANGUAGE); });
        if (NAVIGATOR_LANGUAGE) Object.defineProperty(window.navigator, "language", NAVIGATOR_LANGUAGE);
        if (NAVIGATOR_LANGUAGES) Object.defineProperty(window.navigator, "languages", NAVIGATOR_LANGUAGES);
    });

    it("stamps language 'ar' when the app is English but the browser locale is Arabic (non-kiosk)", async () => {
        setBrowserLanguages(["ar-SA"]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: true, adminBranchId: "branch-admin", isKiosk: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Sara", null, "Cash", "", null, true);
        });

        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ language: "ar" }));
    });
});

// wasCrossSellShown was never reset before this task -- on a long-lived kiosk tab only the day's
// first customer would ever see the cross-sell popup. resetCrossSellShown is called by
// resetKioskSession (domains/kiosk, Phase 4) at session end.
describe("useCheckout — resetCrossSellShown re-arms the cross-sell gate", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("opens the cross-sell popup again on the next checkout call after resetCrossSellShown, even though it already fired once", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        // First call trips the gate.
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        expect(result.current.checkout.isCrossSellOpen).toBe(true);

        // Second call passes through it (gate already tripped) and lands on the sign-in.
        act(() => {
            result.current.checkout.setIsCrossSellOpen(false);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        expect(result.current.checkout.isCrossSellOpen).toBe(false);
        expect(result.current.ui.isLoginOpen).toBe(true);

        // Reset (as resetKioskSession does at session end) re-arms the gate for the next customer.
        act(() => {
            result.current.checkout.resetCrossSellShown();
        });

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.checkout.isCrossSellOpen).toBe(true);
    });
});

// §11 Risks (last bullet): the kiosk branch's suppressSoundIds write was deleted (kiosk orders
// are now published server-side on APPROVED, so a client-side chime-suppression write is
// meaningless there) -- but useAdminOrders.ts still reads SUPPRESS_KEY = 'suppressSoundIds' to
// mute the new-order chime for the order the admin who is placing it just created themselves.
// That admin-flow write must survive this task's edits untouched.
describe("useCheckout — admin flow still writes suppressSoundIds (read by useAdminOrders' chime suppression)", () => {
    afterEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it("writes the newly created order id to localStorage under suppressSoundIds after an admin order is placed", async () => {
        mockCreateOrder.mockResolvedValue({ ...MOCK_ORDER, id: "999" });
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin" });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(JSON.parse(localStorage.getItem("suppressSoundIds") ?? "[]")).toEqual(["999"]);
    });
});

// §3 item 5 / §14 item 4 (non-negotiable): deleting the kiosk branch of handleCheckout is what
// makes "nothing on the kiosk path may set checkoutLoading" structural -- HomePage.tsx:103 returns
// a full-page PizzaLoader whenever checkoutLoading is true, which would unmount every kiosk
// payment sheet mid-payment. This is the direct regression guard for that constraint at the
// useCheckout.ts layer (Phase 8 adds the HomePage-level guard separately).
describe("useCheckout — kiosk hand-off never sets checkoutLoading and never mutates the cart itself", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("leaves checkoutLoading false throughout a kiosk checkout hand-off", async () => {
        const onKioskCheckout = jest.fn<void, [CartItem[]]>();
        const params = makeParams({ isAdmin: false, isKiosk: true, onKioskCheckout });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        expect(onKioskCheckout).toHaveBeenCalledTimes(1);
        expect(result.current.checkoutLoading).toBe(false);
    });

    it("does not call setCartItems or setCartOpen itself on the kiosk hand-off -- cart mutation belongs to useKioskCheckout", async () => {
        const onKioskCheckout = jest.fn<void, [CartItem[]]>();
        const params = makeParams({ isAdmin: false, isKiosk: true, onKioskCheckout });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        expect(params.setCartItems).not.toHaveBeenCalled();
        expect(params.setCartOpen).not.toHaveBeenCalled();
    });

    it("does not throw when onKioskCheckout is not provided (null on every non-kiosk composition)", async () => {
        const params = makeParams({ isAdmin: false, isKiosk: true, onKioskCheckout: null });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        });

        await expect(act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null, true);
        })).resolves.not.toThrow();

        expect(mockCreateOrder).not.toHaveBeenCalled();
    });
});

// Confirms the buildOrderItems/computeAmountPaid extraction (item 6) is actually wired into the
// order literal handleCheckout builds -- orderPayload.test.ts pins the pure functions in
// isolation; this exercises the wiring itself with a non-trivial (discounted, multi-quantity)
// cart that the pre-existing flat ITEMS fixture never exercised.
describe("useCheckout — amount_paid wiring through the extracted orderPayload money path", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("sends amount_paid computed via computeAmountPaid (discount % applied before quantity)", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const discounted = makeCartItem("Pepperoni", 10, 2);
        discounted.discountAmount = 20; // 10 * (1 - 20/100) * 2 = 16
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin" });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout([discounted], "12345678", "Sara", null, "Cash", "", null, true);
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ amount_paid: 16 }));
    });
});

/**
 * DELIVERY_SPEC.md §12.1-F and §1.3. Two rules about the delivery seam that were only ever
 * *implied* by other assertions:
 *
 *  - a delivery order must never open the pick-up reminder. `finalizeOrder` returns before
 *    `resolveOrderCount` for Delivery, so the reminder cannot be reached — but nothing said so.
 *    The existing delivery tests assert `createOrder` was not called, which is equally true when
 *    the reminder DOES open, so the suppression itself was unobserved.
 *  - a guest reaches the address book already verified. The OTP gate runs ahead of the seam, and
 *    it is what guarantees a token by the time the account-scoped address list is opened. The
 *    guest half of that path had no test at all.
 */
describe("useCheckout — the delivery seam sits ahead of the pick-up reminder", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * The exact setup that DOES open the reminder for a pickup order: an account that has never
     * completed an order. Only the order type differs, so nothing but the delivery branch can
     * explain the reminder staying shut.
     */
    async function checkoutAsFirstTimer(deliveryMethod: string | null) {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockFetchCustomerMe.mockResolvedValue({ ...MOCK_CUSTOMER_ME, name: "Newcomer", amountOfOrders: 0 });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        // First call is swallowed by the cross-sell gate; the second one checks out: a delivery
        // order goes on to its address, a pickup order to the payment page.
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Newcomer", deliveryMethod, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Newcomer", deliveryMethod, "Cash", "", "branch-1");
        });
        if (deliveryMethod !== "Delivery") await payOnPage(() => result.current, "Cash");
        return result;
    }

    it("never shows a delivery customer the pick-up reminder", async () => {
        const result = await checkoutAsFirstTimer("Delivery");

        await waitFor(() => expect(result.current.pendingDeliveryOrder).not.toBeNull());
        expect(result.current.pickUpReminder).toBe(false);
        expect(result.current.pendingOrder).toBeNull();
    });

    /** The control: the same first-timer on a pickup order does get the reminder. */
    it("still shows a first-time pick-up customer the reminder", async () => {
        const result = await checkoutAsFirstTimer(null);

        await waitFor(() => expect(result.current.pickUpReminder).toBe(true));
        expect(result.current.pendingDeliveryOrder).toBeNull();
    });

    /**
     * The cart is a Drawer at the same modal z-index and portals in later, so leaving it open
     * would bury the delivery checkout exactly as it once buried the pick-up reminder.
     */
    it("closes the cart so the delivery checkout is not buried behind it", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockFetchCustomerMe.mockResolvedValue(MOCK_CUSTOMER_ME);
        const params = makeParams({ isAdmin: false });

        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Andrew", "Delivery", "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", "Andrew", "Delivery", "Cash", "", "branch-1");
        });

        await waitFor(() => expect(result.current.pendingDeliveryOrder).not.toBeNull());
        expect(params.setCartOpen).toHaveBeenCalledWith(false);
    });
});

describe("useCheckout — a guest's delivery order after the OTP gate", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    /**
     * §12.7: "that last one is why delivery no longer needs the customer to be logged in
     * beforehand — by the time the address book opens, the guest has a token." The address list is
     * account-scoped, so a guest who reached the checkout drawer unverified would see an empty
     * address book and be unable to place the order at all.
     */
    it("holds a verified guest's delivery order for payment rather than creating it", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "tok-verified", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce({ ...MOCK_CUSTOMER_ME, phone: "12345678", name: "Guest" });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, "Delivery", "Cash", "", "branch-1", true);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, "Delivery", "Cash", "", "branch-1", true);
        });

        // The gate, not the seam: no order exists yet and the customer is being asked to verify.
        expect(result.current.ui.isLoginOpen).toBe(true);
        expect(result.current.checkout.pendingDeliveryOrder).toBeNull();

        await act(async () => {
            await result.current.auth.login("12345678", "0000");
        });

        await waitFor(() => expect(result.current.checkout.pendingDeliveryOrder).not.toBeNull());
        expect(result.current.checkout.pendingDeliveryOrder).toEqual(expect.objectContaining({
            type: "Delivery",
            tel: "12345678",
        }));
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    /**
     * The verified phone, not the typed one: the sheet lets a customer go back and change the
     * number on the code step, and `POST /create_order` links an order to an account purely by
     * string-matching `tel`. A delivery order filed under a phone nobody verified would be
     * unreachable from the account it belongs to — and its saved addresses belong to the other one.
     */
    it("files the held delivery order under the phone that was actually verified", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "tok-verified", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce({ ...MOCK_CUSTOMER_ME, phone: "99998888", name: "Verified Name" });

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, "Delivery", "Cash", "", "branch-1", true);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, "Delivery", "Cash", "", "branch-1", true);
        });

        await act(async () => {
            await result.current.auth.login("99998888", "0000");
        });

        await waitFor(() => expect(result.current.checkout.pendingDeliveryOrder).not.toBeNull());
        expect(result.current.checkout.pendingDeliveryOrder).toEqual(
            expect.objectContaining({ tel: "99998888", type: "Delivery" }));
    });
});
