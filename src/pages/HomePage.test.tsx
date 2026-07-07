// Assumed: admin mode hides CustomerIconButton (HeroSection is not rendered), so there is
// no real UI control to open the login/profile popup in that mode -- a small test-only
// trigger against the shared context is used instead, alongside one case that drives the
// real CustomerIconButton for the non-admin path (per the task spec's test plan).
import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// HomePage (via HeroSection/CustomerIconButton) uses useTranslation -- initialize the real
// i18n instance (side-effect import) so keys resolve to English, mirroring HeroSection.test.tsx.
import "../shared/i18n";

// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/{public,management,customerAuth}.ts
jest.mock("../shared/api/public");
jest.mock("../shared/api/management");
jest.mock("../shared/api/customerAuth");

// lottie-web tries to obtain a real 2D canvas context at import time, which jsdom does not
// provide (no canvas backend installed) -- stub the whole package so HomePage's PizzaLoader
// (rendered while menu.loading is true) does not crash the test environment. Mirrors
// OrderStatusPage.test.tsx's identical stub.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

import { fetchBaseAppInfo } from "../shared/api/public";
import { fetchAllBranches } from "../shared/api/management";
import { refreshCustomerToken } from "../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../domains/customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../domains/customer-auth/context/CustomerAuthUiProvider";
import HomePage from "./HomePage";
import type { BaseAppInfoResponse } from "../domains/order/types";

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockFetchAllBranches = jest.mocked(fetchAllBranches);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);

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
function AuthUiTestTrigger(): React.JSX.Element {
    const { openLogin, closeAll } = useCustomerAuthUi();
    return (
        <>
            <button onClick={() => openLogin()}>test-open-login</button>
            <button onClick={() => closeAll()}>test-close-all</button>
        </>
    );
}

function renderHomePage(initialEntries: string[], recommendedIds: string[] = ["1"]) {
    return render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
                <MemoryRouter initialEntries={initialEntries}>
                    <HomePage userParam={null} recommendedIds={recommendedIds} giftId={null} />
                </MemoryRouter>
                <AuthUiTestTrigger />
            </CustomerAuthUiProvider>
        </CustomerAuthProvider>
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
    mockFetchAllBranches.mockReset();
    mockFetchAllBranches.mockResolvedValue([]);
});

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
