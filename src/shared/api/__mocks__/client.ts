import { jest } from "@jest/globals";

// Manual mock for shared/api/client.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.
// Used by public.test.ts and management.test.ts via jest.mock("./client").
export const authFetch = jest.fn<Promise<Response>, [string, RequestInit?]>();
export const BASE_URL = "http://test-api.com/api";
export const WS_URL = "ws://test.com/ws";
