import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import type { RenderHookResult } from "@testing-library/react";
import type { StompSubscription, StompHeaders, IMessage } from "@stomp/stompjs";
import type { Order } from "../../../order/types";
import type { UseAdminOrdersResult } from "./useAdminOrders";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../../shared/api/socket");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");
// Factoryless jest.mock() — resolves to src/services/__mocks__/BluetoothPrinterService.ts
jest.mock("../../../../services/BluetoothPrinterService");

import { connectSocket, socket } from "../../../../shared/api/socket";
import { getBaseAdminInfo, getAllActiveOrders } from "../../../../shared/api/public";
import { useAdminOrders } from "./useAdminOrders";

const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);
const mockGetBaseAdminInfo = jest.mocked(getBaseAdminInfo);
const mockGetAllActiveOrders = jest.mocked(getAllActiveOrders);

// Builds a minimal StompSubscription whose unsubscribe method can be spied on.
function makeSub(id: string): StompSubscription {
    return {
        id,
        // jest.fn<void, [StompHeaders?]> satisfies (headers?: StompHeaders) => void
        unsubscribe: jest.fn<void, [StompHeaders?]>(),
    };
}

describe("useAdminOrders — subscription lifecycle", () => {
    const stopSound = jest.fn<void, []>();
    let capturedSubs: StompSubscription[];

    beforeEach(() => {
        capturedSubs = [];

        // Simulate instant connection: call onConnect synchronously, return an unregister fn
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return jest.fn<void, []>();
        });

        mockSubscribe.mockImplementation(() => {
            const sub = makeSub(`sub-${capturedSubs.length}`);
            capturedSubs.push(sub);
            return sub;
        });

        // Return undefined so the .then(response => { if (!response) return }) branch exits early
        mockGetBaseAdminInfo.mockResolvedValue(undefined);
        mockGetAllActiveOrders.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
        capturedSubs = [];
    });

    it("registers exactly 9 STOMP subscriptions when branchId is provided", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        expect(capturedSubs).toHaveLength(9);
    });

    it("unsubscribes all 9 subscription handles on unmount — no leak", async () => {
        let unmount!: () => void;

        await act(async () => {
            ({ unmount } = renderHook(() => useAdminOrders("branch-1", stopSound)));
        });

        unmount();

        capturedSubs.forEach(sub => {
            expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
        });
    });

    it("makes no subscriptions when branchId is null", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders(null, stopSound));
        });

        expect(capturedSubs).toHaveLength(0);
    });

    it("does not call connectSocket when branchId is null", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders(null, stopSound));
        });

        expect(mockConnectSocket).not.toHaveBeenCalled();
    });
});

describe("useAdminOrders — enabled flag", () => {
    const stopSound = jest.fn<void, []>();
    let capturedSubs: StompSubscription[];

    beforeEach(() => {
        capturedSubs = [];

        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return jest.fn<void, []>();
        });

        mockSubscribe.mockImplementation(() => {
            const sub = makeSub(`sub-${capturedSubs.length}`);
            capturedSubs.push(sub);
            return sub;
        });

        mockGetBaseAdminInfo.mockResolvedValue(undefined);
        mockGetAllActiveOrders.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
        capturedSubs = [];
    });

    it("registers 0 STOMP subscriptions when enabled is false", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound, false));
        });

        expect(capturedSubs).toHaveLength(0);
        expect(mockConnectSocket).not.toHaveBeenCalled();
        expect(mockGetAllActiveOrders).not.toHaveBeenCalled();
        expect(mockGetBaseAdminInfo).not.toHaveBeenCalled();
    });

    it("loading is false immediately when enabled is false", async () => {
        let view!: RenderHookResult<UseAdminOrdersResult, unknown>;
        await act(async () => {
            view = renderHook(() => useAdminOrders("branch-1", stopSound, false));
        });

        expect(view.result.current.loading).toBe(false);
    });

    it("still registers 9 STOMP subscriptions and starts loading when enabled defaults to true", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        expect(capturedSubs).toHaveLength(9);
    });
});

describe("useAdminOrders — resync on reconnect", () => {
    const stopSound = jest.fn<void, []>();

    beforeEach(() => {
        mockSubscribe.mockImplementation(() => makeSub("s"));
        mockGetBaseAdminInfo.mockResolvedValue(undefined);
        mockGetAllActiveOrders.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("does not re-fetch the order list on the first connect", async () => {
        // onConnect fires once (first connect) — the initial [branchId] effect already loaded
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return jest.fn<void, []>();
        });

        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        expect(mockGetAllActiveOrders).toHaveBeenCalledTimes(1);
    });

    it("re-fetches the full order list on a reconnect", async () => {
        let onConnect!: () => void;
        mockConnectSocket.mockImplementation((cb: () => void) => {
            onConnect = cb;
            cb(); // first connect — skips resync
            return jest.fn<void, []>();
        });

        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        await act(async () => {
            onConnect(); // simulate a reconnect — should re-hydrate the board
        });

        expect(mockGetAllActiveOrders).toHaveBeenCalledTimes(2);
    });
});

describe("useAdminOrders — forward-only status guard", () => {
    const stopSound = jest.fn<void, []>();
    const STATUS_TOPIC = "/topic/branch-1/order-status-updated";
    let handlers: Record<string, (msg: IMessage) => void>;

    // Minimal Order shape; only id/status are read by the status handler. Cast through
    // unknown — building a full Order is unnecessary for these transition assertions.
    const orderWith = (id: number, status: string): Order =>
        ({ id, status } as unknown as Order);

    const sendStatus = (id: number, status: string): void => {
        // Only .body is read by the handler; cast the partial frame to IMessage.
        handlers[STATUS_TOPIC]({ body: JSON.stringify({ orderId: id, status }) } as unknown as IMessage);
    };

    beforeEach(() => {
        handlers = {};
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return jest.fn<void, []>();
        });
        mockSubscribe.mockImplementation((destination: string, cb: (msg: IMessage) => void) => {
            handlers[destination] = cb;
            return makeSub(destination);
        });
        mockGetBaseAdminInfo.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("ignores a stale 'Oven' frame that arrives after 'Ready'", async () => {
        mockGetAllActiveOrders.mockResolvedValue([orderWith(7, "Ready")]);
        let view!: RenderHookResult<UseAdminOrdersResult, unknown>;
        await act(async () => {
            view = renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendStatus(7, "Oven"));

        expect(view.result.current.orders[0].status).toBe("Ready");
    });

    it("applies a forward 'Ready' frame over 'Oven'", async () => {
        mockGetAllActiveOrders.mockResolvedValue([orderWith(7, "Oven")]);
        let view!: RenderHookResult<UseAdminOrdersResult, unknown>;
        await act(async () => {
            view = renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendStatus(7, "Ready"));

        expect(view.result.current.orders[0].status).toBe("Ready");
    });
});
