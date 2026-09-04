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

/**
 * Forward-only guard (DELIVERY_COVERAGE_MATRIX.md I14 / defect D-2). Status frames are
 * last-write-wins and the backend retries the same orderId across transitions, so a retried
 * "Ready" can land after "Out for delivery". Without a rank guard the page walks backwards — the
 * ride treatment disappears and the "will be ready in m:ss" countdown comes back — until the REST
 * re-read lands. That re-read is exactly what masks the defect, so every case below holds it open
 * (a promise that never settles) and observes the optimistic patch on its own.
 *
 * Same ladder and same rules as the two siblings that already rank statuses: `useOrderLiveStatus`
 * and `useAdminOrders`.
 */
describe("useOrderStatus — forward-only status guard", () => {
    beforeEach(() => {
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return jest.fn<void, []>();
        });
        mockSubscribe.mockReturnValue(makeSub());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    /** Holds the REST re-read open so only the frame's own effect on state is observable. */
    function freezeRefetch(): void {
        mockGetOrderStatus.mockReturnValue(new Promise<OrderStatusData>(() => undefined));
    }

    function frame(status: string): void {
        const [, onFrame] = mockSubscribe.mock.calls[0] as [string, (f: { body: string }) => void];
        onFrame({ body: JSON.stringify({ id: 1, status }) });
    }

    async function renderAt(orderStatus: string) {
        mockGetOrderStatus.mockResolvedValue({ ...ORDER, orderType: "Delivery", orderStatus });
        const { result } = renderHook(() => useOrderStatus("1"));
        await waitFor(() => expect(result.current.order?.orderStatus).toBe(orderStatus));
        freezeRefetch();
        return result;
    }

    it("ignores a retried Ready frame that lands after Out for delivery", async () => {
        const result = await renderAt("Out for delivery");

        await act(async () => { frame("Ready"); });

        expect(result.current.order?.orderStatus).toBe("Out for delivery");
    });

    it("still applies a frame that moves the order forward", async () => {
        const result = await renderAt("Ready");

        await act(async () => { frame("Out for delivery"); });

        expect(result.current.order?.orderStatus).toBe("Out for delivery");
    });

    /**
     * "Delivered" and "Returned Undelivered" are terminal siblings, not steps past one another.
     * Telling a customer whose food arrived that it came back is the worst of the two directions.
     */
    it("does not let a Returned Undelivered frame override Delivered", async () => {
        const result = await renderAt("Delivered");

        await act(async () => { frame("Returned Undelivered"); });

        expect(result.current.order?.orderStatus).toBe("Delivered");
    });

    /**
     * An unranked status has to stay visible: the guard exists to drop retries, not to swallow a
     * status the backend has newly started sending.
     */
    it("lets a status it has never heard of through", async () => {
        const result = await renderAt("Ready");

        await act(async () => { frame("Awaiting Courier"); });

        expect(result.current.order?.orderStatus).toBe("Awaiting Courier");
    });
});
