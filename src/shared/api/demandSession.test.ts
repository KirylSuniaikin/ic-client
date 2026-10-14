import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

type DemandSessionModule = typeof import("./demandSession");

const STORAGE_KEY = "icpizza.demandSession";
const SERVER_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * A fresh copy of the module per test: it remembers its in-memory fallback and whether it has
 * already warned, and a test that inherited either would prove nothing about first use.
 */
function loadFresh(): DemandSessionModule {
    let loaded: DemandSessionModule | null = null;
    jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        loaded = require("./demandSession") as DemandSessionModule;
    });
    if (loaded === null) throw new Error("demandSession did not load");
    return loaded;
}

beforeEach(() => {
    window.sessionStorage.clear();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getDemandSessionId", () => {
    it("names the header the server reads", () => {
        expect(loadFresh().DEMAND_SESSION_HEADER).toBe("X-Demand-Session");
    });

    /** Anything outside this shape is ignored server-side, which would silently undo the dedupe. */
    it("creates a token in the shape the server accepts", () => {
        expect(loadFresh().getDemandSessionId()).toMatch(SERVER_SHAPE);
    });

    it("keeps the same token for the whole tab session", () => {
        const { getDemandSessionId } = loadFresh();

        const first = getDemandSessionId();

        expect(getDemandSessionId()).toBe(first);
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe(first);
    });

    /** A reload is the same tab session: the customer retrying after a refresh is one attempt. */
    it("reuses a token already stored in this tab", () => {
        window.sessionStorage.setItem(STORAGE_KEY, "existing_token-0123456789");

        expect(loadFresh().getDemandSessionId()).toBe("existing_token-0123456789");
    });

    it("replaces a stored value the server would reject", () => {
        window.sessionStorage.setItem(STORAGE_KEY, "short");

        const token = loadFresh().getDemandSessionId();

        expect(token).not.toBe("short");
        expect(token).toMatch(SERVER_SHAPE);
    });

    /** Older WebViews have no randomUUID; the fallback must still land inside the server's shape. */
    it("falls back to a random token when crypto.randomUUID is missing", () => {
        const savedCrypto = globalThis.crypto;
        Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
        try {
            expect(loadFresh().getDemandSessionId()).toMatch(SERVER_SHAPE);
        } finally {
            Object.defineProperty(globalThis, "crypto", { configurable: true, value: savedCrypto });
        }
    });

    /**
     * Blocked storage (private mode, a locked-down WebView) must not break the availability check
     * this header rides on: the token moves to memory, stays stable, and the fallback is logged once.
     */
    it("keeps a stable in-memory token when sessionStorage throws, and warns once", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new DOMException("blocked", "SecurityError");
        });
        const { getDemandSessionId } = loadFresh();

        const first = getDemandSessionId();
        const second = getDemandSessionId();

        expect(first).toMatch(SERVER_SHAPE);
        expect(second).toBe(first);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("falls back to memory when only writing to storage fails", () => {
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("full", "QuotaExceededError");
        });
        const { getDemandSessionId } = loadFresh();

        const first = getDemandSessionId();

        expect(first).toMatch(SERVER_SHAPE);
        expect(getDemandSessionId()).toBe(first);
    });
});
