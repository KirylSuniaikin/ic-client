import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createOrder } from "../../../shared/api/public";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { refreshCustomerToken, fetchCustomerMe, verifyOtp } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, useCustomerAuth, __resetCustomerAuthStoreForTests } from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../../customer-auth/context/CustomerAuthUiProvider";
import { useCheckout } from "./useCheckout";
import type { CartItem, MenuItem } from "../../menu/types";
import type { Order } from "../types";
import type { CustomerMeResponse } from "../../customer-auth/types";
import { BranchClosedError, DEFAULT_PAYMENT_METHOD } from "../types";

// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");
// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../shared/api/management");
// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/customerAuth.ts
jest.mock("../../../shared/api/customerAuth");


const mockCreateOrder = jest.mocked(createOrder);
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
    };
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

    it("skips the cross-sell gate on the second checkout call and opens ClientInfoPopup directly (logged out)", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        expect(result.current.isCrossSellOpen).toBe(true);

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.phonePopupOpen).toBe(true);
    });
});

describe("useCheckout — handleCheckout payment gate (non-admin, guest)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("opens ClientInfoPopup directly when paymentMethod is null and not logged in (after cross-sell seen)", async () => {
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

    it("skips ClientInfoPopup and places the order straight from the cart when the profile has a name", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(result.current.phonePopupOpen).toBe(false);
    });

    it("sends the profile's phone/name, the default payment method and the cart note on a skipped-popup order", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        act(() => {
            result.current.setCartNote("no onions");
        });

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({
            tel: MOCK_CUSTOMER_ME.phone,
            customer_name: MOCK_CUSTOMER_ME.name,
            payment_type: DEFAULT_PAYMENT_METHOD,
            type: "Pick Up",
            notes: "no onions",
        }));
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

    it("places the order directly with no OTP gate when already logged in and paymentMethod is provided", async () => {
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

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(result.current.ui.isLoginOpen).toBe(false);
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
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1");
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
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1");
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
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1");
        });

        expect(mockGetAllBannedCstmrs).toHaveBeenCalled();
        expect(result.current.ui.isLoginOpen).toBe(true);
    });
});

describe("useCheckout — mandatory account verification gate (guest checkout)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    async function primeToGate(result: { current: ReturnType<typeof useCheckoutWithUi> }): Promise<void> {
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", "branch-1");
        });
    }

    it("does not call createOrder and opens the login sheet in checkout mode, prefilled with the typed phone", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await primeToGate(result);

        expect(mockCreateOrder).not.toHaveBeenCalled();
        expect(result.current.ui.isLoginOpen).toBe(true);
        expect(result.current.ui.loginPrefillPhone).toBe("12345678");
        expect(result.current.ui.loginCheckoutMode).toBe(true);
        expect(result.current.checkout.phonePopupOpen).toBe(false);
    });

    it("dismissing the sheet without verifying reopens the cart and creates no order", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        const params = makeParams({ isAdmin: false });

        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        await primeToGate(result);
        expect(result.current.ui.isLoginOpen).toBe(true);

        act(() => {
            result.current.ui.closeAll();
        });

        await waitFor(() => expect(params.setCartOpen).toHaveBeenCalledWith(true));
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("submits the order with the verified phone, not the typed phone, when they differ", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "tok-verified", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce({ ...MOCK_CUSTOMER_ME, phone: "99998888", name: "Verified Name" });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await primeToGate(result);
        expect(result.current.ui.isLoginOpen).toBe(true);

        await act(async () => {
            await result.current.auth.login("99998888", "0000");
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ tel: "99998888" }));
    });

    it("submits the order with the typed phone when verification confirms the same number", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "tok-verified", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce({ ...MOCK_CUSTOMER_ME, phone: "12345678", name: "Same Name" });
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckoutWithUi(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        await primeToGate(result);

        await act(async () => {
            await result.current.auth.login("12345678", "0000");
        });

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());
        expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ tel: "12345678" }));
        expect(mockGetAllBannedCstmrs).toHaveBeenCalledTimes(1);
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
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null);
        });

        expect(result.current.isCrossSellOpen).toBe(false);
        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    it("navigates to /admin/ after admin order creation", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const navigateSpy = jest.fn<void, [string]>();
        const params = makeParams({ isAdmin: true, adminBranchId: "branch-admin", navigate: navigateSpy });
        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null);
        });

        await waitFor(() => {
            expect(navigateSpy).toHaveBeenCalledWith("/admin/");
        });
    });

    it("opens the adminOrderDetailsPopUp when paymentMethod is null (admin flow), regardless of auth state", async () => {
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
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null);
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

        // First call is swallowed by the cross-sell gate; the second one checks out.
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Newcomer", null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Newcomer", null, "Cash", "", "branch-1");
        });

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
        expect(result.current.checkout.pendingOrder).toMatchObject({ tel: "12345678", customer_name: "Newcomer" });
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
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Nobody", null, "Cash", "", "branch-1");
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", "Nobody", null, "Cash", "", "branch-1");
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

describe("useCheckout — kiosk flow never gated", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("never opens the login sheet for a kiosk checkout", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const params = makeParams({ isAdmin: false, isKiosk: true });

        const { result } = renderHook(() => useCheckoutWithUi(params), { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null);
        });
        await act(async () => {
            await result.current.checkout.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null);
        });

        expect(result.current.ui.isLoginOpen).toBe(false);
        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });
});
