import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { StompSubscription, StompHeaders } from "@stomp/stompjs";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../shared/api/socket");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../shared/api/public");

import { connectSocket, socket } from "../../../shared/api/socket";
import { getOrderStatus } from "../../../shared/api/public";
import { useOrderStatus } from "./useOrderStatus";
import type { OrderStatusData } from "../types";

const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);
const mockGetOrderStatus = jest.mocked(getOrderStatus);

// Minimal order payload that passes the hook's status-fetch guard
const ORDER: OrderStatusData = {
    id: 1,
    orderStatus: "PENDING",
    orderNumber: 42,
    orderCreated: "2026-01-01T12:00:00",
    estimationTime: 30,
    branchId: "branch-test",
    orderType: "Pick Up",
};

// Builds a minimal StompSubscription whose unsubscribe method can be spied on.
function makeSub(): StompSubscription {
    return {
        id: "status-sub",
        // jest.fn<void, [StompHeaders?]> satisfies (headers?: StompHeaders) => void
        unsubscribe: jest.fn<void, [StompHeaders?]>(),
    };
}

describe("useOrderStatus — subscription lifecycle", () => {
    beforeEach(() => {
        // Simulate instant connection: invoke onConnect synchronously, return an unregister fn
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return jest.fn<void, []>();
        });

        mockSubscribe.mockReturnValue(makeSub());

        // Return a valid order so the hook sets branchId and triggers the socket effect
        mockGetOrderStatus.mockResolvedValue(ORDER);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("calls connectSocket after the order status is fetched", async () => {
        renderHook(() => useOrderStatus("1"));

        await waitFor(() => {
            expect(mockConnectSocket).toHaveBeenCalledTimes(1);
        });
    });

    it("subscribes to the order-status-updated topic for the order's branch", async () => {
        renderHook(() => useOrderStatus("1"));

        await waitFor(() => {
            expect(mockSubscribe).toHaveBeenCalledTimes(1);
        });

        const [topic] = mockSubscribe.mock.calls[0] as [string, ...unknown[]];
        expect(topic).toContain("branch-test");
        expect(topic).toContain("order-status-updated");
    });

    it("unsubscribes the subscription handle on unmount — no leak", async () => {
        const mockSub = makeSub();
        mockSubscribe.mockReturnValue(mockSub);

        const { unmount } = renderHook(() => useOrderStatus("1"));

        // Wait for the branchId effect to run and register the subscription
        await waitFor(() => {
            expect(mockConnectSocket).toHaveBeenCalled();
        });

        unmount();

        expect(mockSub.unsubscribe).toHaveBeenCalledTimes(1);
    });
});


/**
 * A status frame carries only the status string. The delivery timings arrive with the REST
 * payload, and "Out for delivery" is the first moment handoverAt exists at all — so applying the
 * frame without re-reading REST would leave the ride's arrival time permanently unknown.
 */
describe("useOrderStatus — resync after a status frame", () => {
    beforeEach(() => {
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return jest.fn<void, []>();
        });
        mockSubscribe.mockReturnValue(makeSub());
        mockGetOrderStatus.mockResolvedValue(ORDER);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("re-reads the order so a delivery status change picks up its new timings", async () => {
        const riding: OrderStatusData = {
            ...ORDER,
            orderType: "Delivery",
            orderStatus: "Out for delivery",
            handoverAt: "2026-07-01T12:25:00",
            estimatedDeliveredAt: "2026-07-01T12:47:00",
        };
        const { result } = renderHook(() => useOrderStatus("1"));
        await waitFor(() => expect(result.current.order).not.toBeNull());

        mockGetOrderStatus.mockResolvedValue(riding);
        const [, onFrame] = mockSubscribe.mock.calls[0] as [string, (f: { body: string }) => void];
        await act(async () => {
            onFrame({ body: JSON.stringify({ id: 1, status: "Out for delivery" }) });
        });

        await waitFor(() => expect(result.current.order?.estimatedDeliveredAt).toBe("2026-07-01T12:47:00"));
        expect(result.current.order?.orderStatus).toBe("Out for delivery");
    });

    it("ignores a frame for a different order", async () => {
        const { result } = renderHook(() => useOrderStatus("1"));
        await waitFor(() => expect(result.current.order).not.toBeNull());
        mockGetOrderStatus.mockClear();

        const [, onFrame] = mockSubscribe.mock.calls[0] as [string, (f: { body: string }) => void];
        await act(async () => {
            onFrame({ body: JSON.stringify({ id: 999, status: "Ready" }) });
        });

        expect(result.current.order?.orderStatus).toBe("PENDING");
        expect(mockGetOrderStatus).not.toHaveBeenCalled();
    });
});
