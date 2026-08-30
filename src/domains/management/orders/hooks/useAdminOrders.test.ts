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
import BluetoothPrinterService from "../../../../services/BluetoothPrinterService";

const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);
const mockGetBaseAdminInfo = jest.mocked(getBaseAdminInfo);
const mockGetAllActiveOrders = jest.mocked(getAllActiveOrders);
const mockPrintOrder = jest.mocked(BluetoothPrinterService.printOrder);

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

    it("registers exactly 10 STOMP subscriptions when branchId is provided", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        expect(capturedSubs).toHaveLength(10);
    });

    it("unsubscribes all 10 subscription handles on unmount — no leak", async () => {
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

    it("still registers 10 STOMP subscriptions and starts loading when enabled defaults to true", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        expect(capturedSubs).toHaveLength(10);
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

    async function boardWith(status: string): Promise<RenderHookResult<UseAdminOrdersResult, unknown>> {
        mockGetAllActiveOrders.mockResolvedValue([orderWith(7, status)]);
        let view!: RenderHookResult<UseAdminOrdersResult, unknown>;
        await act(async () => {
            view = renderHook(() => useAdminOrders("branch-1", stopSound));
        });
        return view;
    }

    /**
     * The delivery ladder EXTENDS the pickup one instead of branching away from it — a courier
     * collects the food ("Picked Up", CourierDeliveryService.markPickedUp) and the order only
     * THEN goes "Out for delivery". The two used to share rank 3 here, on the claim that they
     * were mutually-exclusive branches out of "Ready".
     */
    it("treats 'Out for delivery' as forward progress from 'Ready'", async () => {
        const view = await boardWith("Ready");

        act(() => sendStatus(7, "Out for delivery"));

        expect(view.result.current.orders[0].status).toBe("Out for delivery");
    });

    it("ignores a stale 'Ready' frame that arrives after 'Out for delivery'", async () => {
        const view = await boardWith("Out for delivery");

        act(() => sendStatus(7, "Ready"));

        expect(view.result.current.orders[0].status).toBe("Out for delivery");
    });

    it("applies 'Delivered' over 'Out for delivery'", async () => {
        const view = await boardWith("Out for delivery");

        act(() => sendStatus(7, "Delivered"));

        expect(view.result.current.orders[0].status).toBe("Delivered");
    });

    /**
     * "Delivered" and "Returned Undelivered" are terminal SIBLINGS: different endings, neither
     * further along than the other. "Returned Undelivered" was unranked, so a late "Delivered"
     * frame overwrote a card that had already come back to the branch.
     */
    it("does not let a late 'Delivered' frame overwrite 'Returned Undelivered'", async () => {
        const view = await boardWith("Returned Undelivered");

        act(() => sendStatus(7, "Delivered"));

        expect(view.result.current.orders[0].status).toBe("Returned Undelivered");
    });

    it("does not let a late 'Returned Undelivered' frame overwrite 'Delivered'", async () => {
        const view = await boardWith("Delivered");

        act(() => sendStatus(7, "Returned Undelivered"));

        expect(view.result.current.orders[0].status).toBe("Delivered");
    });

    /** Unknown statuses fall through and are applied — the guard ranks, it does not whitelist. */
    it("applies an unranked status such as 'Cancelled'", async () => {
        const view = await boardWith("Ready");

        act(() => sendStatus(7, "Cancelled"));

        expect(view.result.current.orders[0].status).toBe("Cancelled");
    });
});

describe("useAdminOrders — order removal does not silence an unrelated alarm", () => {
    const CANCELLED_TOPIC = "/topic/branch-1/order-cancelled";
    let handlers: Record<string, (msg: IMessage) => void>;

    const orderWith = (id: number, status: string): Order =>
        ({ id, status } as unknown as Order);

    const sendCancelled = (id: number): void => {
        handlers[CANCELLED_TOPIC]({ body: JSON.stringify({ orderId: id }) } as unknown as IMessage);
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

    it("removes the cancelled order from the board", async () => {
        // Deleting an order pushes here, which is why no tenth subscription was needed.
        mockGetAllActiveOrders.mockResolvedValue([orderWith(7, "Kitchen Phase")]);
        const stopSound = jest.fn<void, []>();
        let view!: RenderHookResult<UseAdminOrdersResult, unknown>;
        await act(async () => {
            view = renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendCancelled(7));

        expect(view.result.current.orders).toHaveLength(0);
    });

    it("does not stop the alarm when a different order is removed", async () => {
        // The handler used to call stopSound unconditionally. Now that ordinary deletes push
        // here too, that would silence a live alarm for another order.
        mockGetAllActiveOrders.mockResolvedValue([orderWith(7, "Kitchen Phase"), orderWith(8, "Kitchen Phase")]);
        const stopSound = jest.fn<void, []>();
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendCancelled(8));

        expect(stopSound).not.toHaveBeenCalled();
    });
});

describe("useAdminOrders — Keeta orders must not auto-print", () => {
    const stopSound = jest.fn<void, []>();
    const NEW_ORDER_TOPIC = "/topic/branch-1/orders";
    const ORDER_UPDATES_TOPIC = "/topic/branch-1/order-updates";
    let handlers: Record<string, (msg: IMessage) => void>;

    // Minimal Order shape; only id/order_type are read by the auto-print guard.
    const orderWith = (id: number, orderType: string): Order =>
        ({ id, order_type: orderType } as unknown as Order);

    const sendFrame = (topic: string, order: Order): void => {
        handlers[topic]({ body: JSON.stringify(order) } as unknown as IMessage);
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
        mockGetAllActiveOrders.mockResolvedValue([]);
        // react-scripts' jest config sets resetMocks: true, which wipes the __mocks__
        // file's default mockResolvedValue before every test — restore it here.
        mockPrintOrder.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("does not print a Keeta order on the new-order topic", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendFrame(NEW_ORDER_TOPIC, orderWith(1, "Keeta")));

        expect(mockPrintOrder).not.toHaveBeenCalled();
    });

    it("prints a non-Keeta order on the new-order topic", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendFrame(NEW_ORDER_TOPIC, orderWith(1, "Pick Up")));

        expect(mockPrintOrder).toHaveBeenCalledTimes(1);
    });

    it("does not print a Keeta order on the order-updates topic", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendFrame(ORDER_UPDATES_TOPIC, orderWith(2, "Keeta")));

        expect(mockPrintOrder).not.toHaveBeenCalled();
    });

    it("prints a non-Keeta order on the order-updates topic", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        act(() => sendFrame(ORDER_UPDATES_TOPIC, orderWith(2, "Pick Up")));

        expect(mockPrintOrder).toHaveBeenCalledTimes(1);
    });
});

/**
 * The two delivery facts the kitchen could not previously learn on its own: that a rider is
 * standing at the pass, and that the order has a rider at all. Both ride the branch's existing
 * /delivery-alert channel — the same one that already carries NO_COURIER_AVAILABLE,
 * PICKUP_OVERDUE and GEOFENCE_WARNING — so the board has to pick its own two types out of a
 * shared union and ignore the rest.
 */
describe("useAdminOrders — delivery alerts", () => {
    const stopSound = jest.fn<void, []>();
    const DELIVERY_ALERT_TOPIC = "/topic/branch-1/delivery-alert";
    let handlers: Record<string, (msg: IMessage) => void>;

    // Minimal Order shape; only id/courier_at_kitchen are read by this handler.
    const deliveryOrder = (id: number): Order =>
        ({ id, order_type: "Delivery", courier_assigned: false, courier_at_kitchen: false } as unknown as Order);

    const sendAlert = (payload: unknown): void => {
        handlers[DELIVERY_ALERT_TOPIC]({ body: JSON.stringify(payload) } as unknown as IMessage);
    };

    async function boardWith(orders: Order[]): Promise<RenderHookResult<UseAdminOrdersResult, unknown>> {
        mockGetAllActiveOrders.mockResolvedValue(orders);
        let view!: RenderHookResult<UseAdminOrdersResult, unknown>;
        await act(async () => {
            view = renderHook(() => useAdminOrders("branch-1", stopSound));
        });
        return view;
    }

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

    // Guards the subscription itself: delete the socket.subscribe call in the hook and this is
    // the assertion that goes red first, before any of the behaviour below can even run.
    it("subscribes to the branch's delivery-alert topic", async () => {
        await boardWith([]);

        expect(mockSubscribe).toHaveBeenCalledWith(DELIVERY_ALERT_TOPIC, expect.any(Function));
    });

    it("flips courier_at_kitchen on the order the rider is waiting for", async () => {
        const view = await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_AT_KITCHEN", orderId: 7 }));

        expect(view.result.current.orders[0].courier_at_kitchen).toBe(true);
    });

    it("leaves every other card on the board alone", async () => {
        const view = await boardWith([deliveryOrder(7), deliveryOrder(8)]);

        act(() => sendAlert({ type: "COURIER_AT_KITCHEN", orderId: 7 }));

        expect(view.result.current.orders[1].courier_at_kitchen).toBe(false);
    });

    // The channel is shared with the dispatcher's own alerts; a board that reacted to all of them
    // would mark a card "courier here" the moment a rider was declared UNavailable for it.
    it("ignores the dispatcher's own alert types on the same channel", async () => {
        const view = await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "NO_COURIER_AVAILABLE", orderId: 7 }));

        expect(view.result.current.orders[0].courier_at_kitchen).toBe(false);
        // NO_COURIER_AVAILABLE is the exact OPPOSITE of an assignment, so a filter widened to
        // COURIER_ASSIGNED must not start letting it through: that would enable hand-over on the
        // one order the engine has just said has nobody to hand to.
        expect(view.result.current.orders[0].courier_assigned).toBe(false);
    });

    /**
     * The OrderEvents ACK map is keyed by orderId ALONE, and this topic has no retry behind it —
     * an ack published from here would cancel a genuinely pending order push for the same order.
     */
    it("never acks — that map is keyed by orderId and belongs to another topic", async () => {
        await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_AT_KITCHEN", orderId: 7 }));

        expect(jest.mocked(socket.publish)).not.toHaveBeenCalled();
    });

    // The server only ever stamps courierAtKitchenAt and never clears it, so a duplicate or late
    // frame must be a no-op rather than something the board has to rank-guard.
    it("is idempotent under a repeated frame", async () => {
        const view = await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_AT_KITCHEN", orderId: 7 }));
        act(() => sendAlert({ type: "COURIER_AT_KITCHEN", orderId: 7 }));

        expect(view.result.current.orders[0].courier_at_kitchen).toBe(true);
    });

    /**
     * The bug the COURIER_ASSIGNED frame exists for: `courier_assigned` had no live push at all,
     * so a tablet open since before the assignment sat on a disabled hand-over button
     * indefinitely — the REST fetch that would have corrected it only runs on mount or on a
     * reconnect resync.
     */
    it("flips courier_assigned on the order that just gained a rider", async () => {
        const view = await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_ASSIGNED", orderId: 7 }));

        expect(view.result.current.orders[0].courier_assigned).toBe(true);
    });

    it("leaves every other card's courier_assigned alone", async () => {
        const view = await boardWith([deliveryOrder(7), deliveryOrder(8)]);

        act(() => sendAlert({ type: "COURIER_ASSIGNED", orderId: 7 }));

        expect(view.result.current.orders[1].courier_assigned).toBe(false);
    });

    /**
     * The two facts must never be conflated. `courier_assigned` gates the hand-over button (it
     * mirrors the condition the endpoint 409s on) and `courier_at_kitchen` is only the badge, so
     * an assignment must not enable the hand-over AND claim the rider is standing at the pass —
     * nor may an arrival enable a hand-over the server would refuse.
     */
    it("does not also claim the rider has arrived when one is merely assigned", async () => {
        const view = await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_ASSIGNED", orderId: 7 }));

        expect(view.result.current.orders[0].courier_at_kitchen).toBe(false);
    });

    it("does not treat an arrival as an assignment", async () => {
        const view = await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_AT_KITCHEN", orderId: 7 }));

        expect(view.result.current.orders[0].courier_assigned).toBe(false);
    });

    // Same reasoning as the arrival frame: the release that would set this back to false is
    // published to the courier's own topic, so nothing on this channel can contradict a repeat.
    it("is idempotent under a repeated assignment frame", async () => {
        const view = await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_ASSIGNED", orderId: 7 }));
        act(() => sendAlert({ type: "COURIER_ASSIGNED", orderId: 7 }));

        expect(view.result.current.orders[0].courier_assigned).toBe(true);
    });

    it("never acks an assignment frame either", async () => {
        await boardWith([deliveryOrder(7)]);

        act(() => sendAlert({ type: "COURIER_ASSIGNED", orderId: 7 }));

        expect(jest.mocked(socket.publish)).not.toHaveBeenCalled();
    });
});
