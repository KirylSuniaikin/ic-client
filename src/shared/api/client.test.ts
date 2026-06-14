import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { authFetch, BASE_URL, WS_URL } from "./client";

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

    beforeEach(() => {
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        // Cast: jest.Mock is a superset of the fetch signature; the extra mock
        // methods do not affect runtime compatibility as a fetch replacement.
        global.fetch = mockFetch as typeof fetch;
        localStorage.clear();
    });

    afterEach(() => {
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
});
