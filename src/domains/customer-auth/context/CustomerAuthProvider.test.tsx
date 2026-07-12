import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";

// Uses the manual mock at shared/api/__mocks__/customerAuth.ts (factoryless
// jest.mock(), mirrors management.test.ts's pattern).
jest.mock("../../../shared/api/customerAuth");

import { verifyOtp, refreshCustomerToken, logoutCustomer } from "../../../shared/api/customerAuth";
import {
    CustomerAuthProvider,
    useCustomerAuth,
    customerAuthFetch,
    __resetCustomerAuthStoreForTests,
} from "./CustomerAuthProvider";

const mockVerifyOtp = jest.mocked(verifyOtp);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockLogoutCustomer = jest.mocked(logoutCustomer);

function renderCustomerAuth() {
    return renderHook(() => useCustomerAuth(), {
        wrapper: ({ children }) => <CustomerAuthProvider>{children}</CustomerAuthProvider>,
    });
}

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    // Silences the expected "no active session" debug log from failed silent-refresh paths.
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockVerifyOtp.mockReset();
    mockRefreshCustomerToken.mockReset();
    mockLogoutCustomer.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    // The provider latches kiosk mode from the URL at mount, so reset the tab to a
    // plain storefront URL — a ?mode=kiosk left over from another test would silently
    // turn off silent refresh for everyone.
    window.history.replaceState({}, "", "/");
    // Every test starts from a clean, logged-out module-level store — the
    // real singleton (module-scoped, in-memory) otherwise leaks across tests.
    __resetCustomerAuthStoreForTests();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("CustomerAuthProvider — silent refresh on mount", () => {
    it("populates the token when the cookie-driven refresh succeeds", async () => {
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "silent-refresh-token", isNewAccount: false });

        const { result } = renderCustomerAuth();

        await waitFor(() => {
            expect(result.current.isAuthLoading).toBe(false);
        });

        expect(result.current.token).toBe("silent-refresh-token");
    });

    it("leaves the user logged out (no token, no thrown error) when refresh fails", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));

        const { result } = renderCustomerAuth();

        await waitFor(() => {
            expect(result.current.isAuthLoading).toBe(false);
        });

        expect(result.current.token).toBeNull();
    });

    it("sets isAuthLoading to true before the refresh resolves", () => {
        mockRefreshCustomerToken.mockReturnValueOnce(new Promise(() => undefined));

        const { result } = renderCustomerAuth();

        expect(result.current.isAuthLoading).toBe(true);
    });

    it("calls refreshCustomerToken exactly once on mount", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));

        const { result } = renderCustomerAuth();

        await waitFor(() => {
            expect(result.current.isAuthLoading).toBe(false);
        });

        expect(mockRefreshCustomerToken).toHaveBeenCalledTimes(1);
    });
});

describe("CustomerAuthProvider — kiosk mode", () => {
    it("never restores a session on a kiosk tab, even when a valid refresh cookie is present", async () => {
        window.history.replaceState({}, "", "/menu?mode=kiosk");
        // A cookie left on the shared device WOULD resolve — the kiosk must not even ask.
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "someone-elses-token", isNewAccount: false });

        const { result } = renderCustomerAuth();

        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        expect(mockRefreshCustomerToken).not.toHaveBeenCalled();
        expect(result.current.token).toBeNull();
    });

    it("drops a token the in-memory store carried into a kiosk tab", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "previous-customer", isNewAccount: false });

        const storefront = renderCustomerAuth();
        await waitFor(() => expect(storefront.result.current.isAuthLoading).toBe(false));
        await act(async () => {
            await storefront.result.current.login("97333607710", "4821");
        });
        expect(storefront.result.current.token).toBe("previous-customer");
        storefront.unmount();

        // Same tab, now navigated into kiosk mode: the module-scoped store still holds the
        // previous customer's token, so skipping the refresh alone would not be enough.
        window.history.replaceState({}, "", "/menu?mode=kiosk");
        const kiosk = renderCustomerAuth();
        await waitFor(() => expect(kiosk.result.current.isAuthLoading).toBe(false));

        expect(kiosk.result.current.token).toBeNull();
    });

    it("treats a non-kiosk mode param as an ordinary storefront tab", async () => {
        window.history.replaceState({}, "", "/menu?mode=table");
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "silent-refresh-token", isNewAccount: false });

        const { result } = renderCustomerAuth();

        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        expect(result.current.token).toBe("silent-refresh-token");
    });
});

describe("CustomerAuthProvider — login", () => {
    it("populates the token in context state on a successful login", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "login-token", isNewAccount: false });

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        await act(async () => {
            await result.current.login("97333607710", "4821");
        });

        expect(result.current.token).toBe("login-token");
        expect(mockVerifyOtp).toHaveBeenCalledWith({ phone: "97333607710", code: "4821", branchId: undefined });
    });

    it("passes an optional branchId through to verifyOtp", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "login-token", isNewAccount: false });

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        await act(async () => {
            await result.current.login("97333607710", "4821", "branch-9");
        });

        expect(mockVerifyOtp).toHaveBeenCalledWith({ phone: "97333607710", code: "4821", branchId: "branch-9" });
    });

    it("forwards a provided name into verifyOtp's payload", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "login-token", isNewAccount: true });

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        await act(async () => {
            await result.current.login("97333607710", "4821", undefined, "Ahmed");
        });

        expect(mockVerifyOtp).toHaveBeenCalledWith({ phone: "97333607710", code: "4821", branchId: undefined, name: "Ahmed" });
    });

    it("resolves with isNewAccount and accessToken from the verify response", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "login-token", isNewAccount: true });

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        let loginResult: { isNewAccount: boolean; accessToken: string } | undefined;
        await act(async () => {
            loginResult = await result.current.login("97333607710", "4821");
        });

        expect(loginResult).toEqual({ isNewAccount: true, accessToken: "login-token" });
    });

    it("never writes the access token to localStorage or sessionStorage", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "should-not-persist", isNewAccount: false });

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        await act(async () => {
            await result.current.login("97333607710", "4821");
        });

        expect(Object.keys(localStorage)).toHaveLength(0);
        expect(Object.keys(sessionStorage)).toHaveLength(0);
    });
});

describe("CustomerAuthProvider — logout", () => {
    it("clears the token from context state", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "login-token", isNewAccount: false });
        mockLogoutCustomer.mockResolvedValueOnce(undefined);

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        await act(async () => {
            await result.current.login("97333607710", "4821");
        });
        expect(result.current.token).toBe("login-token");

        await act(async () => {
            await result.current.logout();
        });

        expect(result.current.token).toBeNull();
    });

    it("clears the token even when the logout request fails", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "login-token", isNewAccount: false });
        mockLogoutCustomer.mockRejectedValueOnce(new Error("network error"));

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        await act(async () => {
            await result.current.login("97333607710", "4821");
        });

        let thrown: unknown;
        await act(async () => {
            try {
                await result.current.logout();
            } catch (error) {
                thrown = error;
            }
        });

        expect(thrown).toBeInstanceOf(Error);
        expect(result.current.token).toBeNull();
    });
});

describe("useCustomerAuth — outside a provider", () => {
    it("throws a typed error when used outside CustomerAuthProvider", () => {
        expect(() => renderHook(() => useCustomerAuth())).toThrow(
            "useCustomerAuth must be used within a CustomerAuthProvider"
        );
    });
});

describe("customerAuthFetch", () => {
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;

    afterEach(() => {
        global.fetch = savedFetch;
    });

    it("attaches the Authorization header from the in-memory token store after login", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "stored-token", isNewAccount: false });

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));
        await act(async () => {
            await result.current.login("97333607710", "4821");
        });

        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
        global.fetch = mockFetch as typeof fetch;

        await customerAuthFetch("https://example.com/api/customer/me", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init.headers);
        expect(headers.get("Authorization")).toBe("Bearer stored-token");
    });

    it("omits the Authorization header when no token is stored", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
        global.fetch = mockFetch as typeof fetch;

        await customerAuthFetch("https://example.com/api/public", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init.headers);
        expect(headers.has("Authorization")).toBe(false);
    });

    it("on a 401, refreshes exactly once and retries with the new token", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        mockRefreshCustomerToken.mockClear();
        mockRefreshCustomerToken.mockResolvedValueOnce({ accessToken: "refreshed-token", isNewAccount: false });

        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        mockFetch
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        global.fetch = mockFetch as typeof fetch;

        const response = await customerAuthFetch("https://example.com/api/customer/me", { method: "GET" });

        expect(mockRefreshCustomerToken).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        const [, retryInit] = mockFetch.mock.calls[1] as [string, RequestInit];
        const headers = new Headers(retryInit.headers);
        expect(headers.get("Authorization")).toBe("Bearer refreshed-token");
        expect(response.status).toBe(200);
    });

    it("clears the in-memory token and rejects when the refresh-on-401 also fails", async () => {
        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("no session"));

        const { result } = renderCustomerAuth();
        await waitFor(() => expect(result.current.isAuthLoading).toBe(false));

        mockRefreshCustomerToken.mockRejectedValueOnce(new Error("refresh failed"));

        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
        global.fetch = mockFetch as typeof fetch;

        await expect(
            customerAuthFetch("https://example.com/api/customer/me", { method: "GET" })
        ).rejects.toThrow("refresh failed");

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});
