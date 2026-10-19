import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React, { useState } from "react";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
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
import {
    backdropOf, cartModalRoot, focusedElement, layerOf, phoneCartRoot, scrollContainerOf, sheetRoot,
} from "./cartLayout.testutil";

jest.mock("../../branch/components/BranchMapView");

// The PC cart (owner, 18 Oct 2026): the pizza popup's centred two-column dialog — items on the
// warm left, choices in the white column beside them, total and pay button pinned under those.
// Same content and same order arguments as the phone.

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
        orderType: "Pick Up",
        onDeliveryTypeChange: jest.fn<void, [string]>(),
        isKiosk: false,
        ...overrides,
    };
}

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    clearMatchMedia();
});

describe("CartPopup — PC dialog", () => {
    it("is the pizza popup's two-column dialog on PC", () => {
        stubMatchMedia(true);
        render(<CartPopup {...cartProps()} />);

        const rules = emotionRulesFor(screen.getByTestId("item-popup-dialog"));
        expect(rules).toContain("width:min(960px, 92vw)");
        expect(rules).toContain("height:min(680px, 90vh)");
        expect(rules).toContain("border-radius:24px");
        const asideRules = emotionRulesFor(screen.getByTestId("item-popup-aside"));
        expect(asideRules).toContain("flex:0 0 45%");
        expect(asideRules).toContain("background-color:#f4ede8");
    });

    it("lists the items on the warm side and keeps every choice in the column beside it", () => {
        stubMatchMedia(true);
        render(<CartPopup {...cartProps()} />);

        const aside = screen.getByTestId("item-popup-aside");
        expect(within(aside).getByText("Cart")).toBeTruthy();
        expect(within(aside).getByText("Water")).toBeTruthy();
        // Its own scroll, so a long order never pushes the pay button away.
        expect(scrollContainerOf(screen.getByText("Water"))).toBe(aside);

        const dialog = screen.getByTestId("item-popup-dialog");
        [screen.getByText("Delivery type"), screen.getByRole("button", { name: "Checkout · 2.50 BHD" })].forEach((control) => {
            expect(dialog.contains(control)).toBe(true);
            expect(aside.contains(control)).toBe(false);
        });
    });

    // Owner, 19 Oct 2026: the total rides on the button; there is no total line above it.
    it("pins the pay button, which names the total, under the scrolling choices", () => {
        stubMatchMedia(true);
        render(<CartPopup {...cartProps()} />);

        const choices = scrollContainerOf(screen.getByText("Delivery type"));
        expect(choices).not.toBeNull();
        expect(choices).not.toBe(screen.getByTestId("item-popup-aside"));
        const button = screen.getByRole("button", { name: "Checkout · 2.50 BHD" });
        expect(choices?.contains(button)).toBe(false);
        expect(scrollContainerOf(button)).toBeNull();
        expect((choices as Node).compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByText("Total(VAT incl.)")).toBeNull();
    });

    it("gives the pay button the phone's 48px height and 16px corners", () => {
        stubMatchMedia(true);
        render(<CartPopup {...cartProps()} />);

        const rules = emotionRulesFor(screen.getByRole("button", { name: "Checkout · 2.50 BHD" }));
        expect(rules).toContain("height:48px");
        expect(rules).toContain("border-radius:16px");
    });

    it("replaces the phone's back-arrow header with the round close button", () => {
        stubMatchMedia(true);
        const props = cartProps();
        render(<CartPopup {...props} />);

        expect(screen.queryByTestId("ArrowBackIosNewIcon")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on Escape", () => {
        stubMatchMedia(true);
        const props = cartProps();
        render(<CartPopup {...props} />);

        fireEvent.keyDown(screen.getByTestId("item-popup-dialog"), { key: "Escape" });

        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on a click outside the dialog", () => {
        stubMatchMedia(true);
        const props = cartProps();
        render(<CartPopup {...props} />);

        fireEvent.click(backdropOf(screen.getByTestId("item-popup-dialog")));

        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    // HomePageModals mounts the cart only while it is open, so this harness does the same.
    function CartOpener(): JSX.Element {
        const [open, setOpen] = useState(false);
        return (
            <>
                <button type="button" onClick={() => setOpen(true)}>Open cart</button>
                {open && <CartPopup {...cartProps({ onClose: () => setOpen(false) })} />}
            </>
        );
    }

    it("holds focus inside the dialog and hands it back to the opener on close", () => {
        stubMatchMedia(true);
        render(<CartOpener />);
        const opener = screen.getByRole("button", { name: "Open cart" });
        act(() => opener.focus());

        fireEvent.click(opener);
        const dialog = screen.getByTestId("item-popup-dialog");
        expect(dialog.contains(focusedElement())).toBe(true);

        act(() => opener.focus());
        expect(dialog.contains(focusedElement())).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
        expect(focusedElement()).toBe(opener);
    });

    it("shows the unavailable-items notice as a card over the dialog that closes on its own", () => {
        stubMatchMedia(true);
        const onCloseUnavailablePopup = jest.fn<void, []>();
        const props = cartProps({
            unavailablePopupOpen: true, unavailableItems: ["Cola"], unavailableMessage: "Some items ran out",
            onCloseUnavailablePopup,
        });
        render(<CartPopup {...props} />);

        // Its own Modal rather than the overlay inside the cart's: the dialog's round close button
        // would sit on top of the overlay's own.
        const message = screen.getByText("Some items ran out");
        expect(screen.getByTestId("item-popup-dialog").contains(message)).toBe(false);
        expect(cartModalRoot()?.contains(message)).toBe(false);

        fireEvent.keyDown(message, { key: "Escape" });
        expect(onCloseUnavailablePopup).toHaveBeenCalledTimes(1);
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it("keeps the same sections and places the order with the same arguments as on the phone", () => {
        stubMatchMedia(true);
        const props = cartProps();
        render(<CartPopup {...props} />);

        expect(screen.getByText("Delivery type")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Checkout · 2.50 BHD" }));

        expect(props.onCheckout).toHaveBeenCalledWith(ITEMS, null, null, "Pick Up", WALLET_METHOD, "", null, false);
    });

    it("puts the close button on the left in Arabic", () => {
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

        const rules = emotionRulesFor(screen.getByRole("button", { name: "Close" }));
        expect(rules).toContain("left:16px");
        expect(rules).not.toContain("right:16px");
    });
});

describe("CartPopup — the phone cart is unchanged", () => {
    function expectFullScreenCart(): void {
        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
        expect(screen.queryByTestId("item-popup-aside")).toBeNull();
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
        expect(screen.getByTestId("ArrowBackIosNewIcon")).toBeTruthy();

        const rules = emotionRulesFor(phoneCartRoot());
        expect(rules).toContain("position:absolute");
        expect(rules).toContain("inset:0");
        expect(rules).toContain("background-color:#FAFAFA");
        expect(rules).not.toContain("width:");
    }

    it("stays the full-screen cart on the phone", () => {
        render(<CartPopup {...cartProps()} />);

        expectFullScreenCart();
    });

    // HomePageModals provides false for admin and kiosk, which keep the full-screen cart.
    it.each([
        ["admin", { isAdmin: true }],
        ["kiosk", { isKiosk: true }],
        ["a customer on a surface that does not allow it", {}],
    ])("stays full-screen on a wide screen for %s", (_label, overrides) => {
        stubMatchMedia(true);
        render(
            <DesktopLayoutAllowedContext.Provider value={false}>
                <CartPopup {...cartProps(overrides)} />
            </DesktopLayoutAllowedContext.Provider>
        );

        expectFullScreenCart();
    });

    it("keeps the unavailable-items notice inside the phone cart", () => {
        render(<CartPopup {...cartProps({ unavailablePopupOpen: true, unavailableItems: ["Cola"] })} />);

        expect(phoneCartRoot().contains(screen.getByText("Cola"))).toBe(true);
    });
});

/**
 * PC twins of CartComponent.test.tsx's "sheets opened from the cart": the cart's "Pick up from"
 * card opens the picker, and a switch with a full cart opens the cart-loss warning, on top of the
 * still-open cart dialog. As dialogs they keep the phone sheets' modal + 1, so they still paint
 * above the cart's Modal.
 */
describe("CartPopup — PC dialogs opened from the cart dialog", () => {
    const GRUNWALD: IBranch = {
        id: "b-grunwald", externalId: "ext-grunwald", branchNo: 2, branchName: "Grunwald",
        locale: "en", latitude: null, longitude: null,
    };

    it("paints the branch picker dialog above the cart dialog", () => {
        stubMatchMedia(true);
        render(
            <>
                <CartPopup {...cartProps({ pickupBranch: GRUNWALD, onChangeBranch: jest.fn<void, []>() })} />
                <BranchPickerDrawer open branches={[GRUNWALD]} onSelect={jest.fn()} dismissable onClose={jest.fn()} />
            </>
        );

        const pickerZ = layerOf(sheetRoot("dialog"));
        const cartZ = layerOf(cartModalRoot());

        expect(Number.isNaN(pickerZ)).toBe(false);
        expect(pickerZ > cartZ).toBe(true);
    });

    it("paints the cart-loss warning dialog above the cart dialog", () => {
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

        const warningZ = layerOf(sheetRoot("dialog"));
        const cartZ = layerOf(cartModalRoot());

        expect(Number.isNaN(warningZ)).toBe(false);
        expect(warningZ > cartZ).toBe(true);
    });
});
