import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import {
    useStaleBundleReload,
    CHECK_INTERVAL_MS,
    MIN_CHECK_GAP_MS,
    SETTLE_MS,
    RELOAD_TARGET_KEY,
} from "./useStaleBundleReload";
import { fetchDeployedMain, runningMain } from "../utils/buildVersion";
import { clearPageLeaving, markPageLeaving } from "../utils/pageLeaving";

// Factoryless: every export becomes a jest.fn, given its behaviour per test below (CRA resets
// mock implementations before each test).
jest.mock("../utils/buildVersion");

const mockRunningMain = jest.mocked(runningMain);
const mockFetchDeployedMain = jest.mocked(fetchDeployedMain);

const RUNNING = "/static/js/main.old11111.js";
const DEPLOYED = "/static/js/main.new22222.js";

const reloadMock = jest.fn();
const originalLocation = window.location;
let visibility: DocumentVisibilityState = "visible";

beforeAll(() => {
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: { reload: reloadMock } });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

afterAll(() => {
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: originalLocation });
    Reflect.deleteProperty(document, "visibilityState");
});

beforeEach(() => {
    jest.useFakeTimers();
    visibility = "visible";
    sessionStorage.clear();
    clearPageLeaving();
    mockRunningMain.mockReturnValue(RUNNING);
    mockFetchDeployedMain.mockResolvedValue(RUNNING);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

// Lets the awaited version check (a resolved mock promise) finish inside act.
async function flush(): Promise<void> {
    await act(async () => {
        for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
}

async function advance(ms: number): Promise<void> {
    act(() => {
        jest.advanceTimersByTime(ms);
    });
    await flush();
}

async function fire(target: Document | Window, type: string): Promise<void> {
    act(() => {
        target.dispatchEvent(new Event(type));
    });
    await flush();
}

async function firePageShow(persisted: boolean): Promise<void> {
    act(() => {
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted }));
    });
    await flush();
}

function renderWithSafety(initialSafe: boolean) {
    return renderHook(({ safe }: { safe: boolean }) => useStaleBundleReload(safe), {
        initialProps: { safe: initialSafe },
    });
}

describe("useStaleBundleReload", () => {
    it("stays off when the page was not served from a CRA build", async () => {
        mockRunningMain.mockReturnValue(null);
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);

        renderWithSafety(true);
        await flush();
        await fire(document, "visibilitychange");
        await fire(window, "focus");
        await advance(CHECK_INTERVAL_MS);

        expect(mockFetchDeployedMain).not.toHaveBeenCalled();
        expect(reloadMock).not.toHaveBeenCalled();
    });

    it("does nothing while the deployed build is the one running", async () => {
        renderWithSafety(true);
        await flush();

        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);
        expect(reloadMock).not.toHaveBeenCalled();
    });

    it("does nothing when the check cannot tell", async () => {
        mockFetchDeployedMain.mockResolvedValue(null);

        renderWithSafety(true);
        await flush();

        expect(reloadMock).not.toHaveBeenCalled();
    });

    it("reloads at once when a newer build is deployed and the page mounted safe", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);

        renderWithSafety(true);
        await flush();

        expect(reloadMock).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem(RELOAD_TARGET_KEY)).toBe(DEPLOYED);
    });

    it("waits while unsafe, then reloads once the page has stayed safe for the settle time", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        const { rerender } = renderWithSafety(false);
        await flush();
        await advance(CHECK_INTERVAL_MS);
        expect(reloadMock).not.toHaveBeenCalled();

        rerender({ safe: true });
        await advance(SETTLE_MS - 1);
        expect(reloadMock).not.toHaveBeenCalled();

        await advance(1);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("drops a pending reload when the page turns unsafe again", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        const { rerender } = renderWithSafety(false);
        await flush();

        rerender({ safe: true });
        await advance(SETTLE_MS / 2);
        rerender({ safe: false });
        await advance(SETTLE_MS * 2);
        expect(reloadMock).not.toHaveBeenCalled();

        rerender({ safe: true });
        await advance(SETTLE_MS);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    // A checkout exit marks the page and assigns window.location in the same tick that it empties
    // the cart, so the mark is already there by the time isSafe turns true.
    it("never reloads over a page a checkout has marked as leaving, until a bfcache restore", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        const { rerender } = renderWithSafety(false);
        await flush();

        markPageLeaving();
        rerender({ safe: true });
        await advance(SETTLE_MS * 2);
        await fire(window, "focus");
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(2);
        expect(reloadMock).not.toHaveBeenCalled();

        await firePageShow(true);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("never reloads over a page that has been hidden on its way out, until a bfcache restore", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        const { rerender } = renderWithSafety(false);
        await flush();

        rerender({ safe: true });
        await fire(window, "pagehide");
        await advance(SETTLE_MS * 2);
        await fire(window, "focus");
        expect(reloadMock).not.toHaveBeenCalled();

        await firePageShow(true);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    // The first pageshow follows the load event, which a slow third-party script can hold back
    // past the moment the customer is sent to the gateway.
    it("keeps the leaving mark through a pageshow that is not a bfcache restore", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        const { rerender } = renderWithSafety(false);
        await flush();

        markPageLeaving();
        rerender({ safe: true });
        await advance(MIN_CHECK_GAP_MS);
        await firePageShow(false);
        await advance(SETTLE_MS * 2);

        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(2);
        expect(reloadMock).not.toHaveBeenCalled();
    });

    it("acts on a stale build it already knows about straight after a bfcache restore, with no new check", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        const { rerender } = renderWithSafety(false);
        await flush();

        rerender({ safe: true });
        await fire(window, "pagehide");
        await advance(SETTLE_MS / 3);
        await firePageShow(true);
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);
        expect(reloadMock).not.toHaveBeenCalled();

        await advance(SETTLE_MS - SETTLE_MS / 3 - 1);
        expect(reloadMock).not.toHaveBeenCalled();

        await advance(1);
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("never reloads twice for the same deployed build", async () => {
        sessionStorage.setItem(RELOAD_TARGET_KEY, DEPLOYED);
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);

        renderWithSafety(true);
        await flush();
        expect(reloadMock).not.toHaveBeenCalled();

        mockFetchDeployedMain.mockResolvedValue("/static/js/main.newer333.js");
        await advance(MIN_CHECK_GAP_MS);
        await fire(window, "focus");
        expect(reloadMock).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem(RELOAD_TARGET_KEY)).toBe("/static/js/main.newer333.js");
    });

    it("does not reload when session storage is unavailable, since the loop guard could not hold", async () => {
        jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("SecurityError");
        });
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);

        renderWithSafety(true);
        await flush();

        expect(reloadMock).not.toHaveBeenCalled();
    });

    it("checks at most once a minute however many triggers fire", async () => {
        renderWithSafety(true);
        await flush();
        await fire(document, "visibilitychange");
        await fire(window, "focus");
        await fire(window, "pageshow");
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);

        await advance(MIN_CHECK_GAP_MS - 1);
        await fire(window, "focus");
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);

        await advance(1);
        await fire(window, "focus");
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(2);
    });

    it("picks up a deploy made while the tab was in the background when it comes back into view", async () => {
        renderWithSafety(true);
        await flush();

        visibility = "hidden";
        await fire(document, "visibilitychange");
        await advance(MIN_CHECK_GAP_MS);
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);

        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        visibility = "visible";
        await fire(document, "visibilitychange");

        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(2);
        expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("re-checks every ten minutes, but only while the tab is visible", async () => {
        renderWithSafety(true);
        await flush();

        visibility = "hidden";
        await advance(CHECK_INTERVAL_MS);
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);

        visibility = "visible";
        await advance(CHECK_INTERVAL_MS);
        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(2);
    });

    it("stops checking and drops a pending reload on unmount", async () => {
        mockFetchDeployedMain.mockResolvedValue(DEPLOYED);
        const { rerender, unmount } = renderWithSafety(false);
        await flush();
        rerender({ safe: true });

        unmount();
        await advance(SETTLE_MS * 2);
        await fire(window, "focus");
        await advance(CHECK_INTERVAL_MS);

        expect(mockFetchDeployedMain).toHaveBeenCalledTimes(1);
        expect(reloadMock).not.toHaveBeenCalled();
    });
});
