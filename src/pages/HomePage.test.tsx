// Assumed: admin mode hides CustomerIconButton (HeroSection is not rendered), so there is
// no real UI control to open the login/profile popup in that mode -- a small test-only
// trigger against the shared context is used instead, alongside one case that drives the
// real CustomerIconButton for the non-admin path (per the task spec's test plan).
import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// HomePage (via HeroSection/CustomerIconButton) uses useTranslation -- initialize the real
// i18n instance (side-effect import) so keys resolve to English, mirroring HeroSection.test.tsx.
import "../shared/i18n";

// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/{public,management,customerAuth}.ts
jest.mock("../shared/api/public");
jest.mock("../shared/api/management");
jest.mock("../shared/api/customerAuth");

// Manual mock (src/domains/schedule/utils/__mocks__/isWithinWorkingHours.ts) -- lets the
// ScrollHintArrow "closed branch" popup test below force cart.closedPopup open via the real
// handleOpenCart entry point, without needing a real working-hours schedule fixture.
jest.mock("../domains/schedule/utils/isWithinWorkingHours");

// lottie-web tries to obtain a real 2D canvas context at import time, which jsdom does not
// provide (no canvas backend installed) -- stub the whole package so HomePage's PizzaLoader
// (rendered while menu.loading is true) does not crash the test environment. Mirrors
// OrderStatusPage.test.tsx's identical stub.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

// jsdom never fires load events for images, so the real preloader would hold every test at
// PizzaLoader until its timeout elapsed. Its own behaviour is covered in useImagePreloader.test.ts;
// here the mock lets each test decide whether the photos are ready, and records the URLs HomePage
// asked for. Both names need the `mock` prefix -- jest hoists the factory above the imports and
// only allows it to close over identifiers spelled that way.
let mockImagesReady = true;
const mockPreloadedUrls: string[][] = [];
jest.mock("../shared/hooks/useImagePreloader", () => ({
    __esModule: true,
    useImagePreloader: (urls: string[]): boolean => {
        mockPreloadedUrls.push(urls);
        return mockImagesReady;
    },
}));

import { fetchBaseAppInfo, fetchPublicBranches, bpgCheckout } from "../shared/api/public";
import { getAllBannedCstmrs } from "../shared/api/management";
import { refreshCustomerToken, fetchCustomerMe, verifyOtp } from "../shared/api/customerAuth";
import { CustomerAuthProvider, useCustomerAuth, __resetCustomerAuthStoreForTests } from "../domains/customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../domains/customer-auth/context/CustomerAuthUiProvider";
import HomePage from "./HomePage";
import { createOrder } from "../shared/api/public";
import { CHOSEN_BRANCH_KEY } from "../domains/branch/constants";
import type { BaseAppInfoResponse, CreateOrderRequest, Order } from "../domains/order/types";
import type { IBranch } from "../domains/management/inventory/types";
import type { CustomerMeResponse } from "../domains/customer-auth/types";
import type { BpgCheckoutResult } from "../domains/payment/types";

import { isWithinWorkingHours } from "../domains/schedule/utils/isWithinWorkingHours";

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockIsWithinWorkingHours = jest.mocked(isWithinWorkingHours);
const mockFetchPublicBranches = jest.mocked(fetchPublicBranches);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockCreateOrder = jest.mocked(createOrder);
const mockBpgCheckout = jest.mocked(bpgCheckout);
const mockGetAllBannedCstmrs = jest.mocked(getAllBannedCstmrs);
const mockFetchCustomerMe = jest.mocked(fetchCustomerMe);
const mockVerifyOtp = jest.mocked(verifyOtp);

// A single available, non-pizza item so useMenuData's recommended-items effect seeds the
// cart directly (upsellDeclined=true bypasses the pizza/brick-pizza upsell popup entirely --
// see useCart.ts's handleAddToCart), without needing any user interaction with the menu UI.
const AVAILABLE_ITEM = {
    available: true,
    category: "Beverages",
    description: "",
    id: 1,
    is_best_seller: false,
    name: "Cola",
    photo: "cola.png",
    price: 1,
    size: "M",
};

const UNAVAILABLE_ITEM = {
    ...AVAILABLE_ITEM,
    id: 2,
    name: "Sprite",
    available: false,
};

// What ClientInfoPopup submits for "12345678" (Bahrain's 973 prefix is its default country).
const VERIFIED_PHONE = "97312345678";

const BASE_APP_INFO: BaseAppInfoResponse = {
    menu: [AVAILABLE_ITEM],
    extraIngr: [],
    toppings: [],
    isSDoughAvailable: true,
    userInfo: null,
};

// Test-only trigger, mounted as a sibling of HomePage inside the same CustomerAuthUiProvider,
// so a customer-auth popup can be opened/closed via the shared context directly. This exercises
// the exact `isAnyCustomerAuthPopupOpen` state HomePage folds into `noPopupOpen`, independent of
// whether a UI trigger (CustomerIconButton) is present in the current mode (it is hidden in admin
// mode, so this is also the only way to open it there).
// The login sheet itself mounts at the app root (CustomerAuthModals, app/providers.tsx), outside
// this tree, so test-verify-otp stands in for a customer entering the right code in it.
function AuthUiTestTrigger(): React.JSX.Element {
    const { openLogin, closeAll } = useCustomerAuthUi();
    const { login } = useCustomerAuth();
    return (
        <>
            <button onClick={() => openLogin()}>test-open-login</button>
            <button onClick={() => closeAll()}>test-close-all</button>
            <button onClick={() => { void login(VERIFIED_PHONE, "4821"); }}>test-verify-otp</button>
        </>
    );
}

function renderHomePage(initialEntries: string[], recommendedIds: string[] = ["1"]) {
    return render(
        <HelmetProvider>
            <CustomerAuthProvider>
                <CustomerAuthUiProvider>
                    <MemoryRouter initialEntries={initialEntries}>
                        <HomePage userParam={null} recommendedIds={recommendedIds} giftId={null} />
                    </MemoryRouter>
                    <AuthUiTestTrigger />
                </CustomerAuthUiProvider>
            </CustomerAuthProvider>
        </HelmetProvider>
    );
}

async function waitForAuthReady(): Promise<void> {
    await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
}

async function waitForCartSeeded(): Promise<void> {
    await waitFor(() => expect(screen.getByTestId("ShoppingCartIcon")).toBeTruthy());
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
    // usePixelTracking's FB Pixel vendor snippet (bootstrapped unconditionally by HomePage) looks
    // up `document.getElementsByTagName('script')[0]` to insert its own <script> before it -- real
    // pages always have one (the bundle's own script tag), but a bare jsdom document does not.
    // Provide one so the snippet's DOM insertion does not throw; this is a test-environment-only
    // stand-in for what the real page markup provides, not a change to usePixelTracking.ts itself.
    document.body.appendChild(document.createElement("script"));
});

beforeEach(() => {
    __resetCustomerAuthStoreForTests();
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    mockFetchBaseAppInfo.mockReset();
    mockFetchBaseAppInfo.mockResolvedValue(BASE_APP_INFO);
    mockFetchPublicBranches.mockReset();
    mockFetchPublicBranches.mockResolvedValue([]);
    // Default: branch open, matching the real isWithinWorkingHours(null) behavior every existing
    // test above already relies on. Only the closed-branch ScrollHintArrow test overrides this.
    mockIsWithinWorkingHours.mockReset();
    mockIsWithinWorkingHours.mockReturnValue(true);
    mockImagesReady = true;
    mockPreloadedUrls.length = 0;
    localStorage.clear();
    // task-spec.md §6.2: an ordinary customer with no stored branch is blocked by the entry gate.
    // Every PRE-EXISTING scenario in this file exercises the menu as an ordinary customer, so a
    // branch is pre-seeded here to keep them unblocked; the new gate tests below seed themselves
    // (or deliberately clear this) to exercise the gate directly.
    seedChosenBranch();
});

function makeDomRect(top: number): DOMRect {
    return { top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => undefined } as DOMRect;
}

// ScrollHintArrow own internal visibility (hero-scroll-away) is unrelated to this tasks
// popup-gating change, but it must stay visible for the tests below to observe anything at all.
// jsdom reports getBoundingClientRect() as all-zero by default, so the arrows own top-greater-than-
// zero check is false on mount and it hides itself regardless of popup state (confirmed empirically,
// see the task specs open question). Mocking the rect of every element to a positive top keeps the
// arrows own gate open, isolating these assertions to the new outer isKiosk-and-not-anyPopupOpen gate.
let restoreMenuTopRect: (() => void) | null = null;

function mockMenuTopScrolledIntoView(): void {
    const original = HTMLDivElement.prototype.getBoundingClientRect;
    HTMLDivElement.prototype.getBoundingClientRect = (): DOMRect => makeDomRect(1);
    restoreMenuTopRect = (): void => {
        HTMLDivElement.prototype.getBoundingClientRect = original;
    };
}

// useMenuData opens menu.branchSelector automatically for a kiosk tab with no branch chosen yet
// (localStorage key "kiosk_branch_data" absent) -- seed it so the kiosk tests below start from a
// steady "device already configured" state and can isolate the assertions to the flags under test,
// exactly as a real kiosk would be after its one-time setup.
function seedKioskBranchSelected(): void {
    localStorage.setItem("kiosk_branch_data", JSON.stringify({ id: "test-branch-id" }));
}

const CHOSEN_BRANCH: IBranch = {
    id: "chosen-branch-id", externalId: "ext-chosen", branchNo: 1, branchName: "Chosen Branch",
    locale: "en", latitude: null, longitude: null,
};

// task-spec.md §6.2: seeds a stored branch choice so an ordinary-customer render does not hit
// the mandatory entry gate -- mirrors seedKioskBranchSelected's role for kiosk mode.
function seedChosenBranch(): void {
    localStorage.setItem(CHOSEN_BRANCH_KEY, JSON.stringify(CHOSEN_BRANCH));
}

describe("HomePage -- noPopupOpen suppression", () => {
    it("shows the floating cart bar when no popup is open and the cart has items", async () => {
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.getByTestId("ShoppingCartIcon")).toBeTruthy();
    });

    it("hides the floating cart bar while a customer-auth popup is open, and shows it again after closeAll()", async () => {
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        fireEvent.click(screen.getByText("test-open-login"));
        await waitFor(() => expect(screen.queryByTestId("ShoppingCartIcon")).toBeNull());

        fireEvent.click(screen.getByText("test-close-all"));
        await waitFor(() => expect(screen.getByTestId("ShoppingCartIcon")).toBeTruthy());
    });

    it("opens the centralized login popup state via the real hero CustomerIconButton, suppressing the cart bar", async () => {
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        fireEvent.click(screen.getByRole("button", { name: "log in" }));

        await waitFor(() => expect(screen.queryByTestId("ShoppingCartIcon")).toBeNull());
    });

    it("hides the admin close button while a customer-auth popup is open in admin mode", async () => {
        renderHomePage(["/menu?isAdmin=true"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.getByTestId("CloseIcon")).toBeTruthy();

        fireEvent.click(screen.getByText("test-open-login"));
        await waitFor(() => expect(screen.queryByTestId("CloseIcon")).toBeNull());

        fireEvent.click(screen.getByText("test-close-all"));
        await waitFor(() => expect(screen.getByTestId("CloseIcon")).toBeTruthy());
    });

    it("does not regress the existing unavailablePopupOpen suppression of the cart bar", async () => {
        mockFetchBaseAppInfo.mockResolvedValue({
            ...BASE_APP_INFO,
            menu: [AVAILABLE_ITEM, UNAVAILABLE_ITEM],
        });
        renderHomePage(["/menu"], ["1,2"]);
        await waitForAuthReady();

        // Item 2 is unavailable, so the pendingUnavailableNames effect opens
        // checkout.unavailablePopupOpen. The floating cart bar has a dedicated guard for that
        // condition, separate from this task change, and it must keep suppressing the bar even
        // though item 1 was added to the cart.
        await waitFor(() => {
            expect(screen.getByText("Some items are no longer available")).toBeTruthy();
        });
        expect(screen.queryByTestId("ShoppingCartIcon")).toBeNull();
    });
});

describe("HomePage -- browser auto-translate", () => {
    it("does not opt the customer page out of browser translation", async () => {
        const { container } = renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(container.querySelector("[translate]")).toBeNull();
        expect(document.documentElement.getAttribute("translate")).toBeNull();
    });
});

describe("HomePage -- menu image preloading", () => {
    it("holds the loader after the menu data arrives, until the first photos are ready", async () => {
        mockImagesReady = false;
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitFor(() => expect(mockFetchBaseAppInfo).toHaveBeenCalled());

        // Menu data has loaded, so the old gate would already have painted the cards -- with their
        // photos still in flight. The preload gate keeps the loader up instead.
        expect(screen.queryByText("Cola")).toBeNull();
    });

    it("renders the menu once the photos are ready", async () => {
        renderHomePage(["/menu"]);
        await waitForAuthReady();

        await waitFor(() => expect(screen.getByText("Cola")).toBeTruthy());
    });

    it("preloads exactly the photo URL the card will render", async () => {
        // The preloader warms the browser cache by URL, so any mismatch with the card's own photo
        // would fetch the image twice and leave the card empty on first paint.
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitFor(() => expect(screen.getByText("Cola")).toBeTruthy());

        expect(mockPreloadedUrls.some(urls => urls.includes(AVAILABLE_ITEM.photo))).toBe(true);
    });
});

describe("HomePage -- kiosk ScrollHintArrow popup suppression", () => {
    afterEach(() => {
        restoreMenuTopRect?.();
        restoreMenuTopRect = null;
    });

    it("shows the ScrollHintArrow in kiosk mode when no popup is open", async () => {
        mockMenuTopScrolledIntoView();
        seedKioskBranchSelected();
        renderHomePage(["/menu?mode=kiosk"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.getByRole("button", { name: "Scroll down to the menu" })).toBeTruthy();
    });

    it("hides the ScrollHintArrow in kiosk mode while a customer-auth popup is open, and shows it again after closeAll()", async () => {
        mockMenuTopScrolledIntoView();
        seedKioskBranchSelected();
        renderHomePage(["/menu?mode=kiosk"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.getByRole("button", { name: "Scroll down to the menu" })).toBeTruthy();

        fireEvent.click(screen.getByText("test-open-login"));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Scroll down to the menu" })).toBeNull());

        fireEvent.click(screen.getByText("test-close-all"));
        await waitFor(() => expect(screen.getByRole("button", { name: "Scroll down to the menu" })).toBeTruthy());
    });

    it("hides the ScrollHintArrow in kiosk mode while the closed-branch popup is open", async () => {
        mockMenuTopScrolledIntoView();
        seedKioskBranchSelected();
        // Real handleOpenCart entry point: when the branch is not within working hours, clicking
        // the cart bar opens cart.closedPopup instead of the cart drawer -- a flag noPopupOpen
        // (and therefore the pre-existing part of anyPopupOpen) omits, exercised here directly.
        mockIsWithinWorkingHours.mockReturnValue(false);
        renderHomePage(["/menu?mode=kiosk"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.getByRole("button", { name: "Scroll down to the menu" })).toBeTruthy();

        fireEvent.click(screen.getByTestId("ShoppingCartIcon"));

        await waitFor(() => expect(screen.queryByRole("button", { name: "Scroll down to the menu" })).toBeNull());
    });

    it("does not render the ScrollHintArrow outside kiosk mode regardless of popup state", async () => {
        mockMenuTopScrolledIntoView();
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.queryByRole("button", { name: "Scroll down to the menu" })).toBeNull();

        fireEvent.click(screen.getByText("test-open-login"));
        await waitFor(() => expect(screen.queryByTestId("ShoppingCartIcon")).toBeNull());
        expect(screen.queryByRole("button", { name: "Scroll down to the menu" })).toBeNull();
    });
});

// The kiosk checkout must never route through checkout.checkoutLoading: HomePage returns a
// full-page <PizzaLoader/> for that flag (see the early return near the top of HomePage.tsx), which
// unmounts HomePageModals and every kiosk sheet with it -- mid-order. These tests drive the real
// cart -> cross-sell -> phone -> placed flow and assert the sheets stay mounted throughout.
describe("HomePage -- kiosk checkout flow", () => {
    beforeEach(() => {
        mockCreateOrder.mockReset();
        mockCreateOrder.mockResolvedValue({ id: "4321" } as Order);
    });

    /** Walks the real UI from a seeded cart to the phone sheet. */
    async function reachPhoneSheet(): Promise<void> {
        seedKioskBranchSelected();
        renderHomePage(["/menu?mode=kiosk"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        fireEvent.click(screen.getByTestId("ShoppingCartIcon"));
        fireEvent.click(await screen.findByRole("button", { name: "Checkout" }));

        // First Checkout press is swallowed by the cross-sell gate, which kiosk keeps.
        fireEvent.click(await screen.findByRole("button", { name: "Next" }));
        await waitFor(() => expect(screen.getByText("Enter your phone number")).toBeTruthy());
    }

    it("asks for name and phone on kiosk -- and still no branch picker", async () => {
        await reachPhoneSheet();

        expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
        expect(screen.getByRole("textbox", { name: "Phone number" })).toBeTruthy();
        // The backend derives the branch from the paired kiosk; asking would be a second way to
        // get it wrong.
        expect(screen.queryByLabelText(/branch/i)).toBeNull();
    });

    it("creates the order from the phone step and shows the number to quote at the counter", async () => {
        await reachPhoneSheet();

        fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Layla" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "12345678" } });
        fireEvent.click(screen.getByRole("button", { name: "Place order" }));

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledTimes(1));
        // If anything on this path set checkoutLoading, HomePage's early return would have replaced
        // the entire tree -- including this sheet -- with PizzaLoader.
        await waitFor(() => expect(screen.getByText("Order placed")).toBeTruthy());
        expect(screen.getByText("4321")).toBeTruthy();
    });

    it("hides the floating cart pill while a kiosk sheet is open", async () => {
        await reachPhoneSheet();

        // noPopupOpen folds in kiosk.isSheetOpen; without it the zIndex 9999 pill paints over the sheet.
        expect(screen.queryByTestId("ShoppingCartIcon")).toBeNull();
    });

    it("reopens the branch picker when staff triple-click the top of the hero video", async () => {
        seedKioskBranchSelected();
        renderHomePage(["/menu?mode=kiosk"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        const hotspot = screen.getByTestId("kiosk-repair-hotspot");
        fireEvent.click(hotspot);
        fireEvent.click(hotspot);
        fireEvent.click(hotspot);

        await waitFor(() => expect(screen.getByText("Setup Kiosk Mode")).toBeTruthy());
    });
});

// The cross-sell sheet's "Next" adds the picks and carries on with checkout in the same click.
// The add only queues a cart update, so checkout used to get the cart from before the picks: the
// customer saw the items in their cart, and the order went out without them. Only the paths that
// place the order straight from that click were hit -- the kiosk, and a logged-in customer with a
// name on file. Guests pass through ClientInfoPopup, which reads a later cart, so they are the
// regression guard here, not the bug.
describe("HomePage -- items picked in the cross-sell reach the order", () => {
    // FINAL_CROSS_SELL (useCheckout.ts) offers items by exact name, so these carry those names.
    const COLA_ZERO = { ...AVAILABLE_ITEM, id: 3, name: "Coca Cola Zero", photo: "zero.png", price: 0.5 };
    const DETROIT_BRICK = {
        ...AVAILABLE_ITEM, id: 4, name: "BBQ Chicken Ranch Detroit Brick", category: "Brick Pizzas",
        photo: "brick.png", price: 2.5, size: "",
    };

    // amountOfOrders > 0 keeps the first-timer pick-up reminder out of the way, and the phone is
    // the one the guest types, so the guest path's verified phone matches the typed one.
    const NAMED_CUSTOMER: CustomerMeResponse = {
        id: "account-1", phone: VERIFIED_PHONE, preferredBranchId: null, name: "Layla",
        address: null, amountOfOrders: 4, lastOrderDate: null,
    };

    const BPG_CHECKOUT: BpgCheckoutResult = {
        orderNo: 77, status: "Pending Payment", reference: "ref-1", redirectUrl: "https://gateway.test/pay",
    };

    const PLACED_ORDER: Order = {
        id: "4321", order_no: 12, tel: VERIFIED_PHONE, customer_name: "Layla", delivery_method: "Pick Up",
        payment_type: "Cash", address: "", notes: "", items: [], amount_paid: 1.5, order_type: "Pick Up",
        external_id: null, phone_number: VERIFIED_PHONE, order_created: "2026-10-17T12:00:00",
        status: "Kitchen Phase", isPaid: false, branch_id: "test-branch-id",
    };

    // Pay online (the cart's default method) ends in a full-page `window.location.assign` to the
    // gateway, which jsdom does not implement -- swapped for a spy for this block only, mirroring
    // HomePageModals.test.tsx, and restored so the rest of the file keeps the real location.
    const mockLocationAssign = jest.fn<void, [string]>();
    const originalLocation = window.location;

    beforeAll(() => {
        Object.defineProperty(window, "location", {
            writable: true,
            configurable: true,
            value: { ...originalLocation, assign: mockLocationAssign },
        });
    });

    afterAll(() => {
        Object.defineProperty(window, "location", { writable: true, configurable: true, value: originalLocation });
    });

    beforeEach(() => {
        mockFetchBaseAppInfo.mockResolvedValue({ ...BASE_APP_INFO, menu: [AVAILABLE_ITEM, COLA_ZERO, DETROIT_BRICK] });
        mockGetAllBannedCstmrs.mockResolvedValue([]);
        mockBpgCheckout.mockResolvedValue(BPG_CHECKOUT);
        mockCreateOrder.mockResolvedValue(PLACED_ORDER);
    });

    function signInAs(profile: CustomerMeResponse): void {
        mockRefreshCustomerToken.mockResolvedValue({ accessToken: "tok-1", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue(profile);
    }

    /** Opens the cart, lets the first Checkout press open the cross-sell sheet, picks, and presses Next. */
    async function checkoutThroughCrossSell(picks: string[]): Promise<void> {
        await waitForAuthReady();
        await waitForCartSeeded();
        fireEvent.click(screen.getByTestId("ShoppingCartIcon"));
        fireEvent.click(await screen.findByRole("button", { name: "Checkout" }));
        await screen.findByText("Customers also buy");
        // The menu behind the sheet shows the same photos, but the open sheet hides it from the
        // accessibility tree, so a role query finds only the sheet's own card.
        picks.forEach(pick => fireEvent.click(screen.getByRole("img", { name: pick })));
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }

    async function waitForGatewayOrder(): Promise<CreateOrderRequest> {
        await waitFor(() => expect(mockBpgCheckout).toHaveBeenCalledTimes(1));
        return mockBpgCheckout.mock.calls[0][0].order;
    }

    function orderLines(order: CreateOrderRequest): string[] {
        return order.items.map(item => `${item.name} x${item.quantity}`);
    }

    it("kiosk: the order placed from the phone sheet carries the drink picked in the cross-sell", async () => {
        seedKioskBranchSelected();
        renderHomePage(["/menu?mode=kiosk"]);

        await checkoutThroughCrossSell(["Coca Cola Zero"]);
        await screen.findByText("Enter your phone number");
        fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Layla" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "12345678" } });
        fireEvent.click(screen.getByRole("button", { name: "Place order" }));

        await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledTimes(1));
        const order = mockCreateOrder.mock.calls[0][0];
        expect(orderLines(order)).toEqual(["Cola x1", "Coca Cola Zero x1"]);
        expect(order.amount_paid).toBe(1.5);
    });

    it("named logged-in customer: the order sent to the payment gateway carries the pick", async () => {
        signInAs(NAMED_CUSTOMER);
        renderHomePage(["/menu"]);

        await checkoutThroughCrossSell(["Coca Cola Zero"]);

        const order = await waitForGatewayOrder();
        expect(orderLines(order)).toEqual(["Cola x1", "Coca Cola Zero x1"]);
        expect(order.amount_paid).toBe(1.5);
    });

    it("named logged-in customer: a pick already in the cart goes out as one line with both units", async () => {
        signInAs(NAMED_CUSTOMER);
        renderHomePage(["/menu"], ["3"]);

        await checkoutThroughCrossSell(["Coca Cola Zero"]);

        // The cart merges the pick into the existing line, so the stale cart sent x1 while the
        // screen showed x2.
        const order = await waitForGatewayOrder();
        expect(orderLines(order)).toEqual(["Coca Cola Zero x2"]);
        expect(order.amount_paid).toBe(1);
    });

    it("named logged-in customer: a Detroit Brick picked in the cross-sell goes out as a plain brick, with no combo offer", async () => {
        signInAs(NAMED_CUSTOMER);
        renderHomePage(["/menu"]);

        await checkoutThroughCrossSell(["BBQ Chicken Ranch Detroit Brick"]);

        // The combo offer would hold the brick back while checkout carried on without it.
        expect(screen.queryByText(/Sauce \+ Drink just for/)).toBeNull();
        const order = await waitForGatewayOrder();
        expect(orderLines(order)).toEqual(["Cola x1", "BBQ Chicken Ranch Detroit Brick x1"]);
    });

    it("named logged-in customer who picks nothing still checks out once, with the cart as it was", async () => {
        signInAs(NAMED_CUSTOMER);
        renderHomePage(["/menu"]);

        await checkoutThroughCrossSell([]);

        const order = await waitForGatewayOrder();
        expect(orderLines(order)).toEqual(["Cola x1"]);
        await waitFor(() => expect(mockLocationAssign).toHaveBeenCalledWith(BPG_CHECKOUT.redirectUrl));
        expect(mockBpgCheckout).toHaveBeenCalledTimes(1);
    });

    it("guest: the order placed after ClientInfoPopup and the phone code carries the pick", async () => {
        mockVerifyOtp.mockResolvedValue({ accessToken: "tok-verified", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue(NAMED_CUSTOMER);
        renderHomePage(["/menu"]);

        await checkoutThroughCrossSell(["Coca Cola Zero"]);
        fireEvent.change(await screen.findByRole("textbox", { name: "Phone number" }), { target: { value: "12345678" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Layla" } });
        fireEvent.click(screen.getByRole("button", { name: "Checkout (Take Out)" }));
        // The guest's order is held until the phone is verified, so nothing has gone out yet.
        await waitFor(() => expect(mockGetAllBannedCstmrs).toHaveBeenCalled());
        expect(mockBpgCheckout).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("test-verify-otp"));

        const order = await waitForGatewayOrder();
        expect(orderLines(order)).toEqual(["Cola x1", "Coca Cola Zero x1"]);
    });
});

// task-spec.md §6.1/§6.2 -- the mandatory entry gate for an ordinary customer with no stored
// branch, and the precedence that must keep winning over it (kiosk/admin/edit mode).
describe("HomePage -- customer branch entry gate", () => {
    const GATE_BRANCH: IBranch = {
        id: "gate-branch-id", externalId: "ext-gate", branchNo: 5, branchName: "Gate Branch",
        locale: "en", latitude: null, longitude: null,
    };

    it("blocks an ordinary customer with no stored branch until one is chosen", async () => {
        // Overrides this file's beforeEach seeding -- this test exercises the unseeded case.
        localStorage.clear();
        mockFetchPublicBranches.mockResolvedValue([GATE_BRANCH]);
        renderHomePage(["/menu"]);
        await waitForAuthReady();

        await waitFor(() => expect(screen.getByText("Choose your branch")).toBeTruthy());
        expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText("Gate Branch"));

        // Tapping describes the branch first; the gate is only satisfied by the sheet's CTA. The
        // count is taken after the sheet's own descriptive fetch so the assertion below stays
        // about the menu reload, not about how the sheet sources its copy.
        const confirm = await screen.findByRole("button", { name: /order here/i });
        const fetchCallsBefore = mockFetchBaseAppInfo.mock.calls.length;
        fireEvent.click(confirm);

        await waitFor(() => expect(screen.queryByText("Choose your branch")).toBeNull());
        // The initial fetch ran against DEFAULT_BRANCH_ID before any choice existed -- selecting
        // a branch must reload the menu (task-spec.md §6.2 step 3).
        await waitFor(() => expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(fetchCallsBefore + 1));
        expect(JSON.parse(localStorage.getItem(CHOSEN_BRANCH_KEY) ?? "null")).toEqual(GATE_BRANCH);
    });

    it("does not block entry when a branch is already stored", async () => {
        // beforeEach already seeded a chosen branch via seedChosenBranch().
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.queryByText("Choose your branch")).toBeNull();
    });

    it("leaves kiosk mode unaffected by the customer entry gate", async () => {
        localStorage.clear();
        seedKioskBranchSelected();
        renderHomePage(["/menu?mode=kiosk"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        expect(screen.queryByText("Choose your branch")).toBeNull();
    });

    it("lets adminBranchId keep winning over the entry gate", async () => {
        localStorage.clear();
        renderHomePage(["/menu?isAdmin=true&branchId=admin-branch-xyz"]);
        await waitForAuthReady();

        await waitFor(() => expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, "admin-branch-xyz"));
        expect(screen.queryByText("Choose your branch")).toBeNull();
    });

    it("bypasses the gate in edit mode and inherits the order's branch", async () => {
        localStorage.clear();
        localStorage.setItem("orderToEdit", JSON.stringify({ branch_id: "order-branch-xyz", items: [] }));
        renderHomePage(["/menu?isEditMode=true"]);
        await waitForAuthReady();

        await waitFor(() => expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, "order-branch-xyz"));
        expect(screen.queryByText("Choose your branch")).toBeNull();
    });
});

// task-spec.md §6.4 -- the re-entry chip and the cart-loss switch warning, driven end to end
// through the real HeroSection/BranchPickerDrawer/BranchSwitchWarningDrawer.
describe("HomePage -- branch chip and cart-loss switch warning", () => {
    const TARGET_BRANCH: IBranch = {
        id: "target-branch-id", externalId: "ext-target", branchNo: 9, branchName: "New Branch",
        locale: "en", latitude: null, longitude: null,
    };

    it("chip tap reopens the picker; picking a different branch with cart items opens the warning; confirm drops only the unavailable line and switches", async () => {
        // beforeEach already seeded CHOSEN_BRANCH and BASE_APP_INFO (carries "Cola").
        mockFetchPublicBranches.mockResolvedValue([CHOSEN_BRANCH, TARGET_BRANCH]);
        mockFetchBaseAppInfo.mockImplementation(async (_userId: string | null, branchId: string) =>
            branchId === TARGET_BRANCH.id ? { ...BASE_APP_INFO, menu: [] } : BASE_APP_INFO
        );
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        fireEvent.click(screen.getByRole("button", { name: /change branch/i }));
        await waitFor(() => expect(screen.getByText("Choose your branch")).toBeTruthy());

        fireEvent.click(screen.getByText("New Branch"));
        fireEvent.click(await screen.findByRole("button", { name: /order here/i }));

        // The target branch's menu carries nothing, so the cart's one item (Cola) is unavailable
        // there -- the switch is not applied immediately; the warning names it and asks first.
        await waitFor(() => expect(screen.getByText("Switch to New Branch?")).toBeTruthy());
        expect(screen.queryByText("Choose your branch")).toBeNull();
        await waitFor(() => {
            const items = screen.getAllByTestId("branch-switch-unavailable-item");
            expect(items.map(i => i.textContent)).toContain("Cola");
        });

        fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));

        // Cola was the only cart item and the one dropped -- the floating cart bar disappears and
        // the stored choice moves to the target branch.
        await waitFor(() => expect(screen.queryByTestId("ShoppingCartIcon")).toBeNull());
        expect(JSON.parse(localStorage.getItem(CHOSEN_BRANCH_KEY) ?? "null")).toEqual(TARGET_BRANCH);
    });

    // The pill is position:fixed at zIndex 9999 and lands exactly on the warning's Switch/Cancel
    // buttons, so a customer with a full cart — the only customer who ever sees this sheet —
    // could not answer it.
    it("hides the floating cart pill while the cart-loss warning is open", async () => {
        mockFetchPublicBranches.mockResolvedValue([CHOSEN_BRANCH, TARGET_BRANCH]);
        mockFetchBaseAppInfo.mockImplementation(async (_userId: string | null, branchId: string) =>
            branchId === TARGET_BRANCH.id ? { ...BASE_APP_INFO, menu: [] } : BASE_APP_INFO
        );
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        // The cart is seeded, so the pill is on screen before the sheet opens.
        expect(screen.getByTestId("ShoppingCartIcon")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /change branch/i }));
        await waitFor(() => expect(screen.getByText("Choose your branch")).toBeTruthy());
        fireEvent.click(screen.getByText("New Branch"));
        fireEvent.click(await screen.findByRole("button", { name: /order here/i }));
        await waitFor(() => expect(screen.getByText("Switch to New Branch?")).toBeTruthy());

        expect(screen.queryByTestId("ShoppingCartIcon")).toBeNull();
    });

    // The owner's complaint on mobile: changing branch from the cart dropped the customer on the
    // menu. On web the picker opens over the cart and the cart never closes, so every exit from
    // the picker — and from the warning that follows — lands back in it.
    it("changing branch from the cart's 'Pick up from' card returns the customer to the cart", async () => {
        mockFetchPublicBranches.mockResolvedValue([CHOSEN_BRANCH, TARGET_BRANCH]);
        // Cola is on the target's menu too, so the switch keeps the cart non-empty.
        mockFetchBaseAppInfo.mockResolvedValue(BASE_APP_INFO);
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        fireEvent.click(screen.getByTestId("ShoppingCartIcon"));
        fireEvent.click(await screen.findByRole("button", { name: "Pick up from Chosen Branch" }));
        await waitFor(() => expect(screen.getByText("Choose your branch")).toBeTruthy());
        // Opened on top: the cart is still mounted underneath.
        expect(screen.getByText("Pick up from")).toBeTruthy();

        fireEvent.click(screen.getByTestId(`branch-option-${TARGET_BRANCH.id}`));
        fireEvent.click(await screen.findByRole("button", { name: /order here/i }));
        await waitFor(() => expect(screen.getByText("Switch to New Branch?")).toBeTruthy());
        fireEvent.click(await screen.findByRole("button", { name: "Switch branch" }));

        await waitFor(() => expect(screen.queryByText("Switch to New Branch?")).toBeNull());
        expect(screen.queryByText("Choose your branch")).toBeNull();
        expect(await screen.findByRole("button", { name: "Pick up from New Branch" })).toBeTruthy();
        expect(JSON.parse(localStorage.getItem(CHOSEN_BRANCH_KEY) ?? "null")).toEqual(TARGET_BRANCH);
    });

    it("dismissing the picker opened from the cart leaves the cart open", async () => {
        mockFetchPublicBranches.mockResolvedValue([CHOSEN_BRANCH, TARGET_BRANCH]);
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        fireEvent.click(screen.getByTestId("ShoppingCartIcon"));
        fireEvent.click(await screen.findByRole("button", { name: "Pick up from Chosen Branch" }));
        await waitFor(() => expect(screen.getByText("Choose your branch")).toBeTruthy());

        fireEvent.click(screen.getByRole("button", { name: /close/i }));

        await waitFor(() => expect(screen.queryByText("Choose your branch")).toBeNull());
        expect(screen.getByRole("button", { name: "Pick up from Chosen Branch" })).toBeTruthy();
    });

    it("does not render the chip in kiosk mode", async () => {
        seedKioskBranchSelected();
        renderHomePage(["/menu?mode=kiosk"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        // Kiosk keeps the branch name as a plain label — the branch is not the guest's to change.
        expect(screen.queryByRole("button", { name: /change branch/i })).toBeNull();
    });

    it("confirming the branch already chosen is a no-op -- no warning, no menu refetch", async () => {
        mockFetchPublicBranches.mockResolvedValue([CHOSEN_BRANCH, TARGET_BRANCH]);
        renderHomePage(["/menu"]);
        await waitForAuthReady();
        await waitForCartSeeded();

        fireEvent.click(screen.getByRole("button", { name: /change branch/i }));
        await waitFor(() => expect(screen.getByText("Choose your branch")).toBeTruthy());
        // By test id, not by name: "Chosen Branch" also appears in the chip behind the drawer
        // and in the drawer heading, so a text query matches three nodes.
        fireEvent.click(screen.getByTestId(`branch-option-${CHOSEN_BRANCH.id}`));

        // The details sheet fetches this branch's hours and menu to describe it — that is
        // informational and expected. The count is taken AFTER it, so what this asserts is the
        // thing that matters: confirming the branch you are already on reloads nothing.
        const confirm = await screen.findByRole("button", { name: /order here/i });
        const fetchCallsBefore = mockFetchBaseAppInfo.mock.calls.length;
        fireEvent.click(confirm);

        await waitFor(() => expect(screen.queryByText("Choose your branch")).toBeNull());
        expect(screen.queryByText(/Switch to/)).toBeNull();
        expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(fetchCallsBefore);
    });
});
