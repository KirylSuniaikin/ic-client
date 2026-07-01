import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../shared/api/management");

import { createOrder, checkCustomer } from "../../../shared/api/public";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import { useCheckout } from "./useCheckout";
import type { CartItem, MenuItem } from "../../menu/types";
import type { Order } from "../types";
import { BranchClosedError } from "../types";

const mockCreateOrder = jest.mocked(createOrder);
const mockCheckCustomer = jest.mocked(checkCustomer);
const mockGetAllBannedCstmrs = jest.mocked(getAllBannedCstmrs);

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
    it("checkoutLoading is false initially", () => {
        const { result } = renderHook(() => useCheckout(makeParams()));
        expect(result.current.checkoutLoading).toBe(false);
    });

    it("all popup booleans are false initially", () => {
        const { result } = renderHook(() => useCheckout(makeParams()));
        expect(result.current.phonePopupOpen).toBe(false);
        expect(result.current.isCrossSellOpen).toBe(false);
        expect(result.current.pickUpReminder).toBe(false);
        expect(result.current.unavailablePopupOpen).toBe(false);
        expect(result.current.errorSnackBarOpen).toBe(false);
        expect(result.current.blacklistSnackBarOpen).toBe(false);
    });
});

describe("useCheckout — handleCheckout cross-sell gate (non-admin)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("opens the cross-sell popup on the first checkout call for a customer", async () => {
        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })));

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.isCrossSellOpen).toBe(true);
    });

    it("does NOT call createOrder on the first checkout call (cross-sell gate)", async () => {
        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })));

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("skips the cross-sell gate on the second checkout call", async () => {
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockCheckCustomer.mockResolvedValue({ name: null, isBlacklisted: false });

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })));

        // first call: opens cross-sell
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        expect(result.current.isCrossSellOpen).toBe(true);

        // second call: cross-sell already shown — falls through to payment check
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        // paymentMethod is null → phone popup opens instead of cross-sell
        expect(result.current.phonePopupOpen).toBe(true);
    });
});

describe("useCheckout — handleCheckout payment gate (non-admin)", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("opens the phone popup when paymentMethod is null (after cross-sell seen)", async () => {
        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })));

        // Prime: first call to set wasCrossSellShown=true
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        // Second call with null payment → phone popup
        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.phonePopupOpen).toBe(true);
    });

    it("does NOT create an order when paymentMethod is null", async () => {
        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })));

        await act(async () => {
            // call 1: cross-sell
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });
        await act(async () => {
            // call 2: payment null → phone popup
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(mockCreateOrder).not.toHaveBeenCalled();
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

        const { result } = renderHook(() => useCheckout(params));

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

        const { result } = renderHook(() => useCheckout(makeParams({ isAdmin: false })));

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

        const { result } = renderHook(() => useCheckout(makeParams()));

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });

    it("navigates to order_status page after successful order creation", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);
        const navigateSpy = jest.fn<void, [string]>();

        const { result } = renderHook(() =>
            useCheckout(makeParams({ isAdmin: false, isKiosk: false, navigate: navigateSpy })),
        );

        await act(async () => {
            await result.current.executeOrderCreation(
                { tel: "12345678", type: "Pick Up", branchId: "branch-1", items: [], notes: "", amount_paid: 2.5, customer_name: null, payment_type: "Cash" },
                ITEMS,
            );
        });

        expect(navigateSpy).toHaveBeenCalledWith("/order_status?order_id=order-123");
    });

    it("sets checkoutLoading to false after order creation (success path)", async () => {
        mockCreateOrder.mockResolvedValue(MOCK_ORDER);

        const { result } = renderHook(() => useCheckout(makeParams()));

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

        const { result } = renderHook(() => useCheckout(makeParams()));

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

        const { result } = renderHook(() => useCheckout(params));

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
        const { result } = renderHook(() => useCheckout(params));

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
        const { result } = renderHook(() => useCheckout(params));

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, "Cash", "", null);
        });

        await waitFor(() => {
            expect(navigateSpy).toHaveBeenCalledWith("/admin/");
        });
    });

    it("opens the adminOrderDetailsPopUp when paymentMethod is null (admin flow)", async () => {
        const { result } = renderHook(() =>
            useCheckout(makeParams({ isAdmin: true, adminBranchId: "branch-admin" })),
        );

        await act(async () => {
            await result.current.handleCheckout(ITEMS, "12345678", null, null, null, "", null);
        });

        expect(result.current.adminOrderDetailsPopUp).toBe(true);
    });
});
