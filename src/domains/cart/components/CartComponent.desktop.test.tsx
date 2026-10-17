import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// CartPopup renders its copy via useTranslation; initialize the real i18n instance.
import "../../../shared/i18n";

import CartPopup from "./CartComponent";
import { BranchPickerDrawer } from "../../branch/components/BranchPickerDrawer";
import { BranchSwitchWarningDrawer } from "../../branch/components/BranchSwitchWarningDrawer";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";
import { WALLET_METHOD } from "../../order/types";
import { DesktopLayoutAllowedContext } from "../../../shared/hooks/useDesktopLayout";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

jest.mock("../../branch/components/BranchMapView");

// The PC cart: a 440px panel docked to the side over the dimmed menu, same content as the phone.

const ITEM: CartItem = {
    id: 1, name: "Water", size: "M", category: "Beverages", isThinDough: false, isGarlicCrust: false,
    extraIngredients: [], toppings: [], note: "", quantity: 1, description: "", amount: 2.5,
    discountAmount: 0, comboItems: null, photo: "",
};
const ITEMS: CartItem[] = [ITEM];

type CartProps = React.ComponentProps<typeof CartPopup>;

function cartProps(overrides: Partial<CartProps> = {}): CartProps {
    return {
        open: true,
        onClose: jest.fn<void, []>(),
        items: ITEMS,
        onChangeQuantity: jest.fn(),
        onChangeSize: jest.fn(),
        onRemoveItem: jest.fn(),
        onCheckout: jest.fn<void, unknown[]>(),
        openPizzaEditPopUp: jest.fn(),
        openPizzaComboEditPopup: jest.fn(),
        openDetroitComboEditPopup: jest.fn(),
        isAdmin: false,
        handleDiscountChange: jest.fn(),
        menuData: [],
        paymentMethod: WALLET_METHOD,
        onPaymentChange: jest.fn<void, [string]>(),
        orderType: "Pick Up",
        onDeliveryTypeChange: jest.fn<void, [string]>(),
        isKiosk: false,
        ...overrides,
    };
}

/** The cart's positioned root Box: title Typography → header Box → root Box. */
function cartRoot(): HTMLElement {
    const root = screen.getByText("Cart").parentElement?.parentElement;
    if (root == null) throw new Error("no cart root above the title");
    return root;
}

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    clearMatchMedia();
});

describe("CartPopup — PC panel", () => {
    it("docks as a full-height 440px panel on PC", () => {
        stubMatchMedia(true);
        render(<CartPopup {...cartProps()} />);

        const rules = emotionRulesFor(cartRoot());
        expect(rules).toContain("position:absolute");
        expect(rules).toContain("inset:0");
        expect(rules).toContain("left:auto");
        expect(rules).toContain("width:440px");
        expect(rules).toContain("box-shadow:0 2px 12px rgba(0,0,0,0.08)");
    });

    it("stays the full-screen cart on the phone", () => {
        render(<CartPopup {...cartProps()} />);

        const rules = emotionRulesFor(cartRoot());
        expect(rules).toContain("inset:0");
        expect(rules).not.toContain("left:auto");
        expect(rules).not.toContain("width:440px");
    });

    // HomePageModals provides false for admin and kiosk, which keep the full-screen cart.
    it("stays full-screen where the surface does not allow the PC layout", () => {
        stubMatchMedia(true);
        render(
            <DesktopLayoutAllowedContext.Provider value={false}>
                <CartPopup {...cartProps()} />
            </DesktopLayoutAllowedContext.Provider>
        );

        const rules = emotionRulesFor(cartRoot());
        expect(rules).not.toContain("width:440px");
        expect(rules).not.toContain("left:auto");
    });

    // The plugin flips `left: auto` to `right: auto`, so the Arabic panel docks on the left.
    it("docks on the other side in Arabic", () => {
        stubMatchMedia(true);
        // The app's RTL plugin chain (app/providers.tsx). The key starts with "css-" only so that
        // emotionRulesFor, which reads css-* classes, can see the flipped rules.
        const rtlCache = createCache({ key: "css-rtl", stylisPlugins: [prefixer, rtlPlugin] });
        render(
            <CacheProvider value={rtlCache}>
                <ThemeProvider theme={createTheme({ direction: "rtl" })}>
                    <CartPopup {...cartProps()} />
                </ThemeProvider>
            </CacheProvider>
        );

        const rules = emotionRulesFor(cartRoot());
        expect(rules).toContain("right:auto");
        expect(rules).not.toContain("left:auto");
    });

    it("keeps the same sections and places the order with the same arguments as on the phone", () => {
        stubMatchMedia(true);
        const props = cartProps();
        render(<CartPopup {...props} />);

        expect(screen.getByText("Delivery type")).toBeTruthy();
        expect(screen.getByText("Payment method")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(props.onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", WALLET_METHOD, "", null, false);
    });
});

/**
 * PC twins of CartComponent.test.tsx's "sheets opened from the cart": the cart's "Pick up from"
 * card opens the picker, and a switch with a full cart opens the cart-loss warning, on top of the
 * still-open cart panel. As dialogs they keep the phone sheets' modal + 1, so they still paint
 * above the panel's Modal.
 */
describe("CartPopup — PC dialogs opened from the cart panel", () => {
    const GRUNWALD: IBranch = {
        id: "b-grunwald", externalId: "ext-grunwald", branchNo: 2, branchName: "Grunwald",
        locale: "en", latitude: null, longitude: null,
    };

    function zIndexOf(root: Element | null | undefined): number {
        expect(root).toBeTruthy();
        return Number(window.getComputedStyle(root as HTMLElement).zIndex);
    }

    function cartModalRoot(): Element | null {
        return screen.getByText("Cart").closest(".MuiModal-root");
    }

    it("paints the branch picker dialog above the cart panel", () => {
        stubMatchMedia(true);
        render(
            <>
                <CartPopup {...cartProps({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() })} />
                <BranchPickerDrawer open branches={[GRUNWALD]} onSelect={jest.fn()} dismissable onClose={jest.fn()} />
            </>
        );

        const pickerZ = zIndexOf(document.querySelector(".MuiDialog-root"));
        const cartZ = zIndexOf(cartModalRoot());

        expect(Number.isNaN(pickerZ)).toBe(false);
        expect(pickerZ > cartZ).toBe(true);
    });

    it("paints the cart-loss warning dialog above the cart panel", () => {
        stubMatchMedia(true);
        render(
            <>
                <CartPopup {...cartProps({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() })} />
                <BranchSwitchWarningDrawer
                    open loading={false} targetBranch={GRUNWALD} unavailableNames={[]} error={null}
                    onConfirm={jest.fn()} onCancel={jest.fn()}
                />
            </>
        );

        const warningZ = zIndexOf(document.querySelector(".MuiDialog-root"));
        const cartZ = zIndexOf(cartModalRoot());

        expect(Number.isNaN(warningZ)).toBe(false);
        expect(warningZ > cartZ).toBe(true);
    });
});
