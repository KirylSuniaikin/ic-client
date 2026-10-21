import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// The page renders its copy via useTranslation; initialize the real i18n instance.
import i18n from "../../../shared/i18n";

import { CheckoutPaymentPage } from "./CheckoutPaymentPage";
import type { CheckoutPaymentPageProps } from "./CheckoutPaymentPage";
import { BranchPickerDrawer } from "../../branch/components/BranchPickerDrawer";
import { BranchSwitchWarningDrawer } from "../../branch/components/BranchSwitchWarningDrawer";
import type { IBranch } from "../../management/inventory/types";
import type { CartItem, MenuItem } from "../../menu/types";
import { DEFAULT_PAYMENT_METHOD, PAY_ONLINE_METHOD, WALLET_METHOD } from "../../order/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import { layerOf, modalRootOf, sheetRoot, wrapperOf } from "./cartLayout.testutil";

// The stacking tests below mount the real picker; its map half must never load the Google script.
jest.mock("../../branch/components/BranchMapView");

// The payment page (owner, 19 Oct 2026): after the cart and a guest's sign-in, every method this
// customer can use, and one button that pays with the chosen one.

const WATER: CartItem = {
    id: 1, name: "Water", size: "M", category: "Beverages", isThinDough: false, isGarlicCrust: false,
    extraIngredients: [], toppings: [], note: "", quantity: 2, description: "", amount: 1.25,
    discountAmount: 0, comboItems: null, photo: "",
};
const WATER_MENU = { name: "Water", name_ar: "ماء" } as MenuItem;

const ALL_METHODS = ["Apple Pay", "BenefitPay", "Card", "Benefit", "At counter"];

type PickupPayment = Extract<CheckoutPaymentPageProps["payment"], { kind: "pickup" }>;

/** Built per test: CRA's resetMocks would clear a module-level mock's implementation. */
function checkoutMethod(available = true, busy = false) {
    return { available, busy, start: jest.fn<void, []>() };
}

function renderPage(
    overrides: Partial<CheckoutPaymentPageProps> = {},
    payment: Partial<PickupPayment> = {},
    options: RenderOptions = {},
) {
    const onBack = jest.fn<void, []>();
    const onPayWithTender = jest.fn<void, [string]>();
    const pickup: PickupPayment = { kind: "pickup", onPayWithTender, ...payment };
    const props: CheckoutPaymentPageProps = {
        open: true,
        onBack,
        items: [WATER],
        menuData: [WATER_MENU],
        total: "2.50",
        fulfilment: { title: "Pick up from", name: "Al-Hidd", detail: "Road 114 Block 101" },
        busy: false,
        payment: pickup,
        ...overrides,
    };
    const view = render(<CheckoutPaymentPage {...props} />, options);
    return { ...view, onBack, onPayWithTender };
}

function methodNames(): string[] {
    return screen.getAllByRole("radio").map((radio) => radio.textContent ?? "");
}

function pick(name: string): void {
    fireEvent.click(screen.getByRole("radio", { name }));
}

afterEach(() => {
    clearMatchMedia();
});

describe("CheckoutPaymentPage — a pickup order", () => {
    it("lists every method by Keeta popularity, the counter last, with none chosen", () => {
        renderPage({}, { applePay: checkoutMethod(), cardPayment: checkoutMethod() });

        expect(methodNames()).toEqual(ALL_METHODS);
        screen.getAllByRole("radio").forEach((radio) => expect(radio.getAttribute("aria-checked")).toBe("false"));
    });

    it("leaves out card and Apple Pay when this customer cannot use them", () => {
        renderPage({}, { applePay: checkoutMethod(false), cardPayment: checkoutMethod(false) });

        expect(methodNames()).toEqual(["BenefitPay", "Benefit", "At counter"]);
    });

    it("opens on BenefitPay where the device has no Apple Pay", () => {
        renderPage({}, { applePay: checkoutMethod(false), cardPayment: checkoutMethod() });

        expect(methodNames()).toEqual(["BenefitPay", "Card", "Benefit", "At counter"]);
    });

    it("says where the order is collected from, and carries the new-methods bubble", () => {
        renderPage();

        const fulfilment = screen.getByTestId("payment-fulfilment");
        expect(screen.getByText("Pick up from")).toBeTruthy();
        expect(within(fulfilment).getByText("Al-Hidd")).toBeTruthy();
        expect(within(fulfilment).getByText("Road 114 Block 101")).toBeTruthy();
        expect(screen.getByTestId("payment-invite-bubble").textContent).toContain("Hey, we added new payment methods");
    });

    // Owner, 19 Oct 2026: even paddings. The button sits 24px in from each side, like the page
    // content.
    it("lines the pay button up with the content", () => {
        renderPage();

        const rules = emotionRulesFor(wrapperOf(screen.getByRole("button", { name: "Choose how to pay · 2.50 BHD" })));
        expect(rules).toContain("padding-left:24px");
        expect(rules).toContain("padding-right:24px");
    });

    it("keeps the pay button off until a method is chosen", () => {
        const { onPayWithTender } = renderPage();

        const button = screen.getByRole("button", { name: "Choose how to pay · 2.50 BHD" });
        expect(button.hasAttribute("disabled")).toBe(true);
        fireEvent.click(button);
        expect(onPayWithTender).not.toHaveBeenCalled();
    });

    it.each([
        ["Benefit", PAY_ONLINE_METHOD],
        ["BenefitPay", WALLET_METHOD],
    ])("pays %s with its tender, the amount on the button", (name, tender) => {
        const { onPayWithTender } = renderPage();

        pick(name);
        fireEvent.click(screen.getByRole("button", { name: "Pay · 2.50 BHD" }));

        expect(onPayWithTender).toHaveBeenCalledWith(tender);
    });

    it("places a pay-at-the-counter order with the counter tender", () => {
        const { onPayWithTender } = renderPage();

        pick("At counter");
        fireEvent.click(screen.getByRole("button", { name: "Place order · 2.50 BHD" }));

        expect(onPayWithTender).toHaveBeenCalledWith(DEFAULT_PAYMENT_METHOD);
    });

    it("opens the card form for Card, with no tender", () => {
        const cardPayment = checkoutMethod();
        const { onPayWithTender } = renderPage({}, { cardPayment });

        pick("Card");
        fireEvent.click(screen.getByRole("button", { name: "Pay · 2.50 BHD" }));

        expect(cardPayment.start).toHaveBeenCalledTimes(1);
        expect(onPayWithTender).not.toHaveBeenCalled();
    });

    it("swaps in Apple's own button for Apple Pay and opens its sheet in the same tap", () => {
        const applePay = checkoutMethod();
        const { onPayWithTender } = renderPage({}, { applePay });

        pick("Apple Pay");
        expect(screen.queryByRole("button", { name: /^Pay · 2.50/ })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

        expect(applePay.start).toHaveBeenCalledTimes(1);
        expect(onPayWithTender).not.toHaveBeenCalled();
    });

    it("holds Apple's button while its checkout is busy", () => {
        renderPage({}, { applePay: checkoutMethod(true, true) });

        pick("Apple Pay");

        expect(screen.getByRole("button", { name: "Pay with Apple Pay" }).hasAttribute("disabled")).toBe(true);
    });

    it("holds the pay button while the order is being placed", () => {
        renderPage({ busy: true });

        pick("BenefitPay");

        expect(screen.getByRole("button", { name: "Pay · 2.50 BHD" }).hasAttribute("disabled")).toBe(true);
    });

    // Sign-out or a refused eligibility check takes card away after it was picked.
    it("goes back to nothing chosen when a picked card stops being available", () => {
        const pickup: PickupPayment = { kind: "pickup", onPayWithTender: jest.fn(), cardPayment: checkoutMethod() };
        const { rerender } = renderPage({ payment: pickup });
        pick("Card");

        rerender(
            <CheckoutPaymentPage
                open onBack={jest.fn()} items={[WATER]} menuData={[]} total="2.50"
                fulfilment={{ title: "Pick up from", name: "Al-Hidd", detail: "" }} busy={false}
                payment={{ ...pickup, cardPayment: checkoutMethod(false) }}
            />
        );

        expect(screen.getByRole("button", { name: "Choose how to pay · 2.50 BHD" })).toBeTruthy();
    });

    it("goes back with the header's Back button on the phone", () => {
        const { onBack } = renderPage();

        fireEvent.click(screen.getByRole("button", { name: "Back" }));

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("speaks Arabic to an Arabic customer", async () => {
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = renderPage();

            expect(screen.getByText("الدفع")).toBeTruthy();
            expect(screen.getByRole("button", { name: "اختر طريقة الدفع · 2.50 د.ب" })).toBeTruthy();
            pick("بنفت");
            expect(screen.getByRole("button", { name: "ادفع · 2.50 د.ب" })).toBeTruthy();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});

// Owner, 19 Oct 2026: no total line over the button; the total is in the button's own label, and
// our red button is as tall and as wide as Apple's, on phone and PC alike.
describe.each([
    ["the phone", false],
    ["PC", true],
])("CheckoutPaymentPage — the total and the button, on %s", (_surface, desktop) => {
    function renderOn(): void {
        stubMatchMedia(desktop);
        renderPage({}, { applePay: checkoutMethod(), cardPayment: checkoutMethod() });
    }

    it.each([
        ["Card", "Pay · 2.50 BHD"],
        ["Benefit", "Pay · 2.50 BHD"],
        ["BenefitPay", "Pay · 2.50 BHD"],
        ["At counter", "Place order · 2.50 BHD"],
    ])("puts the total on the button for %s", (method, label) => {
        renderOn();

        pick(method);

        expect(screen.getByRole("button", { name: label })).toBeTruthy();
        expect(screen.queryByText("Total(VAT incl.)")).toBeNull();
    });

    it("shows the total before anything is chosen, on the button that asks for a method", () => {
        renderOn();

        expect(screen.getByRole("button", { name: "Choose how to pay · 2.50 BHD" })).toBeTruthy();
        expect(screen.queryByText("Total(VAT incl.)")).toBeNull();
    });

    // None of Apple's rules asks for the total beside its button: its payment sheet shows it.
    it("draws no total line over Apple's button either", () => {
        renderOn();

        pick("Apple Pay");

        expect(screen.getByRole("button", { name: "Pay with Apple Pay" })).toBeTruthy();
        expect(screen.queryByText("Total(VAT incl.)")).toBeNull();
    });

    it("gives our button Apple's height, corners and slot, so switching to Apple Pay moves nothing", () => {
        renderOn();

        pick("Card");
        const ours = screen.getByRole("button", { name: "Pay · 2.50 BHD" });
        const ourRules = emotionRulesFor(ours);
        const ourSlot = emotionRulesFor(wrapperOf(ours));
        expect(ourRules).toContain("height:48px");
        expect(ourRules).toContain("border-radius:16px");
        expect(ourSlot).toContain("padding-left:24px");
        expect(ourSlot).toContain("padding-right:24px");

        pick("Apple Pay");
        const apple = screen.getByRole("button", { name: "Pay with Apple Pay" });
        const appleRules = emotionRulesFor(apple);
        expect(appleRules).toContain("height:48px");
        expect(appleRules).toContain("border-radius:16px");
        expect(emotionRulesFor(wrapperOf(apple))).toBe(ourSlot);
    });
});

// Owner, 19 Oct 2026: the branch picker moved from the cart to the payment page. The "Pick up
// from" card is where a pickup's branch is changed before paying.
describe("CheckoutPaymentPage — the 'Pick up from' card", () => {
    it("is one button labelled with the section and the branch, opening the picker on tap", () => {
        const onChangeBranch = jest.fn<void, []>();
        renderPage({ onChangeBranch });

        const card = screen.getByRole("button", { name: "Pick up from Al-Hidd" });
        expect(within(card).getByText("Al-Hidd")).toBeTruthy();
        expect(within(card).getByText("Road 114 Block 101")).toBeTruthy();
        fireEvent.click(card);

        expect(onChangeBranch).toHaveBeenCalledTimes(1);
    });

    // A chevron that does nothing on tap is a broken promise, so no handler means no button.
    it("is plain text when nothing can change it, as on a delivery's page", () => {
        renderPage({ fulfilment: { title: "Deliver to", name: "Home", detail: "Block 101, Road 114" } });

        expect(within(screen.getByTestId("payment-fulfilment")).getByText("Home")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /^Deliver to/ })).toBeNull();
        expect(screen.queryByTestId("ChevronRightRoundedIcon")).toBeNull();
    });

    // A branch switched mid-payment would leave the order that is being placed at the old one.
    it("cannot be tapped while a payment is under way", () => {
        const onChangeBranch = jest.fn<void, []>();
        renderPage({ onChangeBranch, busy: true });

        const card = screen.getByRole("button", { name: "Pick up from Al-Hidd" });
        expect(card.hasAttribute("disabled")).toBe(true);
        fireEvent.click(card);
        expect(onChangeBranch).not.toHaveBeenCalled();
    });

    it("points the chevron onward in LTR", () => {
        renderPage({ onChangeBranch: jest.fn<void, []>() });

        expect(screen.getByTestId("ChevronRightRoundedIcon")).toBeTruthy();
        expect(screen.queryByTestId("ChevronLeftRoundedIcon")).toBeNull();
    });

    // The RTL emotion cache mirrors the row but not the glyph, so a right chevron would point back.
    it("mirrors the chevron in RTL", () => {
        const rtl = createTheme({ direction: "rtl" });
        renderPage({ onChangeBranch: jest.fn<void, []>() }, {}, {
            wrapper: ({ children }) => <ThemeProvider theme={rtl}>{children}</ThemeProvider>,
        });

        expect(screen.getByTestId("ChevronLeftRoundedIcon")).toBeTruthy();
        expect(screen.queryByTestId("ChevronRightRoundedIcon")).toBeNull();
    });

    // Only when the chosen branch is missing from the branch list; a blank gray card says nothing.
    it("is left out, title and all, when the branch has no name", () => {
        renderPage({ fulfilment: { title: "Pick up from", name: "", detail: "" }, onChangeBranch: jest.fn<void, []>() });

        expect(screen.queryByText("Pick up from")).toBeNull();
        expect(screen.queryByTestId("payment-fulfilment")).toBeNull();
        expect(screen.getByRole("radiogroup", { name: "Payment method" })).toBeTruthy();
    });

    it("is the same button on PC", () => {
        stubMatchMedia(true);
        const onChangeBranch = jest.fn<void, []>();
        renderPage({ onChangeBranch });

        fireEvent.click(screen.getByRole("button", { name: "Pick up from Al-Hidd" }));

        expect(onChangeBranch).toHaveBeenCalledTimes(1);
    });
});

/**
 * The card opens the picker WITHOUT closing the payment page, so closing or confirming the picker
 * lands the customer back on it. That only works if the picker, and the cart-loss warning that
 * follows a switch, paint above the page: MUI never raises a later modal, the page is a Modal at
 * theme.zIndex.modal (1300) and a temporary Drawer gets theme.zIndex.drawer (1200).
 */
describe.each([
    ["the phone", false, "drawer"],
    ["PC", true, "dialog"],
] as const)("CheckoutPaymentPage — sheets opened from the page, on %s", (_surface, desktop, form) => {
    const GRUNWALD: IBranch = {
        id: "b-grunwald", externalId: "ext-grunwald", branchNo: 2, branchName: "Grunwald",
        locale: "en", latitude: null, longitude: null,
    };

    function pageLayer(): number {
        return layerOf(modalRootOf(screen.getByTestId("payment-fulfilment")));
    }

    it("paints the branch picker above the still-open page", () => {
        stubMatchMedia(desktop);
        renderPage({ onChangeBranch: jest.fn<void, []>() });
        render(<BranchPickerDrawer open branches={[GRUNWALD]} onSelect={jest.fn()} dismissable onClose={jest.fn()} />);

        const pickerZ = layerOf(sheetRoot(form));

        expect(Number.isNaN(pickerZ)).toBe(false);
        expect(pickerZ > pageLayer()).toBe(true);
    });

    it("paints the cart-loss warning above the still-open page", () => {
        stubMatchMedia(desktop);
        renderPage({ onChangeBranch: jest.fn<void, []>() });
        render(
            <BranchSwitchWarningDrawer
                open loading={false} targetBranch={GRUNWALD} unavailableNames={[]} error={null}
                onConfirm={jest.fn()} onCancel={jest.fn()}
            />
        );

        const warningZ = layerOf(sheetRoot(form));

        expect(Number.isNaN(warningZ)).toBe(false);
        expect(warningZ > pageLayer()).toBe(true);
    });
});

describe("CheckoutPaymentPage — a delivery order", () => {
    function openDeliveryPage() {
        const onPayDelivery = jest.fn<void, [string]>();
        renderPage({
            fulfilment: { title: "Deliver to", name: "Home", detail: "Block 101, Road 114" },
            payment: { kind: "delivery", onPayDelivery },
        });
        return onPayDelivery;
    }

    // EazyPay's hosted page runs card and Apple Pay itself, so they do not depend on ours.
    it("lists what EazyPay's hosted page takes: Apple Pay, card and Benefit", () => {
        openDeliveryPage();

        expect(methodNames()).toEqual(["Apple Pay", "Card", "Benefit"]);
        expect(screen.getByText("Deliver to")).toBeTruthy();
        expect(screen.getByText("Home")).toBeTruthy();
    });

    it.each([
        ["Card", "CARD"],
        ["Benefit", "BENEFIT"],
    ])("pays %s on the hosted page as %s", (name, method) => {
        const onPayDelivery = openDeliveryPage();

        pick(name);
        fireEvent.click(screen.getByRole("button", { name: "Pay · 2.50 BHD" }));

        expect(onPayDelivery).toHaveBeenCalledWith(method);
    });

    it("pays Apple Pay on the hosted page too", () => {
        const onPayDelivery = openDeliveryPage();

        pick("Apple Pay");
        fireEvent.click(screen.getByRole("button", { name: "Pay with Apple Pay" }));

        expect(onPayDelivery).toHaveBeenCalledWith("APPLE_PAY");
    });
});

describe("CheckoutPaymentPage — on PC", () => {
    it("is the cart's two-column dialog: the order on the warm side, the methods beside it", () => {
        stubMatchMedia(true);
        renderPage();

        const aside = screen.getByTestId("item-popup-aside");
        expect(within(aside).getByText("Your order")).toBeTruthy();
        expect(within(aside).getByText("2 × Water")).toBeTruthy();
        expect(within(aside).getByText("2.50")).toBeTruthy();
        expect(aside.contains(screen.getByRole("radiogroup", { name: "Payment method" }))).toBe(false);
        expect(screen.getByText("Payment")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Choose how to pay · 2.50 BHD" })).toBeTruthy();
    });

    it("names the items in Arabic for an Arabic customer", async () => {
        stubMatchMedia(true);
        await i18n.changeLanguage("ar");
        try {
            const { unmount } = renderPage();

            expect(within(screen.getByTestId("item-popup-aside")).getByText("2 × ماء")).toBeTruthy();
            unmount();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("goes back with the round close button", () => {
        stubMatchMedia(true);
        const { onBack } = renderPage();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
