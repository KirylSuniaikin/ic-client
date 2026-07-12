import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React, { useState } from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

// CustomerOrderDetailPopup renders its copy via useTranslation — initialize the real
// i18n instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";

jest.mock("../../../shared/api/customerAuth");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../shared/api/socket");

import { refreshCustomerToken, logoutCustomer, fetchOrderDetail } from "../../../shared/api/customerAuth";
import { connectSocket, socket } from "../../../shared/api/socket";
import { CustomerAuthProvider, useCustomerAuth, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerOrderDetailPopup } from "./CustomerOrderDetailPopup";
import type { CustomerOrderDetail } from "../types";

const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockLogoutCustomer = jest.mocked(logoutCustomer);
const mockFetchOrderDetail = jest.mocked(fetchOrderDetail);
const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);

// Captures the frame handler passed to socket.subscribe so a test can simulate a live frame.
function getFrameHandler(): (frame: { body: string }) => void {
    const call = mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1] as
        [string, (frame: { body: string }) => void];
    return call[1];
}

function detail(overrides: Partial<CustomerOrderDetail> = {}): CustomerOrderDetail {
    return {
        id: 1234,
        orderNumber: 88,
        status: "Picked Up",
        orderType: "Pick Up",
        branchId: "branch-1",
        createdAt: "2026-06-20 18:42",
        paymentType: "Cash",
        notes: "Extra napkins please",
        amount: 15.0,
        discount: 1.5,
        amountPaid: 13.5,
        isPaid: true,
        items: [
            {
                name: "Pepperoni",
                quantity: 2,
                size: "M",
                unitAmount: 6.5,
                description: "",
                comboItems: [],
            },
        ],
        statusHistory: [
            { status: "Kitchen Phase", changedAt: "2026-06-20 18:10" },
            { status: "Oven", changedAt: "2026-06-20 18:20" },
            { status: "Ready", changedAt: "2026-06-20 18:35" },
            { status: "Picked Up", changedAt: "2026-06-20 18:42" },
        ],
        ...overrides,
    };
}

// Mirrors CustomerProfilePopup.test.tsx: the popup only ever flips to `open`
// once the provider's silent-refresh-on-mount has resolved, so tests never
// open it with a stale/null token like production never does.
function DetailPopupHarness({
    orderId,
    onClose,
}: {
    orderId: number | null;
    onClose: () => void;
}): React.JSX.Element {
    const { isAuthLoading } = useCustomerAuth();
    const [open, setOpen] = useState(false);
    return (
        <>
            {!isAuthLoading && <button onClick={() => setOpen(true)}>open-detail</button>}
            <CustomerOrderDetailPopup
                open={open}
                orderId={orderId}
                onClose={() => {
                    setOpen(false);
                    onClose();
                }}
            />
        </>
    );
}

async function renderPopup(orderId: number | null = 1234): Promise<{ onClose: () => void }> {
    const onClose = jest.fn<void, []>();
    render(
        <CustomerAuthProvider>
            <DetailPopupHarness orderId={orderId} onClose={onClose} />
        </CustomerAuthProvider>
    );
    fireEvent.click(await screen.findByRole("button", { name: "open-detail" }));
    return { onClose };
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockRefreshCustomerToken.mockReset();
    mockLogoutCustomer.mockReset();
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

describe("CustomerOrderDetailPopup", () => {
    it("renders items, totals, notes, and the status timeline from a mocked fetchOrderDetail response", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        expect(await screen.findByText("Order ID #88")).toBeTruthy();
        expect(screen.getByText("Pepperoni")).toBeTruthy();
        expect(screen.getByText("6.50 BHD")).toBeTruthy();
        expect(screen.getByText("Qty : 2 Item")).toBeTruthy();
        expect(screen.getByText("15.00 BHD")).toBeTruthy();
        expect(screen.getByText("-1.50 BHD")).toBeTruthy();
        expect(screen.getByText("Payment Method: Cash")).toBeTruthy();
        expect(screen.getByText("Paid")).toBeTruthy();
        expect(screen.getByText("Extra napkins please")).toBeTruthy();

        // "Picked Up" appears twice: the status pill (detail.status) and the
        // timeline's friendly label for the last statusHistory entry.
        expect(screen.getAllByText("Picked Up").length).toBe(2);
        expect(screen.getByText("Order in Progress")).toBeTruthy();
        expect(screen.getByText("In the Oven")).toBeTruthy();
        expect(screen.getByText("Ready for Pickup")).toBeTruthy();
        expect(screen.getByText("6:42 PM")).toBeTruthy();

        expect(mockFetchOrderDetail).toHaveBeenCalledWith("detail-token", 1234);
    });

    it("hides the Notes card when notes is empty/null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ notes: null }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.queryByText("Notes")).toBeNull();
    });

    it("hides the Notes card when notes is blank after trim", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ notes: "   " }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.queryByText("Notes")).toBeNull();
    });

    it("shows Unpaid (not Paid) when the order's isPaid flag is false", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ isPaid: false }));

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.getByText("Unpaid")).toBeTruthy();
        expect(screen.queryByText("Paid")).toBeNull();
    });

    it("falls back to the raw status string for an unmapped status", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({ statusHistory: [{ status: "Some Unknown Status", changedAt: "2026-06-20 18:10" }] })
        );

        await renderPopup();

        await screen.findByText("Order ID #88");
        expect(screen.getByText("Some Unknown Status")).toBeTruthy();
    });

    it("on a 401 from fetchOrderDetail, logs out and shows a session-expired message instead of crashing", async () => {
        const { CustomerAuthApiError } = await import("../types");
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockRejectedValueOnce(new CustomerAuthApiError("expired", 401));
        mockLogoutCustomer.mockResolvedValueOnce(undefined);

        await renderPopup();

        expect(await screen.findByText("Your session has expired. Please log in again.")).toBeTruthy();
        expect(mockLogoutCustomer).toHaveBeenCalled();
    });

    it("shows an inline error message on a non-401 error and keeps the popup usable", async () => {
        const { CustomerAuthApiError } = await import("../types");
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockRejectedValueOnce(new CustomerAuthApiError("boom", 500));

        await renderPopup();

        expect(await screen.findByText("Could not load order details. Please try again.")).toBeTruthy();
        expect(mockLogoutCustomer).not.toHaveBeenCalled();
    });

    it("does not fetch when orderId is null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });

        await renderPopup(null);

        await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
        expect(mockFetchOrderDetail).not.toHaveBeenCalled();
    });

    it("shows a brand-red loading spinner while fetchOrderDetail is pending", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        // Never-resolving promise: only the pending/loading state is under test here.
        mockFetchOrderDetail.mockImplementationOnce(() => new Promise<CustomerOrderDetail>(() => undefined));

        await renderPopup();

        expect(await screen.findByRole("progressbar")).toBeTruthy();
    });

    it("calls onClose when the close icon is clicked", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        await screen.findByText("Order ID #88");
        fireEvent.click(screen.getByLabelText("Close"));

        await waitFor(() => expect(screen.queryByText("Order ID #88")).toBeNull());
    });

    it("shows the date parsed from createdAt alongside the time in the sub-row", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        expect(await screen.findByText("2026-06-20 - 6:42 PM")).toBeTruthy();
    });

    it("renders without crashing and shows zero totals when the order has no items and no status history", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({ items: [], statusHistory: [], amount: 0, discount: 0 })
        );

        await renderPopup();

        expect(await screen.findByText("Order ID #88")).toBeTruthy();
        expect(screen.getByText("0.00 BHD")).toBeTruthy();
        expect(screen.getByText("-0.00 BHD")).toBeTruthy();
        expect(screen.getByText("Timeline Order")).toBeTruthy();
    });

    it("renders an item row without a literal 'null' size label when item.size is null", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Margherita",
                        quantity: 1,
                        size: null,
                        unitAmount: 5,
                        description: "",
                        comboItems: [],
                    },
                ],
            })
        );

        await renderPopup();

        const itemImage = await screen.findByAltText("Margherita");
        expect(itemImage).toBeTruthy();
        expect(screen.queryByText("null", { exact: false })).toBeNull();
    });

    it("renders combo item name/size and description-derived extras when comboItems is non-empty", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Pepperoni Pizza",
                                size: "M",
                                quantity: 1,
                                description: "Extra cheese + (No onions)",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Family Combo");
        expect(screen.getByText("Pepperoni Pizza (M)")).toBeTruthy();
        expect(screen.getByText("+ Extra cheese", { exact: false })).toBeTruthy();
        expect(screen.getByText("+ No onions", { exact: false })).toBeTruthy();
    });

    it("renders no combo markup when comboItems is empty", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail());

        await renderPopup();

        await screen.findByText("Pepperoni");
        expect(screen.queryByText("+ Extra cheese", { exact: false })).toBeNull();
    });

    it("renders a combo item's name/size with no red extras block when its description is empty", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Margherita Pizza",
                                size: "S",
                                quantity: 1,
                                description: "",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Margherita Pizza (S)");
        expect(screen.queryByText("+", { exact: false })).toBeNull();
    });

    it("renders each combo item's name/size and extras when an item has multiple comboItems", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Pepperoni Pizza",
                                size: "M",
                                quantity: 1,
                                description: "Extra cheese",
                            },
                            {
                                name: "Garlic Bread",
                                size: null,
                                quantity: 2,
                                description: "(No garlic)",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Pepperoni Pizza (M)");
        expect(screen.getByText("Garlic Bread")).toBeTruthy();
        expect(screen.getByText("+ Extra cheese", { exact: false })).toBeTruthy();
        expect(screen.getByText("+ No garlic", { exact: false })).toBeTruthy();
    });

    it("does not render a combo sub-item's quantity anywhere in its row", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(
            detail({
                items: [
                    {
                        name: "Family Combo",
                        quantity: 1,
                        size: "L",
                        unitAmount: 12,
                        description: "",
                        comboItems: [
                            {
                                name: "Pepperoni Pizza",
                                size: "M",
                                quantity: 3,
                                description: "Extra cheese",
                            },
                        ],
                    },
                ],
            })
        );

        await renderPopup();

        await screen.findByText("Pepperoni Pizza (M)");
        // "Qty : 1 Item" is the parent Family Combo item's own quantity row —
        // the combo sub-item's quantity (3) must not surface as its own text node
        // (an exact match avoids false positives from unrelated substrings like "6:35 PM").
        expect(screen.getByText("Qty : 1 Item")).toBeTruthy();
        expect(screen.queryByText("3")).toBeNull();
    });

    it("subscribes to the order's branch topic and refetches detail on a forward-status live frame", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ status: "Kitchen Phase" }));
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ status: "Oven" }));

        await renderPopup();
        await screen.findByText("Order ID #88");

        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
        const [topic] = mockSubscribe.mock.calls[0] as [string, ...unknown[]];
        expect(topic).toBe("/topic/branch-1/order-status-updated");

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 1234, status: "Oven" }) });
        });

        await waitFor(() => expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2));
    });

    it("ignores a stale/lower-rank live frame — no second fetchOrderDetail call", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "detail-token", isNewAccount: false });
        mockFetchOrderDetail.mockResolvedValueOnce(detail({ status: "Ready" }));

        await renderPopup();
        await screen.findByText("Order ID #88");

        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
        const handler = getFrameHandler();

        // Advance to a higher rank first, then simulate a stale retry of a lower rank.
        act(() => {
            handler({ body: JSON.stringify({ id: 1234, status: "Ready" }) });
        });
        await waitFor(() => expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2));

        act(() => {
            handler({ body: JSON.stringify({ id: 1234, status: "Kitchen Phase" }) });
        });

        // Give any (unwanted) async refetch a chance to happen, then assert it didn't.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mockFetchOrderDetail).toHaveBeenCalledTimes(2);
    });
});
