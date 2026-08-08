import { jest } from "@jest/globals";

// Manual mock for shared/api/client.ts.
// jest.fn() is at module level here — no jest.mock() factory restrictions apply.
// Used by public.test.ts and management.test.ts via jest.mock("./client").
export const authFetch = jest.fn<Promise<Response>, [string, RequestInit?]>();
export const BASE_URL = "http://test-api.com/api";
export const WS_URL = "ws://test.com/ws";
export const DEFAULT_BRANCH_ID = "2e8c35f7-d75e-4442-b496-cbb929842c10";
// ST6 additions — public.ts's raw `fetch` call sites (fetchBaseAppInfo) import these
// from client.ts. Stubbed here so callers under jest.mock("./client") don't crash;
// the real reporting behaviour (dispatch to reportClientError, 401/409/423 exclusion)
// is covered by client.test.ts against the unmocked implementation.
export const reportIfServerError = jest.fn<Promise<void>, [Response, string, string]>();
export const reportNetworkError = jest.fn<Promise<void>, [unknown, string, string]>();
