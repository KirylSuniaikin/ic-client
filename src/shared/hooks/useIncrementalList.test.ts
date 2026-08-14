import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { useIncrementalList, DEFAULT_PAGE_SIZE } from "./useIncrementalList";

// jsdom ships no IntersectionObserver. This stub records every observed node and hands the test a
// way to fire the callback, which is the only way to drive "the user scrolled to the end".
type Trigger = () => void;
let triggers: Trigger[] = [];
let disconnectCount = 0;

class StubIntersectionObserver {
    private readonly callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
    }

    observe(): void {
        triggers.push(() => {
            this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
        });
    }

    disconnect(): void {
        disconnectCount += 1;
    }

    unobserve(): void {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
}

const items = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

function scrollToEnd(): void {
    // The observer is attached in an effect, so the trigger only exists after a commit.
    act(() => {
        triggers.forEach((fire) => fire());
    });
}

describe("useIncrementalList", () => {
    beforeEach(() => {
        triggers = [];
        disconnectCount = 0;
        (globalThis as any).IntersectionObserver = StubIntersectionObserver;
    });

    afterEach(() => {
        delete (globalThis as any).IntersectionObserver;
    });

    // Attaching the sentinel is what starts observation; a test that never does it is testing
    // nothing, because the hook only observes a mounted node.
    function attachSentinel(result: { current: { sentinelRef: (n: HTMLElement | null) => void } }): void {
        act(() => {
            result.current.sentinelRef(document.createElement("div"));
        });
    }

    it("shows only the first page of a longer list", () => {
        const { result } = renderHook(() => useIncrementalList(items(20)));

        expect(result.current.visible).toHaveLength(DEFAULT_PAGE_SIZE);
        expect(result.current.visible[0]).toBe(0);
        expect(result.current.hasMore).toBe(true);
    });

    it("defaults to six", () => {
        expect(DEFAULT_PAGE_SIZE).toBe(6);
    });

    it("shows everything and reports no more when the list is shorter than a page", () => {
        const { result } = renderHook(() => useIncrementalList(items(3)));

        expect(result.current.visible).toHaveLength(3);
        expect(result.current.hasMore).toBe(false);
    });

    it("reveals another page when the sentinel comes into view", () => {
        const { result } = renderHook(() => useIncrementalList(items(20)));
        attachSentinel(result);

        scrollToEnd();

        expect(result.current.visible).toHaveLength(12);
        expect(result.current.hasMore).toBe(true);
    });

    it("stops at the end of the list rather than growing past it", () => {
        const { result } = renderHook(() => useIncrementalList(items(8)));
        attachSentinel(result);

        scrollToEnd();

        expect(result.current.visible).toHaveLength(8);
        expect(result.current.hasMore).toBe(false);
    });

    it("honours a custom page size", () => {
        const { result } = renderHook(() => useIncrementalList(items(20), { pageSize: 2 }));

        expect(result.current.visible).toHaveLength(2);
    });

    // Saving a report replaces the array. Collapsing a scrolled list back to six cards every time
    // someone edits one would be maddening, so growth of the array must not reset the window.
    it("keeps the revealed window when the list contents change", () => {
        const { result, rerender } = renderHook(
            ({ list }: { list: number[] }) => useIncrementalList(list, { resetKey: "branch-a" }),
            { initialProps: { list: items(20) } }
        );
        attachSentinel(result);
        scrollToEnd();
        expect(result.current.visible).toHaveLength(12);

        rerender({ list: items(21) });

        expect(result.current.visible).toHaveLength(12);
    });

    it("goes back to the first page when the reset key changes", () => {
        const { result, rerender } = renderHook(
            ({ key }: { key: string }) => useIncrementalList(items(20), { resetKey: key }),
            { initialProps: { key: "branch-a" } }
        );
        attachSentinel(result);
        scrollToEnd();
        expect(result.current.visible).toHaveLength(12);

        rerender({ key: "branch-b" });

        expect(result.current.visible).toHaveLength(DEFAULT_PAGE_SIZE);
    });

    it("disconnects the observer when there is nothing left to reveal", () => {
        const { result } = renderHook(() => useIncrementalList(items(7)));
        attachSentinel(result);

        scrollToEnd();

        expect(result.current.hasMore).toBe(false);
        expect(disconnectCount).toBeGreaterThan(0);
    });

    // Old WebViews, and jsdom itself. The list must degrade to a static first page, not throw.
    it("renders the first page without an IntersectionObserver available", () => {
        delete (globalThis as any).IntersectionObserver;

        const { result } = renderHook(() => useIncrementalList(items(20)));
        attachSentinel(result);

        expect(result.current.visible).toHaveLength(DEFAULT_PAGE_SIZE);
    });
});
