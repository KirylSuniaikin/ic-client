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
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD } from "../../order/types";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

// The stacking test below mounts the real picker; its map half must never load the Google script.
jest.mock("../../branch/components/BranchMapView");

// Read through a getter so each describe can open or close delivery for its own tests.
let mockDeliveryComingSoon = false;
jest.mock("../../delivery/constants", () => ({
    KEETA_DEEP_LINK: "https://keeta.example/fallback",
    get DELIVERY_COMING_SOON() {
        return mockDeliveryComingSoon;
    },
}));

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

// Owner, 19 Oct 2026: the cart asks only pickup or delivery and the branch; the methods are on the
// payment page that follows it (PaymentPage.test.tsx).
describe("CartPopup — no payment choice in the cart", () => {
    it("shows a customer no payment methods, only Checkout", () => {
        renderCart({ paymentMethod: PAY_ONLINE_METHOD });

        expect(screen.queryByText("Payment method")).toBeNull();
        expect(screen.queryByRole("radio")).toBeNull();
        expect(screen.queryByRole("button", { name: "Pay with Apple Pay" })).toBeNull();
        expect(screen.queryByTestId("payment-invite-bubble")).toBeNull();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });

    it("shows an Arabic customer no payment section either", async () => {
        await i18n.changeLanguage("ar");
        try {
            renderCart({ paymentMethod: DEFAULT_PAYMENT_METHOD });

            expect(screen.queryByText("طريقة الدفع")).toBeNull();
            expect(screen.queryByRole("radio")).toBeNull();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("shows no payment section for admin", () => {
        renderCart({ isAdmin: true });

        expect(screen.queryByText("Payment method")).toBeNull();
    });
});

describe("CartPopup — delivery coming soon", () => {
    beforeEach(() => {
        mockDeliveryComingSoon = true;
    });
    afterEach(() => {
        mockDeliveryComingSoon = false;
    });

    it("greys Delivery out under a Coming soon label", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        const delivery = screen.getByRole("button", { name: /delivery/i });
        expect(delivery.hasAttribute("disabled")).toBe(true);
        expect(delivery.textContent).toBe("DeliveryComing soon");
        fireEvent.click(delivery);
        expect(onDeliveryTypeChange).not.toHaveBeenCalled();
    });

    it("blinks the label, except for customers who turned motion off", () => {
        renderCart();

        const label = screen.getByText("Coming soon");
        const rules = emotionRulesFor(label);
        expect(rules).toContain("animation:deliveryComingSoonBlink 1.4s ease-in-out infinite");
        expect(rules).toMatch(/@media \(prefers-reduced-motion:reduce\) \{[^}]*\banimation:none/);
    });

    it("keeps Pickup selectable", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ orderType: "Delivery", onDeliveryTypeChange });

        fireEvent.click(screen.getByRole("button", { name: /pickup/i }));

        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Pick Up");
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

    /** Once delivery opens, the Coming soon label goes with the disabled state. */
    it("does not promise delivery is coming soon once it is open", () => {
        renderCart();

        expect(screen.queryByText(/coming soon/i)).toBeNull();
    });

    it("reports a Delivery choice to the caller", () => {
        const onDeliveryTypeChange = jest.fn<void, [string]>();
        renderCart({ onDeliveryTypeChange });

        fireEvent.click(screen.getByRole("button", { name: /delivery/i }));

        expect(onDeliveryTypeChange).toHaveBeenCalledWith("Delivery");
    });

    it("shows no payment section when Delivery is selected either", () => {
        renderCart({ orderType: "Delivery" });

        expect(screen.getByRole("button", { name: /delivery/i })).toBeTruthy();
        expect(screen.queryByText("Payment method")).toBeNull();
    });

    it("hides the delivery-type toggle on kiosk (always Pickup), with no payment section", () => {
        renderCart({ isKiosk: true });

        expect(screen.queryByRole("button", { name: /pickup/i })).toBeNull();
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
    // infoCollected=false: the checkout hook takes a customer on to sign-in and the payment page,
    // where the method is chosen, so the tender sent here is only the one the cart was handed.
    it("passes the order type and infoCollected=false to onCheckout", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, paymentMethod: PAY_ONLINE_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", PAY_ONLINE_METHOD, "", null, false);
    });

    it("checks a Delivery order out the same way", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, orderType: "Delivery", paymentMethod: PAY_ONLINE_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Delivery", PAY_ONLINE_METHOD, "", null, false);
    });

    it("keeps sending the kiosk its own tender — kiosk never chooses", () => {
        const onCheckout = jest.fn();
        renderCart({ onCheckout, isKiosk: true, paymentMethod: DEFAULT_PAYMENT_METHOD });

        fireEvent.click(screen.getByRole("button", { name: /checkout/i }));

        expect(onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", DEFAULT_PAYMENT_METHOD, "", null, false);
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

    // The order the owner chose: delivery type, then the pickup branch, then the total.
    it("sits between the delivery-type toggle and the total", () => {
        renderCart({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() });

        const deliveryTitle = screen.getByText("Delivery type");
        const pickupTitle = screen.getByText("Pick up from");
        const total = screen.getByText("Total(VAT incl.)");

        expect(deliveryTitle.compareDocumentPosition(pickupTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(pickupTitle.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
