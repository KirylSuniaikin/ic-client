import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, act } from "@testing-library/react";

import HomePageModals from "./HomePageModals";
import { useCart } from "../domains/cart/hooks/useCart";
import type { UseCartResult } from "../domains/cart/hooks/useCart";
import type { UseCheckoutResult } from "../domains/order/hooks/useCheckout";
import type { UseKioskCheckoutResult } from "../domains/kiosk/hooks/useKioskCheckout";
import type { CartItem, MenuItem } from "../domains/menu/types";

type CapturedProps = { onClose: () => void };
const mockCaptured: { pizzaCombo?: CapturedProps; detroitCombo?: CapturedProps } = {};

jest.mock("../domains/menu/components/popups/combo/PizzaComboPopup", () => ({
    PizzaComboPopup: (props: CapturedProps): null => { mockCaptured.pizzaCombo = props; return null; },
}));
jest.mock("../domains/menu/components/popups/combo/DetroitComboPopup", () => ({
    DetroitComboPopup: (props: CapturedProps): null => { mockCaptured.detroitCombo = props; return null; },
}));
jest.mock("../domains/menu/components/popups/PizzaPopupContent", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/menu/components/popups/ComboPopupContent", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/order/components/UpSellPopup", () => ({ UpsellPopup: (): null => null }));
jest.mock("../domains/kiosk/components/KioskBranchSelector", () => ({ KioskBranchSelector: (): null => null }));
jest.mock("../domains/kiosk/components/KioskPhoneEntrySheet", () => ({ KioskPhoneEntrySheet: (): null => null }));
jest.mock("../domains/kiosk/components/KioskOrderPlacedSheet", () => ({ KioskOrderPlacedSheet: (): null => null }));
jest.mock("../domains/menu/components/popups/BaguettePizzaPopup", () => ({ BaguettePizzaPopup: (): null => null }));
jest.mock("../domains/order/components/CrossSellPopup", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/cart/components/CartComponent", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/schedule/components/ClosedPopup", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/order/components/ClientInfoPopup", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/management/orders/components/AdminOrderDetailsPopUp", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/order/components/PickUpReminderPopup", () => ({ PickUpReminderPopup: (): null => null }));
jest.mock("../domains/order/components/OrderConfirmed", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/menu/components/popups/GenericItemPopupContent", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../shared/components/ErrorSnackbar", () => ({ __esModule: true, default: (): null => null }));
jest.mock("../domains/menu/components/UnavailablePopup", () => ({ UnavailablePopup: (): null => null }));
jest.mock("../domains/kiosk/utils/kioskBranch", () => ({ writeKioskBranch: (): void => undefined }));

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
    return {
        id: 1, name: "Pizza Combo", size: "M", category: "Combo Deals", isThinDough: false,
        isGarlicCrust: false, extraIngredients: [], toppings: [], note: "", quantity: 1,
        description: "", amount: 6, discountAmount: 0, comboItems: [], photo: "", ...overrides,
    };
}

// Fixture only: HomePageModals reads a handful of fields from checkout/kiosk; the rest are
// irrelevant to these tests, so the minimal objects are cast to the full hook result types.
const CHECKOUT_STUB = {
    pendingOrder: null, isCrossSellOpen: false, generalCrossSellItems: [], finalCrossSellItems: [],
} as unknown as UseCheckoutResult;
const KIOSK_STUB = {} as unknown as UseKioskCheckoutResult;
const MENU: MenuItem[] = [];

function Modals({ cart }: { cart: UseCartResult }): JSX.Element {
    return (
        <HomePageModals
            cart={cart} checkout={CHECKOUT_STUB} menuData={MENU} toppings={[]} extraIngredients={[]}
            availableBranches={[]} isSDoughAvailable phone="" username="" branchSelector={null}
            setBranchSelector={jest.fn()} kiosk={KIOSK_STUB} refreshMenu={async (): Promise<void> => undefined}
            pizzas={[]} brickPizzas={[]} beverages={[]} sauces={[]} isAdmin={false} isKiosk={false}
            adminBranchId={null}
        />
    );
}

function makeStubCart(flags: Partial<UseCartResult>): {
    cart: UseCartResult;
    setters: Record<
        "setEditMode" | "setEditItem" | "setPopupGroup" | "setPizzaComboPopupOpen" | "setDetroitComboPopupOpen",
        ReturnType<typeof jest.fn>
    >;
} {
    const setters = {
        setEditMode: jest.fn(), setEditItem: jest.fn(), setPopupGroup: jest.fn(),
        setPizzaComboPopupOpen: jest.fn(), setDetroitComboPopupOpen: jest.fn(),
    };
    // Fixture only: a stub cart exposing just the fields HomePageModals touches for these popups.
    const cart = { ...setters, editItem: null, editMode: false, popupGroup: null, upsellItem: null, ...flags } as unknown as UseCartResult;
    return { cart, setters };
}

beforeEach(() => {
    mockCaptured.pizzaCombo = undefined;
    mockCaptured.detroitCombo = undefined;
});

describe("HomePageModals — combo popup onClose resets edit state", () => {
    it("PizzaComboPopup onClose closes the popup and resets edit mode/item", () => {
        const { cart, setters } = makeStubCart({ pizzaComboPopupOpen: true });
        render(<Modals cart={cart} />);
        act(() => mockCaptured.pizzaCombo?.onClose());
        expect(setters.setPizzaComboPopupOpen).toHaveBeenCalledWith(false);
        expect(setters.setPopupGroup).toHaveBeenCalledWith(null);
        expect(setters.setEditMode).toHaveBeenCalledWith(false);
        expect(setters.setEditItem).toHaveBeenCalledWith(null);
    });

    it("DetroitComboPopup onClose closes the popup and resets edit mode/item", () => {
        const { cart, setters } = makeStubCart({ detroitComboPopupOpen: true });
        render(<Modals cart={cart} />);
        act(() => mockCaptured.detroitCombo?.onClose());
        expect(setters.setDetroitComboPopupOpen).toHaveBeenCalledWith(false);
        expect(setters.setPopupGroup).toHaveBeenCalledWith(null);
        expect(setters.setEditMode).toHaveBeenCalledWith(false);
        expect(setters.setEditItem).toHaveBeenCalledWith(null);
    });
});

describe("HomePageModals — close edit then add next item (real useCart)", () => {
    function Harness({ onCart }: { onCart: (c: UseCartResult) => void }): JSX.Element {
        const cart = useCart(MENU, false);
        onCart(cart);
        return <Modals cart={cart} />;
    }

    it.each(["pizzaCombo", "detroitCombo"] as const)("keeps the edited %s line when the next item is added", (which) => {
        let cart: UseCartResult | undefined;
        render(<Harness onCart={(c) => { cart = c; }} />);
        const combo = makeCartItem();
        const next = makeCartItem({ id: 2, name: "Cola", category: "Beverages", amount: 1 });

        act(() => { cart?.setCartItems([combo]); });
        act(() => {
            cart?.setEditItem(combo);
            cart?.setEditMode(true);
            if (which === "pizzaCombo") cart?.setPizzaComboPopupOpen(true);
            else cart?.setDetroitComboPopupOpen(true);
        });
        act(() => (which === "pizzaCombo" ? mockCaptured.pizzaCombo : mockCaptured.detroitCombo)?.onClose());
        act(() => { cart?.handleAddToCart(next); });

        expect(cart?.cartItems.map(i => i.name)).toEqual(["Pizza Combo", "Cola"]);
    });
});
