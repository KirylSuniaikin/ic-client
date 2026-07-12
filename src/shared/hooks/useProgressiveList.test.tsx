import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, act } from "@testing-library/react";
import { useProgressiveList } from "./useProgressiveList";
import type { UseProgressiveListResult } from "./useProgressiveList";

// Captures the callback passed to `new IntersectionObserver(cb)` so tests can fire it manually to
// simulate the sentinel scrolling into view — jsdom has no IntersectionObserver implementation.
let capturedObserverCallback: IntersectionObserverCallback | null = null;
let observeSpy: ReturnType<typeof jest.fn>;
let disconnectSpy: ReturnType<typeof jest.fn>;

class FakeIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(callback: IntersectionObserverCallback) {
        capturedObserverCallback = callback;
    }

    observe: (target: Element) => void = (...args) => observeSpy(...args);
    unobserve: (target: Element) => void = () => undefined;
    disconnect: () => void = (...args) => disconnectSpy(...args);
    takeRecords: () => IntersectionObserverEntry[] = () => [];
}

// The hook's sentinelRef must be attached to a real DOM node for the observer to be created and
// fire, so we exercise it through a mounted component rather than renderHook. The latest hook
// result is mirrored out via `latest` for assertions.
let latest: UseProgressiveListResult<number, HTMLDivElement>;

function Harness({ items, chunkSize }: { items: number[]; chunkSize: number }): JSX.Element | null {
    const state = useProgressiveList<number, HTMLDivElement>(items, chunkSize);
    latest = state;
    return state.hasMore ? <div ref={state.sentinelRef} data-testid="sentinel" /> : null;
}

function fireIntersection(): void {
    act(() => {
        capturedObserverCallback?.(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver
        );
    });
}

function makeItems(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
}

describe("useProgressiveList", () => {
    beforeEach(() => {
        capturedObserverCallback = null;
        observeSpy = jest.fn();
        disconnectSpy = jest.fn();
        (global as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
            FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("initial chunk", () => {
        it("renders only the first chunk when there are more items than chunkSize", () => {
            render(<Harness items={makeItems(50)} chunkSize={20} />);

            expect(latest.visibleItems).toHaveLength(20);
            expect(latest.hasMore).toBe(true);
        });

        it("renders all items and reports no more when the list fits in one chunk", () => {
            render(<Harness items={makeItems(5)} chunkSize={20} />);

            expect(latest.visibleItems).toHaveLength(5);
            expect(latest.hasMore).toBe(false);
        });
    });

    describe("revealing more on intersection", () => {
        it("observes the sentinel while more rows remain", () => {
            render(<Harness items={makeItems(50)} chunkSize={20} />);

            expect(observeSpy).toHaveBeenCalledTimes(1);
        });

        it("grows the visible slice by chunkSize when the sentinel intersects", () => {
            render(<Harness items={makeItems(50)} chunkSize={20} />);

            fireIntersection();

            expect(latest.visibleItems).toHaveLength(40);
            expect(latest.hasMore).toBe(true);
        });

        it("caps the visible slice at the total item count and flips hasMore to false", () => {
            render(<Harness items={makeItems(30)} chunkSize={20} />);

            fireIntersection();

            expect(latest.visibleItems).toHaveLength(30);
            expect(latest.hasMore).toBe(false);
        });

        it("does not observe once every item is visible", () => {
            render(<Harness items={makeItems(10)} chunkSize={20} />);

            expect(observeSpy).not.toHaveBeenCalled();
        });
    });

    describe("resetting when the source list changes", () => {
        it("returns to the first chunk when items is replaced", () => {
            const { rerender } = render(<Harness items={makeItems(50)} chunkSize={20} />);

            fireIntersection();
            expect(latest.visibleItems).toHaveLength(40);

            rerender(<Harness items={makeItems(50).map(n => n + 100)} chunkSize={20} />);

            expect(latest.visibleItems).toHaveLength(20);
            expect(latest.visibleItems[0]).toBe(100);
        });
    });

    describe("cleanup", () => {
        it("disconnects the observer on unmount", () => {
            const { unmount } = render(<Harness items={makeItems(50)} chunkSize={20} />);

            unmount();

            expect(disconnectSpy).toHaveBeenCalled();
        });
    });
});
