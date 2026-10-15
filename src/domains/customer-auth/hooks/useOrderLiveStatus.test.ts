import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { StompSubscription, StompHeaders } from "@stomp/stompjs";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../shared/api/socket");

import { connectSocket, socket } from "../../../shared/api/socket";
import { useOrderLiveStatus } from "./useOrderLiveStatus";

const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);
const mockPublish = jest.mocked(socket.publish);

// Builds a minimal StompSubscription whose unsubscribe method can be spied on.
function makeSub(): StompSubscription {
    return {
        id: "live-status-sub",
        // jest.fn<void, [StompHeaders?]> satisfies (headers?: StompHeaders) => void
        unsubscribe: jest.fn<void, [StompHeaders?]>(),
    };
}

// Captures the frame handler passed to socket.subscribe so tests can simulate frames.
function getFrameHandler(): (frame: { body: string }) => void {
    const call = mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1] as
        [string, (frame: { body: string }) => void];
    return call[1];
}

describe("useOrderLiveStatus — subscription lifecycle", () => {
    let storedOnConnect: (() => void) | undefined;

    beforeEach(() => {
        storedOnConnect = undefined;
        // Simulate instant connection: invoke onConnect synchronously, return an unregister fn,
        // and remember the callback so a test can fire it again to simulate a reconnect.
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            storedOnConnect = onConnect;
            onConnect();
            return jest.fn<void, []>();
        });

        mockSubscribe.mockReturnValue(makeSub());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("does not subscribe when branchId is null", () => {
        renderHook(() => useOrderLiveStatus(null, 1));

        expect(mockConnectSocket).not.toHaveBeenCalled();
        expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it("subscribes to the order-status-updated topic once branchId is set", async () => {
        renderHook(() => useOrderLiveStatus("branch-1", 1));

        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const [topic] = mockSubscribe.mock.calls[0] as [string, ...unknown[]];
        expect(topic).toBe("/topic/branch-1/order-status-updated");
    });

    it("publishes an ACK for every frame on the topic, regardless of order match", async () => {
        renderHook(() => useOrderLiveStatus("branch-1", 999));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 1, status: "Kitchen Phase" }) });
        });

        expect(mockPublish).toHaveBeenCalledWith({
            destination: "/app/orders/ack",
            body: JSON.stringify({ orderId: 1 }),
        });
    });

    it("drops a frame that fails the typed parser — no ACK, no state change", async () => {
        const { result } = renderHook(() => useOrderLiveStatus("branch-1", 1));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: "not-a-number", status: "Oven" }) });
        });

        expect(mockPublish).not.toHaveBeenCalled();
        expect(result.current.liveStatus).toBeNull();
        expect(result.current.resyncTick).toBe(0);
    });

    it("a valid forward-status frame for the tracked order sets liveStatus and bumps resyncTick", async () => {
        const { result } = renderHook(() => useOrderLiveStatus("branch-1", 1));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 1, status: "Oven" }) });
        });

        expect(result.current.liveStatus).toBe("Oven");
        expect(result.current.resyncTick).toBe(1);
    });

    it("ignores a frame for a different order in the same branch (no state change, ACK still published)", async () => {
        const { result } = renderHook(() => useOrderLiveStatus("branch-1", 1));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 2, status: "Oven" }) });
        });

        expect(mockPublish).toHaveBeenCalled();
        expect(result.current.liveStatus).toBeNull();
        expect(result.current.resyncTick).toBe(0);
    });

    it("the STATUS_RANK guard drops a stale/lower-rank frame — no resyncTick bump", async () => {
        const { result } = renderHook(() => useOrderLiveStatus("branch-1", 1));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 1, status: "Ready" }) });
        });
        expect(result.current.liveStatus).toBe("Ready");
        expect(result.current.resyncTick).toBe(1);

        act(() => {
            handler({ body: JSON.stringify({ id: 1, status: "Oven" }) });
        });

        // Stale retry ignored — status/resyncTick unchanged from the "Ready" frame above.
        expect(result.current.liveStatus).toBe("Ready");
        expect(result.current.resyncTick).toBe(1);
    });

    it("a reconnect (second onConnect firing) bumps resyncTick without a frame", async () => {
        const { result } = renderHook(() => useOrderLiveStatus("branch-1", 1));
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        expect(result.current.resyncTick).toBe(0);

        act(() => {
            storedOnConnect?.();
        });

        expect(result.current.resyncTick).toBe(1);
    });

    it("resets liveStatus/resyncTick when orderId changes", async () => {
        const { result, rerender } = renderHook(
            ({ orderId }: { orderId: number }) => useOrderLiveStatus("branch-1", orderId),
            { initialProps: { orderId: 1 } }
        );
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));

        const handler = getFrameHandler();
        act(() => {
            handler({ body: JSON.stringify({ id: 1, status: "Oven" }) });
        });
        expect(result.current.liveStatus).toBe("Oven");

        rerender({ orderId: 2 });

        expect(result.current.liveStatus).toBeNull();
        expect(result.current.resyncTick).toBe(0);
    });

    it("unsubscribes the subscription handle on unmount — no leak", async () => {
        const mockSub = makeSub();
        mockSubscribe.mockReturnValue(mockSub);

        const { unmount } = renderHook(() => useOrderLiveStatus("branch-1", 1));
        await waitFor(() => expect(mockConnectSocket).toHaveBeenCalled());

        unmount();

        expect(mockSub.unsubscribe).toHaveBeenCalledTimes(1);
    });
});
