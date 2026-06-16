import { jest } from "@jest/globals";

// Manual mock for shared/api/socket.ts.
// jest.fn() at module level — no jest.mock() factory hoisting restrictions apply.
// Used by hook tests via factoryless jest.mock() calls.

// connectSocket registers a connect listener and returns an unregister function.
export const connectSocket = jest.fn<() => void, [() => void]>();

export const socket = {
    subscribe: jest.fn(),
    publish: jest.fn<void, [{ destination: string; body: string }]>(),
};
