import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// i18n side-effect import so any translated copy resolves to English under the default language.
import "../shared/i18n";

// Factoryless jest.mock() -- resolves to src/shared/api/__mocks__/public.ts / socket.ts
jest.mock("../shared/api/public");
jest.mock("../shared/api/socket");

// lottie-web tries to obtain a real 2D canvas context at import time, which jsdom does not
// provide (no canvas backend installed) -- stub the whole package so OrderStatusPage's
// unconditional Lottie import does not crash the test environment.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

import { getOrderStatus } from "../shared/api/public";
import { connectSocket, socket } from "../shared/api/socket";
import { OrderStatusPage } from "./OrderStatusPage";
import type { OrderStatusData } from "../domains/order-status/types";

const mockGetOrderStatus = jest.mocked(getOrderStatus);
const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);

const ORDER: OrderStatusData = {
    id: 1,
    orderStatus: "Kitchen Phase",
    orderNumber: 42,
    orderCreated: "2026-01-01T12:00:00",
    estimationTime: 30,
    branchId: "branch-test",
};

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockGetOrderStatus.mockReset();
    mockGetOrderStatus.mockResolvedValue(ORDER);

    // useOrderStatus (owned by a different sub-task) opens a STOMP subscription once branchId
    // resolves -- stub it so its effect cleanup has a real unregister/unsubscribe to call.
    mockConnectSocket.mockReset();
    mockConnectSocket.mockImplementation((onConnect: () => void) => {
        onConnect();
        return jest.fn<void, []>();
    });
    mockSubscribe.mockReset();
    mockSubscribe.mockReturnValue({ id: "status-sub", unsubscribe: jest.fn() });
});

function renderOrderStatusPage(state?: unknown) {
    return render(
        <MemoryRouter
            initialEntries={[{ pathname: "/order_status", search: "?order_id=order-123", state }]}
        >
            <OrderStatusPage orderId="order-123" />
        </MemoryRouter>
    );
}

describe("OrderStatusPage", () => {
    it("renders the order number and kitchen-phase status", async () => {
        renderOrderStatusPage();

        await waitFor(() => {
            expect(screen.getByText(/Order #/)).toBeTruthy();
        });
        expect(screen.getByText("Your pizza is being prepared 🍕")).toBeTruthy();
    });

    // Regression guard: the post-order account proposal now lives on the menu page
    // (HomePageModals) and is shown BEFORE the redirect here -- so OrderStatusPage must never
    // render it, even if a stale router state carrying a phone happens to be present.
    it("does not render the account proposal, even with a phone in router state", async () => {
        renderOrderStatusPage({ newAccountPhone: "97333607710" });

        await waitFor(() => {
            expect(screen.getByText(/Order #/)).toBeTruthy();
        });
        expect(screen.queryByText("Save your details for next time")).toBeNull();
    });
});
