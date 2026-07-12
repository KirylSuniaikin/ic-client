import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// CustomerProfilePopup renders its copy via useTranslation — initialize the real i18n
// instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";

jest.mock("../../../shared/api/customerAuth");
// CustomerOrderDetailPopup (rendered by CustomerProfilePopup) now subscribes via
// useOrderLiveStatus — mock the socket module so no real STOMP connection is attempted.
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../shared/api/socket");

import {
    verifyOtp,
    refreshCustomerToken,
    logoutCustomer,
    fetchCustomerMe,
    fetchMyOrders,
    fetchOrderDetail,
} from "../../../shared/api/customerAuth";
import { connectSocket, socket } from "../../../shared/api/socket";
import { CustomerAuthProvider, useCustomerAuth, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerAuthUiProvider } from "../context/CustomerAuthUiProvider";
import { CustomerProfilePopup } from "./CustomerProfilePopup";
import type { CustomerMeResponse, CustomerOrdersPageResponse, CustomerOrderDetail } from "../types";

const mockVerifyOtp = jest.mocked(verifyOtp);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockLogoutCustomer = jest.mocked(logoutCustomer);
const mockFetchCustomerMe = jest.mocked(fetchCustomerMe);
const mockFetchMyOrders = jest.mocked(fetchMyOrders);
const mockFetchOrderDetail = jest.mocked(fetchOrderDetail);
const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);

const profile: CustomerMeResponse = {
    id: "acct-1",
    phone: "97333607710",
    preferredBranchId: null,
    name: "Jane",
    address: null,
    amountOfOrders: 5,
    lastOrderDate: null,
};

function orderDetail(overrides: Partial<CustomerOrderDetail> = {}): CustomerOrderDetail {
    return {
        id: 1234,
        orderNumber: 88,
        status: "Picked Up",
        orderType: "Pick Up",
        branchId: "branch-1",
        createdAt: "2026-06-20 18:42",
        paymentType: "Cash",
        notes: null,
        amount: 12.5,
        discount: 0,
        amountPaid: 12.5,
        isPaid: true,
        items: [],
        statusHistory: [],
        ...overrides,
    };
}

function ordersPage(overrides: Partial<CustomerOrdersPageResponse> = {}): CustomerOrdersPageResponse {
    return {
        orders: [
            {
                id: 1234,
                orderNumber: 88,
                status: "Picked Up",
                orderType: "Pick Up",
                amountPaid: 12.5,
                createdAt: "2026-06-20 18:42",
            },
        ],
        page: 0,
        size: 3,
        totalElements: 7,
        totalPages: 3,
        hasNext: true,
        ...overrides,
    };
}

// Mirrors real usage (CustomerIconButton): the popup only ever flips to
// `open` once the customer is already logged in — the "open-profile" trigger
// only renders once the provider's silent-refresh-on-mount has resolved, so
// tests never open the popup with a stale/null token like production never does.
function ProfilePopupHarness({ onClose }: { onClose: () => void }): React.JSX.Element {
    const { isAuthLoading } = useCustomerAuth();
    const [open, setOpen] = useState(false);
    return (
        <>
            {!isAuthLoading && (
                <button onClick={() => setOpen(true)}>open-profile</button>
            )}
            <CustomerProfilePopup
                open={open}
                onClose={() => {
                    setOpen(false);
                    onClose();
                }}
            />
        </>
    );
}

async function renderOpenPopup(): Promise<{ onClose: () => void }> {
    const onClose = jest.fn<void, []>();
    render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
                <ProfilePopupHarness onClose={onClose} />
            </CustomerAuthUiProvider>
        </CustomerAuthProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "open-profile" }));
    return { onClose };
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockVerifyOtp.mockReset();
    mockRefreshCustomerToken.mockReset();
    mockLogoutCustomer.mockReset();
    mockFetchCustomerMe.mockReset();
    mockFetchMyOrders.mockReset();
    mockFetchOrderDetail.mockReset();
    __resetCustomerAuthStoreForTests();

    // Simulate instant connection: invoke onConnect synchronously, return an unregister fn —
    // mirrors useOrderStatus.test.ts's harness style.
    mockConnectSocket.mockReset();
    mockConnectSocket.mockImplementation((onConnect: () => void) => {
        onConnect();
        return jest.fn<void, []>();
    });
    mockSubscribe.mockReset();
    mockSubscribe.mockReturnValue({ id: "detail-sub", unsubscribe: jest.fn() });
});

describe("CustomerProfilePopup", () => {
    it("shows name and phone from GET /customer/me and order cards from GET /customer/orders", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(profile);
        mockFetchMyOrders.mockResolvedValueOnce(ordersPage());

        await renderOpenPopup();

        expect(await screen.findByText("Jane")).toBeTruthy();
        expect(screen.getByText("97333607710")).toBeTruthy();
        expect(await screen.findByText("Order #88")).toBeTruthy();
        expect(screen.getByText("12.50 BHD")).toBeTruthy();
        expect(screen.getByText("2026-06-20 18:42")).toBeTruthy();
        expect(screen.getByText("Picked Up")).toBeTruthy();

        expect(mockFetchCustomerMe).toHaveBeenCalledWith("profile-token");
        expect(mockFetchMyOrders).toHaveBeenCalledWith("profile-token", 0, 3);
    });

    it("resets to page 0 on every open", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue(profile);
        mockFetchMyOrders.mockResolvedValue(ordersPage());

        await renderOpenPopup();

        await waitFor(() => expect(mockFetchMyOrders).toHaveBeenCalledWith("profile-token", 0, 3));
    });

    it("Next fetches the next page and is disabled when hasNext is false", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue(profile);
        mockFetchMyOrders
            .mockResolvedValueOnce(ordersPage({ page: 0, hasNext: true }))
            .mockResolvedValueOnce(ordersPage({ page: 1, hasNext: false }));

        await renderOpenPopup();
        await screen.findByText("Jane");

        const nextButton = screen.getByRole("button", { name: "Next" });
        expect(nextButton.hasAttribute("disabled")).toBe(false);
        fireEvent.click(nextButton);

        await waitFor(() => expect(mockFetchMyOrders).toHaveBeenCalledWith("profile-token", 1, 3));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true)
        );
    });

    it("Prev is disabled at page 0 and fetches the previous page after Next", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue(profile);
        mockFetchMyOrders
            .mockResolvedValueOnce(ordersPage({ page: 0, hasNext: true }))
            .mockResolvedValueOnce(ordersPage({ page: 1, hasNext: false }))
            .mockResolvedValueOnce(ordersPage({ page: 0, hasNext: true }));

        await renderOpenPopup();
        await screen.findByText("Jane");

        const prevButton = screen.getByRole("button", { name: "Prev" });
        expect(prevButton.hasAttribute("disabled")).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        await waitFor(() => expect(mockFetchMyOrders).toHaveBeenCalledWith("profile-token", 1, 3));

        fireEvent.click(screen.getByRole("button", { name: "Prev" }));
        await waitFor(() => expect(mockFetchMyOrders).toHaveBeenCalledWith("profile-token", 0, 3));
    });

    it("Logout calls logout() and closes the popup", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValue(profile);
        mockFetchMyOrders.mockResolvedValue(ordersPage());
        mockLogoutCustomer.mockResolvedValueOnce(undefined);

        const { onClose } = await renderOpenPopup();
        await screen.findByText("Jane");

        fireEvent.click(screen.getByRole("button", { name: "Logout" }));

        await waitFor(() => expect(mockLogoutCustomer).toHaveBeenCalled());
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("on a 401 from /customer/me, logs out and shows a session-expired message instead of crashing", async () => {
        const { CustomerAuthApiError } = await import("../types");
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockRejectedValueOnce(new CustomerAuthApiError("expired", 401));
        mockFetchMyOrders.mockResolvedValueOnce(ordersPage());
        mockLogoutCustomer.mockResolvedValueOnce(undefined);

        await renderOpenPopup();

        expect(await screen.findByText("Your session has expired. Please log in again.")).toBeTruthy();
        expect(mockLogoutCustomer).toHaveBeenCalled();
    });

    it("on a 401 from /customer/orders, logs out and shows a session-expired message instead of crashing", async () => {
        const { CustomerAuthApiError } = await import("../types");
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(profile);
        mockFetchMyOrders.mockRejectedValueOnce(new CustomerAuthApiError("expired", 401));
        mockLogoutCustomer.mockResolvedValueOnce(undefined);

        await renderOpenPopup();

        expect(await screen.findByText("Your session has expired. Please log in again.")).toBeTruthy();
        expect(mockLogoutCustomer).toHaveBeenCalled();
    });

    it("tapping an order card opens CustomerOrderDetailPopup for that orderId, and closing it returns to the profile list without closing the profile popup", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "profile-token", isNewAccount: false });
        mockFetchCustomerMe.mockResolvedValueOnce(profile);
        mockFetchMyOrders.mockResolvedValueOnce(ordersPage());
        mockFetchOrderDetail.mockResolvedValueOnce(orderDetail());

        const { onClose } = await renderOpenPopup();

        fireEvent.click(await screen.findByText("Order #88"));

        await waitFor(() => expect(mockFetchOrderDetail).toHaveBeenCalledWith("profile-token", 1234));
        expect(await screen.findByText("Detail Order")).toBeTruthy();

        // Profile popup content stays mounted underneath the detail popup.
        expect(screen.getByText("Order history")).toBeTruthy();

        // Both popups' close controls share the "Close" i18n label — the detail
        // popup's is the one rendered last (it's mounted as the later sibling).
        const closeButtons = screen.getAllByLabelText("Close");
        fireEvent.click(closeButtons[closeButtons.length - 1]);

        await waitFor(() => expect(screen.queryByText("Detail Order")).toBeNull());
        expect(screen.getByText("Order history")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });
});
