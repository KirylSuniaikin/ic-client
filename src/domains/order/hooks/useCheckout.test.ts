import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../shared/api/management");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/customerAuth.ts
jest.mock("../../../shared/api/customerAuth");

import { createOrder, checkCustomer } from "../../../shared/api/public";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { refreshCustomerToken, fetchCustomerMe } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../../customer-auth/context/CustomerAuthUiProvider";
import { useCheckout } from "./useCheckout";
import type { CartItem, MenuItem } from "../../menu/types";
import type { Order } from "../types";
import type { CustomerMeResponse } from "../../customer-auth/types";

const mockCreateOrder = jest.mocked(createOrder);
const mockCheckCustomer = jest.mocked(checkCustomer);
const mockGetAllBannedCstmrs = jest.mocked(getAllBannedCstmrs);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockFetchCustomerMe = jest.mocked(fetchCustomerMe);

// useCheckout calls useCustomerAuth() and useCustomerAuthUi() internally (task-spec.md
// §4 req. 22/23, and Phase 3 req. 15), so every renderHook needs both providers as
// ancestors — mirrors app/providers.tsx wiring.
function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return React.createElement(
        CustomerAuthProvider,
        null,
        React.createElement(CustomerAuthUiProvider, null, children)
    );
}

// Combines useCheckout with useCustomerAuthUi under the same render, so a test can
// observe the openOrderDetail side effect (isProfileOpen/selectedOrderId) that
// executeOrderCreation triggers for a logged-in customer, without mocking the context.
function useCheckoutWithUi(params: Parameters<typeof useCheckout>[0]) {
    const checkout = useCheckout(params);
    const ui = useCustomerAuthUi();
    return { checkout, ui };
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
        // react-router NavigateFunction is typed as a function — jest.fn() satisfies it at runtime
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

    // task-spec.md §5.8/§9: guestPromptOpen/setGuestPromptOpen/dismissGuestPrompt/
    // continueCheckoutAfterLogin are removed from UseCheckoutResult entirely -- assert their
    // absence at runtime (in addition to the `yarn tsc --noEmit` gate, which only proves the
    // *type* no longer declares them, not that some other path doesn't still attach them to
    // the returned object).
    it("does not include guestPromptOpen/setGuestPromptOpen/dismissGuestPrompt/continueCheckoutAfterLogin on the returned result", async () => {
        const { result } = renderHook(() => useCheckout(makeParams()), { wrapper });
        await waitForAuthReady();

        expect(Object.prototype.hasOwnProperty.call(result.current, "guestPromptOpen")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result.current, "setGuestPromptOpen")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result.current, "dismissGuestPrompt")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result.current, "continueCheckoutAfterLogin")).toBe(false);
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
        mockCheckCustomer.mockResolvedValue({ name: null, isBlacklisted: false });

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        // first call: opens cross-sell
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        expect(result.current.isCrossSellOpen).toBe(true);

        // second call: cross-sell already shown, falls through to payment check
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        // paymentMethod is null, not logged in: guest goes straight to ClientInfoPopup unfilled
        // (task-spec.md section 6.3), no account-prompt detour.
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

        // Prime: first call to set wasCrossSellShown=true
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        // Second call with null payment, guest: opens ClientInfoPopup unfilled directly
        // (task-spec.md section 6.3), no account-prompt detour.
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
            // call 1: cross-sell
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await act(async () => {
            // call 2: payment null → guest prompt
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(mockCreateOrder).not.toHaveBeenCalled();
    });
});

describe("useCheckout — handleCheckout payment gate (non-admin, logged in)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("skips the guest prompt and opens ClientInfoPopup pre-filled from /customer/me when logged in", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })), { wrapper });
        await waitForAuthReady();

        // Prime: first call to set wasCrossSellShown=true
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        // Second call with null payment, logged in → prefilled ClientInfoPopup directly
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.phonePopupOpen).toBe(true);
        expect(result.current.customerPrefill).toEqual(MOCK_CUSTOMER_ME);
        expect(mockFetchCustomerMe).toHaveBeenCalledWith("tok-1");
    });

    it("falls back to an unfilled ClientInfoPopup when the profile fetch fails", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-1" });
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
});

describe("useCheckout — blacklist check", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("opens the blacklist snackbar when the customer's phone is blacklisted", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([{ id: 1, telephoneNo: "99999999" }]);
        mockCheckCustomer.mockResolvedValue(undefined);

        // Use a navigate spy
        const navigateSpy = jest.fn<void, [string]>();
        const params = makeParams({ isAdmin: false, navigate: navigateSpy });

        const { result } = renderHook(() => useCheckout(params), { wrapper });
        await waitForAuthReady();

        // prime cross-sell
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "99999999", null, null, "Cash", "", "branch-1");
        });
        // second call — cross-sell gate cleared, paymentMethod provided → blacklist check
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

    it("defers navigation and opens the account proposal for a guest with a phone", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const navigateSpy = jest.fn<void, [string, unknown?]>();

        const { result } = renderHook(() =>
            useCheckout(makeParams({ isAdmin: false, isKiosk: false, navigate: navigateSpy })),
        { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        // Guest stays on the page: the proposal opens (prefilled with the order phone) and the
        // tracking-page redirect is held back until the proposal is resolved.
        expect(result.current.postOrderProposalOpen).toBe(true);
        expect(result.current.postOrderProposalPhone).toBe("12345678");
        expect(navigateSpy).not.toHaveBeenCalled();

        // Resolving the proposal (declined, or account created) navigates to the tracking page.
        act(() => {
            result.current.resolvePostOrderProposal();
        });
        expect(navigateSpy).toHaveBeenCalledWith("/order_status?order_id=order-123");
        expect(result.current.postOrderProposalOpen).toBe(false);
    });

    it("calls openOrderDetail with the numeric order id and does not navigate for a logged-in customer", async () => {
        mockRefreshCustomerToken.mockReset();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "tok-3" });
        mockFetchCustomerMe.mockResolvedValueOnce(MOCK_CUSTOMER_ME);
        mockCreateOrder.mockResolvedValue({ ...MOCK_ORDER, id: "555" });
        const navigateSpy = jest.fn<void, [string, unknown?]>();

        const { result } = renderHook(() =>
            useCheckoutWithUi(makeParams({ isAdmin: false, isKiosk: false, navigate: navigateSpy })),
        { wrapper });
        await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());

        // Prime: drive the hook through the logged-in checkout gate first (cross-sell gate,
        // then payment-null gate), so the customer-auth token (set asynchronously by the
        // mount-time silent refresh) has definitely propagated into this hook render before
        // executeOrderCreation reads it.
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
        expect(result.current.checkout.postOrderProposalOpen).toBe(false);
    });

    it("navigates immediately for a guest order with no phone", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const navigateSpy = jest.fn<void, [string, unknown?]>();

        const { result } = renderHook(() =>
            useCheckout(makeParams({ isAdmin: false, isKiosk: false, navigate: navigateSpy })),
        { wrapper });
        await waitForAuthReady();

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(navigateSpy).toHaveBeenCalledWith("/order_status?order_id=order-123");
        expect(result.current.postOrderProposalOpen).toBe(false);
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

        // No cross-sell in admin mode — goes straight to creating order
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
});
