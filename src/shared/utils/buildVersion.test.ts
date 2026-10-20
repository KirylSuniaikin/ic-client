import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import vercelConfig from "../../../vercel.json";
import { fetchDeployedMain, runningMain } from "./buildVersion";

const MAIN = "/static/js/main.1a2b3c4d.js";

function addScript(src: string): void {
    const script = document.createElement("script");
    script.setAttribute("src", src);
    document.body.appendChild(script);
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("runningMain", () => {
    afterEach(() => {
        document.querySelectorAll("script").forEach(script => script.remove());
    });

    it("is null when no CRA main bundle is on the page (dev server, tests)", () => {
        addScript("/static/js/bundle.js");
        document.body.appendChild(document.createElement("script"));

        expect(runningMain()).toBeNull();
    });

    it("returns the main bundle's path", () => {
        addScript("https://connect.facebook.net/en_US/fbevents.js");
        addScript(MAIN);

        expect(runningMain()).toBe(MAIN);
    });

    it("reduces an absolute src to the path the manifest uses", () => {
        addScript(`https://ic-pizza.com${MAIN}`);

        expect(runningMain()).toBe(MAIN);
    });
});

describe("fetchDeployedMain", () => {
    let mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    let savedFetch: typeof globalThis.fetch;

    beforeEach(() => {
        savedFetch = global.fetch;
        mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
        // Cast: jest.Mock is a superset of the fetch signature; the extra mock methods do not
        // affect runtime compatibility as a fetch replacement.
        global.fetch = mockFetch as typeof fetch;
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        global.fetch = savedFetch;
    });

    it("returns the deployed main bundle, bypassing every cache", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ main: MAIN, commit: "abc", builtAt: "x", version: "y" }));

        await expect(fetchDeployedMain()).resolves.toBe(MAIN);
        expect(mockFetch).toHaveBeenCalledWith("/version.json", { cache: "no-store" });
    });

    it("is null on an HTTP error", async () => {
        mockFetch.mockResolvedValueOnce(jsonResponse({ main: MAIN }, 404));

        await expect(fetchDeployedMain()).resolves.toBeNull();
    });

    it("is null when the request itself fails", async () => {
        mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        await expect(fetchDeployedMain()).resolves.toBeNull();
    });

    it("is null when the body is not JSON (an SPA fallback page)", async () => {
        mockFetch.mockResolvedValueOnce(new Response("<!doctype html><html></html>", { status: 200 }));

        await expect(fetchDeployedMain()).resolves.toBeNull();
    });

    it.each([
        ["no main", { version: "2026.10.20.1200" }],
        ["a non-string main", { main: 42 }],
        ["an empty main", { main: "" }],
        ["a JSON array", [MAIN]],
        ["JSON null", null],
    ])("is null for %s", async (_label, body) => {
        mockFetch.mockResolvedValueOnce(jsonResponse(body));

        await expect(fetchDeployedMain()).resolves.toBeNull();
    });
});

describe("vercel.json", () => {
    // Without this, a cached version.json could keep telling every tab that its stale bundle is
    // current, and the reload would never happen.
    it("serves /version.json with no-store", () => {
        const rule = vercelConfig.headers.find(header => header.source === "/version.json");

        expect(rule?.headers).toEqual([{ key: "Cache-Control", value: "no-store" }]);
    });
});
