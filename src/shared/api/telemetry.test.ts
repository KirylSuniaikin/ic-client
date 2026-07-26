import { jest, describe, it, expect, beforeEach, afterEach, afterAll } from "@jest/globals";
import { reportClientError } from "./telemetry";
import type { ClientErrorPayload, ClientErrorSource } from "./telemetry";
import { BASE_URL } from "./client";

const ALLOWED_SOURCES: ClientErrorSource[] = [
    "error-boundary",
    "window.onerror",
    "unhandledrejection",
    "api-5xx",
    "api-network",
];

describe("reportClientError", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;

    beforeEach(() => {
        process.env.NODE_ENV = "production";
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        // Cast: jest.Mock is a superset of the fetch signature; the extra mock
        // methods do not affect runtime compatibility as a fetch replacement.
        global.fetch = mockFetch as typeof fetch;
    });

    afterEach(() => {
        global.fetch = savedFetch;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it("posts the exact field names and a valid source to BASE_URL/client-errors", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        const payload: ClientErrorPayload = {
            message: "boom",
            stack: "Error: boom\n at foo",
            url: "https://example.com/page",
            userAgent: "jest-test-agent",
            source: "error-boundary",
        };

        await reportClientError(payload);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(calledUrl).toBe(`${BASE_URL}/client-errors`);
        expect(init.method).toBe("POST");

        const headers = new Headers(init.headers);
        expect(headers.get("Content-Type")).toBe("application/json");

        const body = JSON.parse(init.body as string) as ClientErrorPayload;
        expect(body).toEqual({
            message: "boom",
            stack: "Error: boom\n at foo",
            url: "https://example.com/page",
            userAgent: "jest-test-agent",
            source: "error-boundary",
        });
        expect(ALLOWED_SOURCES).toContain(body.source);
    });

    it("dedups within the cooldown window — a repeated identical error posts only once", async () => {
        mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

        const payload: ClientErrorPayload = {
            message: "dedup-test-message",
            source: "window.onerror",
        };

        await reportClientError(payload);
        await reportClientError(payload);
        await reportClientError(payload);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("swallows a fetch rejection without throwing", async () => {
        mockFetch.mockRejectedValueOnce(new Error("network down"));

        const payload: ClientErrorPayload = {
            message: "network-failure-message",
            source: "api-network",
        };

        await expect(reportClientError(payload)).resolves.toBeUndefined();
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("no-ops entirely outside production (never calls fetch)", async () => {
        process.env.NODE_ENV = "test";

        await reportClientError({ message: "dev-only-message", source: "unhandledrejection" });

        expect(mockFetch).not.toHaveBeenCalled();
    });
});
