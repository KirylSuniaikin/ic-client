import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";

// Uses the manual mock at __mocks__/telemetry.ts so assertions can observe calls
// regardless of telemetry's own prod-only gate.
jest.mock("./telemetry");

import {
    authFetch,
    BASE_URL,
    DEFAULT_RETRY_DELAYS_MS,
    fetchWithRetryPolicy,
    PreResponseNetworkError,
    WS_URL,
} from "./client";
import { CLIENT_PLATFORM_HEADER, CLIENT_PLATFORM_WEB } from "./clientPlatform";
import { reportClientError } from "./telemetry";
import type { ClientErrorPayload } from "./telemetry";

const mockReportClientError = jest.mocked(reportClientError);

beforeAll(() => {
    // Suppress jsdom navigation errors triggered by the 401 handler's
    // `window.location.href = '/auth'` assignment.
    Object.defineProperty(window, "location", {
        writable: true,
        configurable: true,
        value: { href: "" },
    });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── URL constants ─────────────────────────────────────────────────────────────

describe("URL constants", () => {
    it("BASE_URL is a non-empty string", () => {
        expect(typeof BASE_URL).toBe("string");
        expect(BASE_URL.length).toBeGreaterThan(0);
    });

    it("WS_URL is a non-empty string", () => {
        expect(typeof WS_URL).toBe("string");
        expect(WS_URL.length).toBeGreaterThan(0);
    });

    it("WS_URL ends with /ws", () => {
        expect(WS_URL.endsWith("/ws")).toBe(true);
    });

    it("BASE_URL contains the API path segment", () => {
        expect(BASE_URL).toContain("/api");
    });
});

// ── authFetch ─────────────────────────────────────────────────────────────────

describe("authFetch", () => {
    // A module-level mock avoids spy-restoration side effects between tests.
    // jest.Mock is structurally compatible with typeof fetch (same call signature)
    // but requires a cast because it carries additional mock utility methods.
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;
    const realRandom = Math.random;

    beforeEach(() => {
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        // Cast: jest.Mock is a superset of the fetch signature; the extra mock
        // methods do not affect runtime compatibility as a fetch replacement.
        global.fetch = mockFetch as typeof fetch;
        localStorage.clear();
        mockReportClientError.mockClear();
        // Zero jitter: retries sleep 0 ms, so retry paths run on real timers without waiting.
        Math.random = () => 0;
    });

    afterEach(() => {
        Math.random = realRandom;
        global.fetch = savedFetch;
        localStorage.clear();
    });

    it("omits Authorization header when no JWT is stored in localStorage", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await authFetch("https://example.com/api/test", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [RequestInfo, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.has("Authorization")).toBe(false);
    });

    it("adds Authorization: Bearer <token> header when JWT exists in localStorage", async () => {
        localStorage.setItem("jwt_token", "my-test-token");
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await authFetch("https://example.com/api/test", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [RequestInfo, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer my-test-token");
    });

    it("returns the Response on a successful request", async () => {
        const expected = new Response(JSON.stringify({ status: "ok" }), { status: 200 });
        mockFetch.mockResolvedValueOnce(expected);

        const result = await authFetch("https://example.com/api/test", { method: "GET" });

        expect(result).toBe(expected);
    });

    it("passes the request URL to fetch unchanged", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
        const url = "https://example.com/api/orders?branchId=abc";

        await authFetch(url, { method: "GET" });

        expect(mockFetch.mock.calls[0][0]).toBe(url);
    });

    it("passes request method and body through to fetch", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
        const body = JSON.stringify({ orderId: 42 });

        await authFetch("https://example.com/api/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe("POST");
        expect(init.body).toBe(body);
    });

    it("rejects with an Unauthorized error on a 401 response", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(
            authFetch("https://example.com/api/secret", { method: "GET" })
        ).rejects.toThrow("Unauthorized");
    });

    it("removes the JWT token from localStorage on a 401 response", async () => {
        localStorage.setItem("jwt_token", "soon-to-expire");
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(
            authFetch("https://example.com/api/secret", { method: "GET" })
        ).rejects.toThrow();

        expect(localStorage.getItem("jwt_token")).toBeNull();
    });

    // task-spec.md Extra defect 1: skipAuthRedirectOn401 lets a caller (the staff identity
    // call) treat a 401 as an ordinary rejected request, without the global sign-out side effect.
    describe("skipAuthRedirectOn401", () => {
        it("still rejects with an Unauthorized error on a 401 response", async () => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

            await expect(
                authFetch(
                    "https://example.com/api/secret",
                    { method: "GET" },
                    { skipAuthRedirectOn401: true }
                )
            ).rejects.toThrow("Unauthorized");
        });

        it("leaves the JWT token in localStorage on a 401 response", async () => {
            localStorage.setItem("jwt_token", "still-valid-elsewhere");
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

            await expect(
                authFetch(
                    "https://example.com/api/secret",
                    { method: "GET" },
                    { skipAuthRedirectOn401: true }
                )
            ).rejects.toThrow();

            expect(localStorage.getItem("jwt_token")).toBe("still-valid-elsewhere");
        });

        it("does not redirect to /auth on a 401 response", async () => {
            window.location.href = "";
            mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

            await expect(
                authFetch(
                    "https://example.com/api/secret",
                    { method: "GET" },
                    { skipAuthRedirectOn401: true }
                )
            ).rejects.toThrow();

            expect(window.location.href).toBe("");
        });
    });

    it("sets X-Client-Platform: web on every request", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await authFetch("https://example.com/api/test", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [RequestInfo, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.get(CLIENT_PLATFORM_HEADER)).toBe(CLIENT_PLATFORM_WEB);
    });

    it("preserves custom headers alongside the Authorization header", async () => {
        localStorage.setItem("jwt_token", "token-abc");
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await authFetch("https://example.com/api/test", {
            method: "GET",
            headers: { "X-Custom": "value" },
        });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer token-abc");
        expect(headers.get("X-Custom")).toBe("value");
    });

    // ── failed-API-call reporting (ST6) ────────────────────────────────────────

    it("reports source: api-5xx to reportClientError on a 500 response", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await authFetch("https://example.com/api/orders?branchId=abc", { method: "GET" });

        expect(mockReportClientError).toHaveBeenCalledTimes(1);
        const [payload] = mockReportClientError.mock.calls[0] as [ClientErrorPayload];
        expect(payload.source).toBe("api-5xx");
        expect(payload.message).toContain("500");
        expect(payload.message).toContain("GET");
        expect(payload.url).toBe("https://example.com/api/orders");
        expect(payload.url).not.toContain("?");
    });

    it.each([401, 409, 423])(
        "does not report to reportClientError on a %d response (handled UX flow)",
        async (status) => {
            mockFetch.mockResolvedValueOnce(new Response(null, { status }));

            await authFetch("https://example.com/api/test", { method: "GET" }).catch(() => undefined);

            expect(mockReportClientError).not.toHaveBeenCalled();
        }
    );

    it("does not report to reportClientError on a 200 response", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await authFetch("https://example.com/api/test", { method: "GET" });

        expect(mockReportClientError).not.toHaveBeenCalled();
    });

    it("reports source: api-network and rejects with a PreResponseNetworkError on a fetch rejection", async () => {
        const networkError = new Error("network down");
        mockFetch.mockRejectedValue(networkError);

        const rejection = authFetch("https://example.com/api/test", { method: "GET" });
        await expect(rejection).rejects.toBeInstanceOf(PreResponseNetworkError);
        await expect(rejection).rejects.toThrow("network down");

        expect(mockReportClientError).toHaveBeenCalledTimes(1);
        const [payload] = mockReportClientError.mock.calls[0] as [ClientErrorPayload];
        expect(payload.source).toBe("api-network");
        expect(payload.message).toContain("network down");
    });

    describe("retry policy", () => {
        const URL = "https://example.com/api/test";
        const failWith = (status: number): Promise<Response> => Promise.resolve(new Response(null, { status }));

        it("retries a GET with no options up to 3 times on a fetch rejection, then throws PreResponseNetworkError", async () => {
            mockFetch.mockRejectedValue(new Error("network down"));

            await expect(authFetch(URL, { method: "GET" })).rejects.toBeInstanceOf(PreResponseNetworkError);

            expect(mockFetch).toHaveBeenCalledTimes(4);
            expect(mockReportClientError).toHaveBeenCalledTimes(1);
            expect(mockReportClientError.mock.calls[0][0].source).toBe("api-network");
        });

        it("treats a missing method as a GET", async () => {
            mockFetch.mockRejectedValue(new Error("network down"));

            await expect(authFetch(URL, {})).rejects.toBeInstanceOf(PreResponseNetworkError);

            expect(mockFetch).toHaveBeenCalledTimes(4);
        });

        it.each([502, 503, 504])("retries a GET on %d and returns the final response, reporting 5xx once", async (status) => {
            mockFetch.mockImplementation(() => failWith(status));

            const response = await authFetch(URL, { method: "GET" });

            expect(response.status).toBe(status);
            expect(mockFetch).toHaveBeenCalledTimes(4);
            expect(mockReportClientError).toHaveBeenCalledTimes(1);
            expect(mockReportClientError.mock.calls[0][0].source).toBe("api-5xx");
        });

        it.each([400, 403, 404, 409, 500])("makes exactly one call on a GET %d", async (status) => {
            mockFetch.mockImplementation(() => failWith(status));

            await authFetch(URL, { method: "GET" });

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("makes exactly one call on a GET 401 and still redirects and rejects", async () => {
            window.location.href = "";
            mockFetch.mockImplementation(() => failWith(401));

            await expect(authFetch(URL, { method: "GET" })).rejects.toThrow("Unauthorized");

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(window.location.href).toBe("/auth");
        });

        it("succeeds after a transient 503 without reporting telemetry", async () => {
            mockFetch
                .mockImplementationOnce(() => failWith(503))
                .mockImplementationOnce(() => failWith(200));

            const response = await authFetch(URL, { method: "GET" });

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockReportClientError).not.toHaveBeenCalled();
        });

        it("never retries a non-GET with no options, on a network error", async () => {
            mockFetch.mockRejectedValue(new Error("network down"));

            await expect(authFetch(URL, { method: "POST", body: "{}" }))
                .rejects.toBeInstanceOf(PreResponseNetworkError);

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("never retries a non-GET with no options, on a 503", async () => {
            mockFetch.mockImplementation(() => failWith(503));

            const response = await authFetch(URL, { method: "POST", body: "{}" });

            expect(response.status).toBe(503);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("retries an opted-in POST on a network error and on 502/503/504", async () => {
            mockFetch
                .mockRejectedValueOnce(new Error("offline"))
                .mockImplementationOnce(() => failWith(502))
                .mockImplementationOnce(() => failWith(503))
                .mockImplementationOnce(() => failWith(200));

            const response = await authFetch(
                URL,
                { method: "POST", body: "{}" },
                { retryDelaysMs: DEFAULT_RETRY_DELAYS_MS }
            );

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(4);
        });

        it("resends the identical body on every retry", async () => {
            mockFetch
                .mockRejectedValueOnce(new Error("offline"))
                .mockImplementationOnce(() => failWith(200));

            await authFetch(URL, { method: "POST", body: '{"idempotency_key":"k1"}' }, { retryDelaysMs: [1] });

            const bodies = mockFetch.mock.calls.map(([, init]) => init?.body);
            expect(bodies).toEqual(['{"idempotency_key":"k1"}', '{"idempotency_key":"k1"}']);
        });

        it("does not retry a GET when retryDelaysMs is []", async () => {
            mockFetch.mockRejectedValue(new Error("network down"));

            await expect(authFetch(URL, { method: "GET" }, { retryDelaysMs: [] }))
                .rejects.toBeInstanceOf(PreResponseNetworkError);

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("never retries an AbortError", async () => {
            mockFetch.mockRejectedValue(new DOMException("aborted", "AbortError"));

            await expect(authFetch(URL, { method: "GET" })).rejects.toBeInstanceOf(PreResponseNetworkError);

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it("never retries when the caller's signal is already aborted", async () => {
            const controller = new AbortController();
            controller.abort();
            mockFetch.mockRejectedValue(new Error("boom"));

            await expect(authFetch(URL, { method: "GET", signal: controller.signal }))
                .rejects.toBeInstanceOf(PreResponseNetworkError);

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe("fetchWithRetryPolicy jitter", () => {
        let setTimeoutSpy: ReturnType<typeof jest.spyOn>;

        beforeEach(() => {
            setTimeoutSpy = jest.spyOn(global, "setTimeout");
        });

        afterEach(() => {
            setTimeoutSpy.mockRestore();
        });

        it("sleeps random * ceiling before each retry and never more than the ceiling", async () => {
            Math.random = () => 0.5;
            mockFetch.mockRejectedValue(new Error("offline"));

            await expect(fetchWithRetryPolicy("https://example.com/x", {}, DEFAULT_RETRY_DELAYS_MS))
                .rejects.toThrow("offline");

            const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms);
            expect(delays).toEqual([250, 500, 1000]);
        });

        it("never sleeps longer than the ceiling when random is just under 1", async () => {
            Math.random = () => 0.999999;
            mockFetch.mockRejectedValue(new Error("offline"));

            await expect(fetchWithRetryPolicy("https://example.com/x", {}, [500, 1000]))
                .rejects.toThrow("offline");

            const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms as number);
            expect(delays[0]).toBeLessThanOrEqual(500);
            expect(delays[1]).toBeLessThanOrEqual(1000);
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });
    });

    describe("retryDelaysMs", () => {

        it("retries on a fetch rejection and succeeds once a retry gets a response", async () => {
            mockFetch
                .mockRejectedValueOnce(new Error("offline"))
                .mockResolvedValueOnce(new Response(null, { status: 200 }));

            const response = await authFetch(
                "https://example.com/api/test",
                { method: "GET" },
                { retryDelaysMs: [1, 1] }
            );

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockReportClientError).not.toHaveBeenCalled();
        });

        it("reports and rejects with PreResponseNetworkError only once retries are exhausted", async () => {
            const networkError = new Error("still offline");
            mockFetch.mockRejectedValue(networkError);

            const rejection = authFetch(
                "https://example.com/api/test",
                { method: "GET" },
                { retryDelaysMs: [1, 1] }
            );
            await expect(rejection).rejects.toBeInstanceOf(PreResponseNetworkError);

            // Original attempt + 2 retries.
            expect(mockFetch).toHaveBeenCalledTimes(3);
            expect(mockReportClientError).toHaveBeenCalledTimes(1);
        });
    });
});
