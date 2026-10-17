import { jest, describe, it, expect, afterEach, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// CartPopup renders its copy via useTranslation, so initialize the real i18n instance the
// same way app/providers.tsx does.
import i18n from "../../../shared/i18n";

import CartPopup from "./CartComponent";
import { BranchPickerDrawer } from "../../branch/components/BranchPickerDrawer";
import { BranchSwitchWarningDrawer } from "../../branch/components/BranchSwitchWarningDrawer";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";

// The stacking test below mounts the real picker; its map half must never load the Google script.
jest.mock("../../branch/components/BranchMapView");

function makeCartItem(): CartItem {
    return {
        id: 1,
        name: "Water",
        size: "M",
        category: "Beverages",
        isThinDough: false,
        isGarlicCrust: false,
        extraIngredients: [],
        toppings: [],
        note: "",
        quantity: 1,
        description: "",
        amount: 2.5,
        discountAmount: 0,
        comboItems: null,
        photo: "",
    };
}

const ITEMS: CartItem[] = [makeCartItem()];

function cartProps(overrides: Partial<React.ComponentProps<typeof CartPopup>> = {}): React.ComponentProps<typeof CartPopup> {
    return {
        open: true,
        onClose: jest.fn<void, []>(),
        items: ITEMS,
        onChangeQuantity: jest.fn(),
        onChangeSize: jest.fn(),
        onRemoveItem: jest.fn(),
        onCheckout: jest.fn(),
        openPizzaEditPopUp: jest.fn(),
        openPizzaComboEditPopup: jest.fn(),
        openDetroitComboEditPopup: jest.fn(),
        isAdmin: false,
        handleDiscountChange: jest.fn(),
        menuData: [],
        paymentMethod: DEFAULT_PAYMENT_METHOD,
        onPaymentChange: jest.fn<void, [string]>(),
        orderType: "Pick Up",
        onDeliveryTypeChange: jest.fn<void, [string]>(),
        isKiosk: false,
        ...overrides,
    };
}

function renderCart(overrides: Partial<React.ComponentProps<typeof CartPopup>> = {}) {
    const props = cartProps(overrides);
    render(<CartPopup {...props} />);
    return props;
}

describe("CartPopup — payment toggle", () => {
    it("renders the payment options and preselects the passed method (customer)", () => {
        renderCart({ paymentMethod: PAY_ONLINE_METHOD });

        expect(screen.getByRole("button", { name: "Benefit" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "BenefitPay" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Benefit" }).getAttribute("aria-pressed")).toBe("true");
    });

    // Back for now (17 Oct 2026): a pickup customer may pay on collection again, sent as the same
    // counter tender the kiosk uses, which useCheckout routes to the plain createOrder flow.
    it("offers paying at the counter, sent as the counter tender", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, paymentMethod: PAY_ONLINE_METHOD });

        fireEvent.click(screen.getByRole("button", { name: "At counter" }));

        expect(onPaymentChange).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
    });

    it("calls onPaymentChange with the canonical value when a method is selected", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange, paymentMethod: WALLET_METHOD });

        fireEvent.click(screen.getByRole("button", { name: "Benefit" }));

        expect(onPaymentChange).toHaveBeenCalledWith(PAY_ONLINE_METHOD);
    });

    it("offers the wallet as its own method, distinct from the hosted card page", () => {
        const onPaymentChange = jest.fn<void, [string]>();
        renderCart({ onPaymentChange });

        fireEvent.click(screen.getByRole("button", { name: "BenefitPay" }));

        expect(onPaymentChange).toHaveBeenCalledWith(WALLET_METHOD);
    });

    it("hides the payment toggle for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByRole("button", { name: "Benefit" })).toBeNull();
        expect(screen.queryByRole("button", { name: "BenefitPay" })).toBeNull();
    });
});

describe("CartPopup — delivery-type toggle", () => {
    // Delivery is selectable: HomePageModals' onDeliveryTypeChange runs the availability gate and
    // falls back to Keeta, so the cart must not pre-empt that decision by disabling the option.
    it("renders Pickup and a selectable Delivery option for customers", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        const delivery = screen.getByRole("button", { name: /delivery/i });
        expect(screen.getByRole("button", { name: /pickup/i })).toBeTruthy();
        expect(delivery.hasAttribute("disabled")).toBe(false);
        // The absence of the attribute is not the same as the option being operable: MUI can mark
        // a ToggleButton unusable through its own class alone, and the "coming soon" state this
        // replaced was exactly that shape. Press it and see that the choice actually leaves.
        expect(delivery.className).not.toMatch(/Mui-disabled/);
        fireEvent.click(delivery);
        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Delivery");
    });

    /** The retired sub-label. `cart.comingSoon` was removed with the option's disabled state. */
    it("no longer promises delivery is coming soon", () => {
        renderCart();

        expect(screen.queryByText(/coming soon/i)).toBeNull();
    });

    it("reports a Delivery choice to the caller", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        fireEvent.click(screen.getByRole("button", { name: /delivery/i }));

        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Delivery");
    });

    // Delivery is paid online in DeliveryCheckoutDrawer, which asks for the method itself.
    // A visible group here would let a customer pick Cash and then be charged by card.
    it("hides the payment-method toggle when Delivery is selected", () => {
        renderCart({ orderType: "Delivery" });

        expect(screen.getByRole("button", { name: /delivery/i })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Benefit" })).toBeNull();
        expect(screen.queryByRole("button", { name: "BenefitPay" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Benefit" })).toBeNull();
    });

    it("hides both the delivery-type and payment-method toggles on kiosk (always Pickup + Card)", () => {
        renderCart({ isKiosk: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
        expect(screen.queryByRole("button", { name: "Benefit" })).toBeNull();
        expect(screen.queryByRole("button", { name: "BenefitPay" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Benefit" })).toBeNull();
        expect(screen.queryByText(/payment method/i)).toBeNull();
    });

    it("hides the delivery-type toggle for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
    });

    it("leaves the rest of the cart chrome intact on kiosk — items, total and Checkout button still render", () => {
        renderCart({ isKiosk: true });

        expect(screen.getByText("Water")).toBeTruthy();
        expect(screen.getByText(/total/i)).toBeTruthy();
        expect(screen.getAllByText("2.50").length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: /checkout/i })).toBeTruthy();
    });
});

describe("CartPopup — checkout", () => {
    // The cart supplies the real delivery type + payment method and infoCollected=false so the
    // checkout hook still gates guests/logged-in-without-name into ClientInfoPopup.
    it("passes order type, payment method and infoCollected=false to onCheckout", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, paymentMethod: WALLET_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", WALLET_METHOD, "", null, false);
    });

    // The highlighted row and the sent value must agree, so a tender the list does not offer (the
    // retired "Cash" option, say) falls back to BENEFIT for both.
    it("sends BENEFIT, the highlighted method, when handed a tender the list does not offer", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, paymentMethod: "Cash" });

        expect(screen.getByRole("button", { name: "Benefit" }).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", PAY_ONLINE_METHOD, "", null, false);
    });

    it("keeps sending the kiosk its own tender — kiosk never chooses", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, isKiosk: true, paymentMethod: DEFAULT_PAYMENT_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", DEFAULT_PAYMENT_METHOD, "", null, false);
    });
});

describe("CartPopup — remembered payment method", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("restores the BENEFIT method the customer paid with last time", () => {
        window.localStorage.setItem("ic.preferredPaymentMethod", WALLET_METHOD);
        const onPaymentChange = jest.fn<void, [string]>();

        renderCart({ onPaymentChange, paymentMethod: PAY_ONLINE_METHOD });

        expect(onPaymentChange).toHaveBeenCalledWith(WALLET_METHOD);
    });

    it("remembers the method only when the customer actually checks out", () => {
        renderCart({ paymentMethod: WALLET_METHOD });
        expect(window.localStorage.getItem("ic.preferredPaymentMethod")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(window.localStorage.getItem("ic.preferredPaymentMethod")).toBe(WALLET_METHOD);
    });

    it("ignores a stored value that is not a method", () => {
        window.localStorage.setItem("ic.preferredPaymentMethod", "Cash");
        const onPaymentChange = jest.fn<void, [string]>();

        renderCart({ onPaymentChange, paymentMethod: PAY_ONLINE_METHOD });

        expect(onPaymentChange).not.toHaveBeenCalled();
    });

    it("restores nothing for delivery, which picks its method elsewhere", () => {
        window.localStorage.setItem("ic.preferredPaymentMethod", WALLET_METHOD);
        const onPaymentChange = jest.fn<void, [string]>();

        renderCart({ onPaymentChange, orderType: "Delivery", paymentMethod: PAY_ONLINE_METHOD });

        expect(onPaymentChange).not.toHaveBeenCalled();
    });
});

const GRUNWALD: IBranch = {
    id: "b-1", externalId: "ext-1", branchNo: 1, branchName: "Grunwald", branchNameAr: "جرونوالد",
    locale: "en", latitude: null, longitude: null, address: "Náměstí 14. října, Praha 5",
};

describe("CartPopup — pick-up branch card", () => {
    afterEach(async () => {
        await i18n.changeLanguage("en");
    });

    it("names the pickup branch and its address under a 'Pick up from' label", () => {
        renderCart({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });

        expect(screen.getByText("Pick up from")).toBeTruthy();
        expect(screen.getByText("Grunwald")).toBeTruthy();
        expect(screen.getByText("Náměstí 14. října, Praha 5")).toBeTruthy();
        // The chevron card replaces the old text link.
        expect(screen.queryByText(/change branch/i)).toBeNull();
    });

    it("is one button labelled with the section and the branch, opening the picker on tap", () => {
        const onChangeBranch = jest.fn<void, []>();
        renderCart({ pickupBranch: GRUNWALD, onChangeBranch });

        fireEvent.click(screen.getByRole("button", { name: "Pick up from Grunwald" }));

        expect(onChangeBranch).toHaveBeenCalledTimes(1);
    });

    // The order rhythm the owner chose: label above control for all three blocks, in this order.
    it("sits between the delivery-type toggle and the payment method", () => {
        renderCart({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });

        const deliveryTitle = screen.getByText("Delivery type");
        const pickupTitle = screen.getByText("Pick up from");
        const paymentTitle = screen.getByText("Payment method");

        expect(deliveryTitle.compareDocumentPosition(pickupTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(pickupTitle.compareDocumentPosition(paymentTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows the branch address on its own line under the name", () => {
        renderCart({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });

        expect(screen.getByTestId("cart-pickup-branch-address").textContent).toBe("Náměstí 14. října, Praha 5");
    });

    // Asserted by testid, not by text: an empty secondary line would still pass a text check
    // while leaving a blank row under the name.
    it.each([
        ["missing", undefined],
        ["null", null],
        ["blank", "   "],
    ])("omits the address line when the address is %s", (_label, address) => {
        renderCart({ pickupBranch: { ...GRUNWALD, address }, onChangeBranch: jest.fn<void, []>() });

        expect(screen.getByText("Grunwald")).toBeTruthy();
        expect(screen.queryByTestId("cart-pickup-branch-address")).toBeNull();
    });

    // A delivery order is filed at whichever kitchen the address resolves to.
    it("is hidden for a delivery order", () => {
        renderCart({ orderType: "Delivery", pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });

        expect(screen.queryByText("Pick up from")).toBeNull();
        expect(screen.queryByText("Grunwald")).toBeNull();
    });

    it("is hidden when no branch is known", () => {
        renderCart({ pickupBranch: null, onChangeBranch: jest.fn<void, []>() });

        expect(screen.queryByText("Pick up from")).toBeNull();
    });

    it("is hidden when the branch has no name to show", () => {
        renderCart({ pickupBranch: { ...GRUNWALD, branchName: "  ", branchNameAr: null }, onChangeBranch: jest.fn<void, []>() });

        expect(screen.queryByText("Pick up from")).toBeNull();
    });

    // A chevron that does nothing on tap is a broken affordance, so no handler means no card.
    it("is hidden when nothing can change the branch", () => {
        renderCart({ pickupBranch: GRUNWALD });

        expect(screen.queryByText("Pick up from")).toBeNull();
    });

    it("is hidden on kiosk, which hides the whole section", () => {
        renderCart({ isKiosk: true, pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });
        expect(screen.queryByText("Grunwald")).toBeNull();
    });

    it("is hidden for admin", () => {
        renderCart({ isAdmin: true, pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });
        expect(screen.queryByText("Grunwald")).toBeNull();
    });

    it("shows the Arabic branch name to an Arabic reader", async () => {
        await i18n.changeLanguage("ar");
        renderCart({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });

        expect(screen.getByText("الاستلام من")).toBeTruthy();
        expect(screen.getByText("جرونوالد")).toBeTruthy();
        expect(screen.getByRole("button", { name: "الاستلام من جرونوالد" })).toBeTruthy();
    });

    it("points the chevron onward in LTR", () => {
        renderCart({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });

        expect(screen.getByTestId("cart-pickup-branch-chevron-right")).toBeTruthy();
        expect(screen.queryByTestId("cart-pickup-branch-chevron-left")).toBeNull();
    });

    // The RTL emotion cache mirrors the row but not the glyph, so a right chevron would point back.
    it("mirrors the chevron in RTL", () => {
        render(
            <ThemeProvider theme={createTheme({ direction: "rtl" })}>
                <CartPopup {...cartProps({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() })} />
            </ThemeProvider>
        );

        expect(screen.getByTestId("cart-pickup-branch-chevron-left")).toBeTruthy();
        expect(screen.queryByTestId("cart-pickup-branch-chevron-right")).toBeNull();
    });
});

/**
 * The card opens the picker WITHOUT closing the cart, so closing or confirming the picker lands
 * the customer back in the cart. That only works if the picker — and the cart-loss warning that
 * follows a switch with a full cart — paint above the cart.
 *
 * MUI does not raise a later modal: ModalManager handles aria-hidden, focus and the scroll lock,
 * never z-index. The cart is a `Modal` (theme.zIndex.modal, 1300) and a temporary `Drawer` gets
 * theme.zIndex.drawer (1200), so without an explicit z-index both sheets open BEHIND the cart.
 */
describe("CartPopup — sheets opened from the cart", () => {
    function zIndexOf(root: Element | null | undefined): number {
        expect(root).toBeTruthy();
        return Number(window.getComputedStyle(root as HTMLElement).zIndex);
    }

    function cartRoot(): Element | null {
        return screen.getByText("Cart").closest(".MuiModal-root");
    }

    it("paints the branch picker above the still-open cart", () => {
        render(
            <>
                <CartPopup {...cartProps({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() })} />
                <BranchPickerDrawer open branches={[GRUNWALD]} onSelect={jest.fn()} dismissable onClose={jest.fn()} />
            </>
        );

        const pickerRoot = document.querySelector(".MuiDrawer-root");
        const pickerZ = zIndexOf(pickerRoot);
        const cartZ = zIndexOf(cartRoot());

        expect(Number.isNaN(pickerZ)).toBe(false);
        expect(pickerZ > cartZ).toBe(true);
    });

    it("paints the cart-loss warning above the still-open cart", () => {
        render(
            <>
                <CartPopup {...cartProps({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() })} />
                <BranchSwitchWarningDrawer
                    open loading={false} targetBranch={GRUNWALD} unavailableNames={[]} error={null}
                    onConfirm={jest.fn()} onCancel={jest.fn()}
                />
            </>
        );

        const warningRoot = document.querySelector(".MuiDrawer-root");
        const warningZ = zIndexOf(warningRoot);
        const cartZ = zIndexOf(cartRoot());

        expect(Number.isNaN(warningZ)).toBe(false);
        expect(warningZ > cartZ).toBe(true);
    });
});
