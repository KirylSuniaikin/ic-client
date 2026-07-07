import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// CustomerIconButton (and the popups it renders) use useTranslation — initialize the real
// i18n instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";

jest.mock("../../../shared/api/customerAuth");

import {
    verifyOtp,
    refreshCustomerToken,
    fetchCustomerMe,
    fetchMyOrders,
} from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerAuthUiProvider } from "../context/CustomerAuthUiProvider";
import { CustomerIconButton } from "./CustomerIconButton";
import { CustomerAuthModals } from "./CustomerAuthModals";

const mockVerifyOtp = jest.mocked(verifyOtp);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockFetchCustomerMe = jest.mocked(fetchCustomerMe);
const mockFetchMyOrders = jest.mocked(fetchMyOrders);

function renderIconButton() {
    return render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
                <CustomerIconButton />
                <CustomerAuthModals />
            </CustomerAuthUiProvider>
        </CustomerAuthProvider>
    );
}

async function waitForAuthReady(): Promise<void> {
    await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockVerifyOtp.mockReset();
    mockRefreshCustomerToken.mockReset();
    mockFetchCustomerMe.mockReset();
    mockFetchMyOrders.mockReset();
    __resetCustomerAuthStoreForTests();
});

describe("CustomerIconButton", () => {
    it("opens CustomerLoginPopup when logged out and clicked", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        renderIconButton();
        await waitForAuthReady();

        expect(screen.queryByLabelText("Phone number")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "log in" }));

        expect(await screen.findByLabelText("Phone number")).toBeTruthy();
    });

    it("does not open CustomerLoginPopup when already logged in", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "already-logged-in" });
        mockFetchCustomerMe.mockResolvedValue({
            id: "acct-1",
            phone: "97333607710",
            preferredBranchId: null,
            name: "Jane",
            address: null,
            amountOfOrders: null,
            lastOrderDate: null,
        });
        mockFetchMyOrders.mockResolvedValue({
            orders: [],
            page: 0,
            size: 3,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
        });
        renderIconButton();

        await screen.findByRole("button", { name: "customer account" });

        fireEvent.click(screen.getByRole("button", { name: "customer account" }));

        expect(screen.queryByLabelText("Phone number")).toBeNull();
        await waitFor(() => expect(mockFetchCustomerMe).toHaveBeenCalledWith("already-logged-in"));
    });

    it("opens CustomerProfilePopup when logged in and clicked", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "already-logged-in" });
        mockFetchCustomerMe.mockResolvedValue({
            id: "acct-1",
            phone: "97333607710",
            preferredBranchId: null,
            name: "Jane",
            address: null,
            amountOfOrders: null,
            lastOrderDate: null,
        });
        mockFetchMyOrders.mockResolvedValue({
            orders: [],
            page: 0,
            size: 3,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
        });
        renderIconButton();

        await screen.findByRole("button", { name: "customer account" });

        fireEvent.click(screen.getByRole("button", { name: "customer account" }));

        expect(await screen.findByText("My Account")).toBeTruthy();
        await waitFor(() => expect(mockFetchCustomerMe).toHaveBeenCalledWith("already-logged-in"));
        expect(mockFetchMyOrders).toHaveBeenCalledWith("already-logged-in", 0, 3);
        expect(await screen.findByText("Jane")).toBeTruthy();
    });

    it("shows the add-account (person-plus) icon when logged out", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        renderIconButton();
        await waitForAuthReady();

        await screen.findByRole("button", { name: "log in" });

        expect(screen.getByTestId("PersonAddAlt1RoundedIcon")).toBeTruthy();
    });

    it("does not show the add-account (person-plus) icon when logged in", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "already-logged-in" });
        mockFetchCustomerMe.mockResolvedValue({
            id: "acct-1",
            phone: "97333607710",
            preferredBranchId: null,
            name: "Jane",
            address: null,
            amountOfOrders: null,
            lastOrderDate: null,
        });
        mockFetchMyOrders.mockResolvedValue({
            orders: [],
            page: 0,
            size: 3,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
        });
        renderIconButton();

        await screen.findByRole("button", { name: "customer account" });

        expect(screen.queryByTestId("PersonAddAlt1RoundedIcon")).toBeNull();
    });
});
