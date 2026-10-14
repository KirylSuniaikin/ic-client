import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import { renderHook } from "@testing-library/react";

// Uses the manual mock at shared/api/__mocks__/socket.ts.
jest.mock("../../../../shared/api/socket");

import { connectSocket, socket } from "../../../../shared/api/socket";
import { useDeliveryBoardEvents } from "./useDeliveryBoardEvents";

/**
 * Keeps the §4 dispatcher board live (manual §02: the board is what a manager stares at while a
 * delivery is stuck). Two of its three decisions had no coverage at all — the panel suites only
 * asserted the topic name and that a frame triggers a refetch.
 *
 * The one that matters is the reconnect: STOMP auto-reconnects the transport, but subscriptions
 * die with their session and are NOT restored. A board that subscribed once would keep reporting
 * itself connected and silently stop updating after a wifi blip — which is the exact failure mode
 * the manager cannot detect from the screen.
 */

const mockConnect = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

/** Captured connect-listeners, so a test can fire a (re)connect on demand. */
let connectListeners: Array<() => void> = [];
/** Every subscription handed back, in creation order, each with its own unsubscribe spy. */
type FakeSubscription = { id: string; unsubscribe: ReturnType<typeof jest.fn> };
let handles: FakeSubscription[] = [];
/** The message handlers registered against the board topic. */
let frameHandlers: Array<() => void> = [];

beforeEach(() => {
    connectListeners = [];
    handles = [];
    frameHandlers = [];
    mockConnect.mockReset();
    mockSubscribe.mockReset();

    mockConnect.mockImplementation((listener: () => void) => {
        connectListeners.push(listener);
        return () => {
            connectListeners = connectListeners.filter((registered) => registered !== listener);
        };
    });
    mockSubscribe.mockImplementation(((_topic: string, handler: (frame: unknown) => void) => {
        frameHandlers.push(handler as unknown as () => void);
        const handle: FakeSubscription = { id: `sub-${handles.length}`, unsubscribe: jest.fn() };
        handles.push(handle);
        // The real StompSubscription carries more than the two members this hook touches; the
        // cast keeps the fake honest about what is actually exercised.
        return handle;
    }) as unknown as typeof socket.subscribe);
});

/** Fires every registered connect listener, i.e. one (re)connection of the socket. */
function connect(): void {
    connectListeners.slice().forEach((listener) => listener());
}

describe("useDeliveryBoardEvents", () => {
    it("subscribes to the cross-branch board topic, because the board is cross-branch", () => {
        renderHook(() => useDeliveryBoardEvents(jest.fn()));
        connect();

        expect(mockSubscribe).toHaveBeenCalledTimes(1);
        expect((mockSubscribe.mock.calls[0] as [string, unknown])[0]).toBe("/topic/delivery-board");
    });

    /** Subscribing before the socket says it is connected would register against a dead session. */
    it("waits for the socket to connect before subscribing to anything", () => {
        renderHook(() => useDeliveryBoardEvents(jest.fn()));

        expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it("refetches the board rather than patching it from the frame", () => {
        const onChange = jest.fn<void, []>();
        renderHook(() => useDeliveryBoardEvents(onChange));
        connect();

        frameHandlers[0]();

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    /**
     * The reason the subscribe lives INSIDE the connect callback. A subscription registered once
     * is gone after the first drop, and nothing about the socket says so — the board would look
     * connected and quietly stop moving.
     */
    it("subscribes again on a reconnect, because the old subscription died with its session", () => {
        renderHook(() => useDeliveryBoardEvents(jest.fn()));
        connect();
        connect();

        expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });

    /**
     * …and drops the stale handle each time, or a tablet that reconnects through a long shift
     * accumulates one live subscription per drop and refetches the whole board once per handle.
     */
    it("drops the stale handle on a reconnect instead of stacking a second live one", () => {
        const onChange = jest.fn<void, []>();
        renderHook(() => useDeliveryBoardEvents(onChange));
        connect();
        connect();

        expect(handles[0].unsubscribe).toHaveBeenCalled();

        // Only the surviving subscription should still be able to move the board.
        frameHandlers[1]();
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("unsubscribes and unregisters on unmount — no leak across a screen change", () => {
        const { unmount } = renderHook(() => useDeliveryBoardEvents(jest.fn()));
        connect();

        unmount();

        expect(handles[0].unsubscribe).toHaveBeenCalled();
        expect(connectListeners).toHaveLength(0);
    });

    /**
     * A refetch that throws — a 403 mid-shift, say — must not take the subscription down with it.
     * Losing the live board because one refresh failed would leave the manager on a snapshot with
     * no indication that it had stopped updating.
     */
    it("keeps listening when a refresh throws, instead of going quiet", () => {
        const onChange = jest.fn<void, []>(() => { throw new Error("Response: 403"); });
        renderHook(() => useDeliveryBoardEvents(onChange));
        connect();

        expect(() => frameHandlers[0]()).not.toThrow();
        expect(() => frameHandlers[0]()).not.toThrow();
        expect(onChange).toHaveBeenCalledTimes(2);
    });
});
