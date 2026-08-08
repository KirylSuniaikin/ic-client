import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { kioskFetch, KioskUnauthorizedError, KioskHttpError } from "./kioskClient";
import { setKioskDeviceName, clearKioskDeviceName } from "../../domains/kiosk/services/kioskIdentity";

beforeAll(() => {
    // Suppress jsdom navigation errors if anything ever assigns window.location.href — kioskFetch
    // must never do this, and the test below asserts it stays untouched.
    Object.defineProperty(window, "location", {
        writable: true,
        configurable: true,
        value: { href: "" },
    });
});

describe("kioskFetch", () => {
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;

    beforeEach(() => {
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        // Cast: jest.Mock is a superset of the fetch signature; the extra mock methods do not
        // affect runtime compatibility as a fetch replacement (mirrors client.test.ts).
        global.fetch = mockFetch as typeof fetch;
        localStorage.clear();
    });

    afterEach(() => {
        global.fetch = savedFetch;
        localStorage.clear();
    });

    it("attaches X-Kiosk-Name when a device name is stored", async () => {
        setKioskDeviceName("kiosk-1");
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.get("X-Kiosk-Name")).toBe("kiosk-1");
    });

    it("omits X-Kiosk-Name when no device name is stored", async () => {
        clearKioskDeviceName();
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.has("X-Kiosk-Name")).toBe(false);
    });

    it("always sends X-Client-Platform: kiosk-web", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.get("X-Client-Platform")).toBe("kiosk-web");
    });

    it("never sends an Authorization header, even when a staff JWT is present", async () => {
        localStorage.setItem("jwt_token", "should-be-ignored");
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.has("Authorization")).toBe(false);
    });

    it("preserves custom headers alongside the kiosk headers", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

        await kioskFetch("https://example.com/api/kiosk/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = new Headers(init?.headers);
        expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("returns the raw Response on a successful request", async () => {
        const expected = new Response(JSON.stringify({ ok: true }), { status: 200 });
        mockFetch.mockResolvedValueOnce(expected);

        const result = await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });

        expect(result).toBe(expected);
    });

    it("throws KioskUnauthorizedError on a 401 response", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(
            kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" })
        ).rejects.toBeInstanceOf(KioskUnauthorizedError);
    });

    it("never touches window.location on a 401 response", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

        await expect(
            kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" })
        ).rejects.toThrow();

        expect(window.location.href).toBe("");
    });

    it("throws KioskHttpError carrying the status and JSON message on other non-ok responses", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "boom" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            })
        );

        let caught: unknown;
        try {
            await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(KioskHttpError);
        expect((caught as KioskHttpError).status).toBe(500);
        expect((caught as KioskHttpError).message).toBe("boom");
    });

    it("carries the parsed JSON body on KioskHttpError for structured error handling", async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "unavailable", unavailableIds: [1, 2] }), {
                status: 409,
                headers: { "Content-Type": "application/json" },
            })
        );

        let caught: unknown;
        try {
            await kioskFetch("https://example.com/api/kiosk/orders", { method: "POST" });
        } catch (err) {
            caught = err;
        }

        expect((caught as KioskHttpError).body).toEqual({ message: "unavailable", unavailableIds: [1, 2] });
    });

    it("falls back to the response text when the error body isn't JSON", async () => {
        mockFetch.mockResolvedValueOnce(new Response("plain text failure", { status: 502 }));

        let caught: unknown;
        try {
            await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });
        } catch (err) {
            caught = err;
        }

        expect((caught as KioskHttpError).message).toBe("plain text failure");
    });

    it("falls back to a generic message when the error body is unreadable", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

        let caught: unknown;
        try {
            await kioskFetch("https://example.com/api/kiosk/ping", { method: "GET" });
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(KioskHttpError);
        expect((caught as KioskHttpError).status).toBe(503);
        expect((caught as KioskHttpError).message.length).toBeGreaterThan(0);
    });
});
