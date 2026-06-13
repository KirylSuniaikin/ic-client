import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// socket.ts creates a STOMP Client singleton at module load time, so each test
// must reset modules and set up fresh mocks before requiring the module.
// jest.doMock() (non-hoisted) is used because it can reference closed-over
// variables; jest.mock() factories are hoisted and restricted to a limited scope.

describe("connectSocket", () => {
    let mockActivate = jest.fn<void, []>();
    let mockConnectedState: boolean;

    beforeEach(() => {
        jest.resetModules();

        mockActivate = jest.fn<void, []>();
        mockConnectedState = false;

        jest.doMock("@stomp/stompjs", () => ({
            Client: jest.fn().mockImplementation(() => ({
                get connected() {
                    return mockConnectedState;
                },
                set connected(v: boolean) {
                    mockConnectedState = v;
                },
                activate: mockActivate,
                onConnect: null as (() => void) | null,
            })),
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
    });

    afterEach(() => {
        jest.resetModules();
    });

    it("calls socket.activate when the socket is not yet connected", () => {
        mockConnectedState = false;

        // require() after resetModules+doMock gives a fresh module with mocked deps.
        // Asserted as the module's own type for type safety without using any.
        const { connectSocket } = require("./socket") as typeof import("./socket");

        connectSocket(() => undefined);

        expect(mockActivate).toHaveBeenCalledTimes(1);
    });

    it("does not call socket.activate when the socket is already connected", () => {
        mockConnectedState = true;

        const { connectSocket } = require("./socket") as typeof import("./socket");

        connectSocket(() => undefined);

        expect(mockActivate).not.toHaveBeenCalled();
    });

    it("sets socket.onConnect to the provided callback before activating", () => {
        mockConnectedState = false;

        const { connectSocket, socket } = require("./socket") as typeof import("./socket");

        const onConnect = jest.fn<void, []>();
        connectSocket(onConnect);

        expect(socket.onConnect).toBe(onConnect);
    });

    it("does not throw when called while the socket is already connected", () => {
        mockConnectedState = true;

        const { connectSocket } = require("./socket") as typeof import("./socket");

        expect(() => connectSocket(() => undefined)).not.toThrow();
    });
});

// ── Phase 3 fix: onConnect called immediately when already connected ──────────

describe("connectSocket — immediate onConnect when already connected", () => {
    let mockActivate = jest.fn<void, []>();
    let mockConnectedState: boolean;

    beforeEach(() => {
        jest.resetModules();

        mockActivate = jest.fn<void, []>();
        mockConnectedState = true;

        jest.doMock("@stomp/stompjs", () => ({
            Client: jest.fn().mockImplementation(() => ({
                get connected() {
                    return mockConnectedState;
                },
                activate: mockActivate,
                onConnect: null as (() => void) | null,
            })),
        }));

        jest.doMock("sockjs-client", () =>
            jest.fn().mockImplementation(() => ({
                send: jest.fn<void, [string]>(),
                onmessage: null,
            }))
        );

        jest.doMock("./client", () => ({
            WS_URL: "ws://test.com/ws",
        }));
    });

    afterEach(() => {
        jest.resetModules();
    });

    it("calls onConnect immediately when socket is already connected", async () => {
        const { connectSocket } = require("./socket") as typeof import("./socket");
        const onConnect = jest.fn<void, []>();

        await connectSocket(onConnect);

        expect(onConnect).toHaveBeenCalledTimes(1);
    });

    it("does not call activate when socket is already connected", async () => {
        const { connectSocket } = require("./socket") as typeof import("./socket");

        await connectSocket(() => undefined);

        expect(mockActivate).not.toHaveBeenCalled();
    });

    it("does not set socket.onConnect when socket is already connected", async () => {
        const { connectSocket, socket } = require("./socket") as typeof import("./socket");
        const onConnect = jest.fn<void, []>();

        await connectSocket(onConnect);

        // When already connected, onConnect is invoked directly; socket.onConnect is unchanged
        expect(socket.onConnect).toBeNull();
    });
});

// ── Phase 3 fix: awaits deactivate before re-activate ─────────────────────────

describe("connectSocket — awaits deactivate before re-activate", () => {
    let mockActivate = jest.fn<void, []>();
    let mockDeactivate = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

    beforeEach(() => {
        jest.resetModules();

        mockActivate = jest.fn<void, []>();
        mockDeactivate = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

        jest.doMock("@stomp/stompjs", () => ({
            Client: jest.fn().mockImplementation(() => ({
                get connected() {
                    return false;
                },
                get active() {
                    return true;
                },
                activate: mockActivate,
                deactivate: mockDeactivate,
                onConnect: null as (() => void) | null,
            })),
        }));

        jest.doMock("sockjs-client", () =>
            jest.fn().mockImplementation(() => ({
                send: jest.fn<void, [string]>(),
                onmessage: null,
            }))
        );

        jest.doMock("./client", () => ({
            WS_URL: "ws://test.com/ws",
        }));
    });

    afterEach(() => {
        jest.resetModules();
    });

    it("calls deactivate when socket is active but not connected", async () => {
        const { connectSocket } = require("./socket") as typeof import("./socket");

        await connectSocket(() => undefined);

        expect(mockDeactivate).toHaveBeenCalledTimes(1);
    });

    it("calls activate after deactivate resolves", async () => {
        const { connectSocket } = require("./socket") as typeof import("./socket");

        await connectSocket(() => undefined);

        expect(mockActivate).toHaveBeenCalledTimes(1);
    });

    it("does not call activate before deactivate resolves", async () => {
        let resolveDeactivate!: () => void;
        const deactivatePromise = new Promise<void>(resolve => {
            resolveDeactivate = resolve;
        });
        mockDeactivate.mockReturnValue(deactivatePromise);

        const { connectSocket } = require("./socket") as typeof import("./socket");
        const connectPromise = connectSocket(() => undefined);

        // Deactivation is still pending — activate must not have been called yet
        expect(mockActivate).not.toHaveBeenCalled();

        resolveDeactivate();
        await connectPromise;

        expect(mockActivate).toHaveBeenCalledTimes(1);
    });
});

describe("socket export", () => {
    beforeEach(() => {
        jest.resetModules();

        jest.doMock("@stomp/stompjs", () => ({
            Client: jest.fn().mockImplementation(() => ({
                connected: false,
                activate: jest.fn<void, []>(),
                onConnect: null,
            })),
        }));

        jest.doMock("sockjs-client", () =>
            jest.fn().mockImplementation(() => ({
                send: jest.fn<void, [string]>(),
                onmessage: null,
            }))
        );

        jest.doMock("./client", () => ({
            WS_URL: "ws://test.com/ws",
        }));
    });

    afterEach(() => {
        jest.resetModules();
    });

    it("exports a socket object", () => {
        const { socket } = require("./socket") as typeof import("./socket");

        expect(socket).toBeDefined();
    });

    it("exports a connectSocket function", () => {
        const { connectSocket } = require("./socket") as typeof import("./socket");

        expect(typeof connectSocket).toBe("function");
    });
});
