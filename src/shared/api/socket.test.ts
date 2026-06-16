import { jest, describe, it, expect, afterEach } from "@jest/globals";

// socket.ts creates a STOMP Client singleton at module load time, so each test
// must reset modules and set up fresh mocks before requiring the module.
// jest.doMock() (non-hoisted) is used because it can reference closed-over
// variables; jest.mock() factories are hoisted and restricted to a limited scope.

// Shape of the mocked STOMP Client whose connection state the tests drive.
type MockClient = {
    onConnect: (() => void) | null;
    connected: boolean;
    active: boolean;
    activate: () => void;
};

// Return type is inferred — @types/jest is not installed, so the jest.Mock
// namespace cannot be referenced in an annotation (see frontend CLAUDE.md).
function setupStompMock(initial: { connected?: boolean; active?: boolean }) {
    const state = { connected: initial.connected ?? false, active: initial.active ?? false };
    const mockActivate = jest.fn<void, []>();

    jest.doMock("@stomp/stompjs", () => ({
        Client: jest.fn().mockImplementation(() => {
            const client: MockClient = {
                onConnect: null,
                get connected() {
                    return state.connected;
                },
                get active() {
                    return state.active;
                },
                activate: mockActivate,
            };
            return client;
        }),
    }));

    jest.doMock("sockjs-client", () =>
        jest.fn().mockImplementation(() => ({
            send: jest.fn<void, [string]>(),
            onmessage: null,
            close: jest.fn<void, []>(),
        }))
    );

    jest.doMock("./client", () => ({
        WS_URL: "ws://test.com/ws",
    }));

    return { mockActivate, state };
}

// STOMP types onConnect as (frame: IFrame) => void; the registry dispatcher
// ignores its argument, so tests invoke it as a no-arg function. The single cast
// here keeps every call site readable without importing the IFrame type.
function fireConnect(onConnect: unknown): void {
    (onConnect as (() => void) | null)?.();
}

describe("connectSocket — activation", () => {
    afterEach(() => {
        jest.resetModules();
    });

    it("calls socket.activate when the socket is neither connected nor active", () => {
        const { mockActivate } = setupStompMock({ connected: false, active: false });
        const { connectSocket } = require("./socket") as typeof import("./socket");

        connectSocket(() => undefined);

        expect(mockActivate).toHaveBeenCalledTimes(1);
    });

    it("does not call socket.activate when the socket is already connected", () => {
        const { mockActivate } = setupStompMock({ connected: true });
        const { connectSocket } = require("./socket") as typeof import("./socket");

        connectSocket(() => undefined);

        expect(mockActivate).not.toHaveBeenCalled();
    });

    it("does not call socket.activate again when the socket is already activating", () => {
        const { mockActivate } = setupStompMock({ connected: false, active: true });
        const { connectSocket } = require("./socket") as typeof import("./socket");

        connectSocket(() => undefined);

        expect(mockActivate).not.toHaveBeenCalled();
    });

    it("calls onConnect immediately when the socket is already connected", () => {
        setupStompMock({ connected: true });
        const { connectSocket } = require("./socket") as typeof import("./socket");

        const onConnect = jest.fn<void, []>();
        connectSocket(onConnect);

        expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("does not throw when called while the socket is already connected", () => {
        setupStompMock({ connected: true });
        const { connectSocket } = require("./socket") as typeof import("./socket");

        expect(() => connectSocket(() => undefined)).not.toThrow();
    });
});

describe("connectSocket — registry dispatches to every listener on (re)connect", () => {
    afterEach(() => {
        jest.resetModules();
    });

    it("fires ALL registered listeners when the socket (re)connects", () => {
        setupStompMock({ connected: false, active: false });
        const { connectSocket, socket } = require("./socket") as typeof import("./socket");

        const listenerA = jest.fn<void, []>();
        const listenerB = jest.fn<void, []>();
        connectSocket(listenerA);
        connectSocket(listenerB);

        // Simulate STOMP firing the connect handler (e.g. after an auto-reconnect)
        fireConnect(socket.onConnect);

        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(listenerB).toHaveBeenCalledTimes(1);
    });

    it("fires listeners again on a subsequent reconnect — re-subscription survives idle kills", () => {
        setupStompMock({ connected: false, active: false });
        const { connectSocket, socket } = require("./socket") as typeof import("./socket");

        const listener = jest.fn<void, []>();
        connectSocket(listener);

        fireConnect(socket.onConnect);
        fireConnect(socket.onConnect);

        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("unregister removes the listener so it no longer fires on reconnect", () => {
        setupStompMock({ connected: false, active: false });
        const { connectSocket, socket } = require("./socket") as typeof import("./socket");

        const listener = jest.fn<void, []>();
        const unregister = connectSocket(listener);
        unregister();

        fireConnect(socket.onConnect);

        expect(listener).not.toHaveBeenCalled();
    });

    it("a throwing listener does not prevent the others from firing", () => {
        setupStompMock({ connected: false, active: false });
        const { connectSocket, socket } = require("./socket") as typeof import("./socket");

        const throwing = jest.fn<void, []>().mockImplementation(() => {
            throw new Error("re-subscribe failed");
        });
        const healthy = jest.fn<void, []>();
        connectSocket(throwing);
        connectSocket(healthy);

        fireConnect(socket.onConnect);

        expect(healthy).toHaveBeenCalledTimes(1);
    });
});

describe("socket export", () => {
    afterEach(() => {
        jest.resetModules();
    });

    it("exports a socket object", () => {
        setupStompMock({});
        const { socket } = require("./socket") as typeof import("./socket");

        expect(socket).toBeDefined();
    });

    it("exports a connectSocket function", () => {
        setupStompMock({});
        const { connectSocket } = require("./socket") as typeof import("./socket");

        expect(typeof connectSocket).toBe("function");
    });

    it("connectSocket returns an unregister function", () => {
        setupStompMock({ connected: false, active: false });
        const { connectSocket } = require("./socket") as typeof import("./socket");

        const unregister = connectSocket(() => undefined);

        expect(typeof unregister).toBe("function");
    });
});
