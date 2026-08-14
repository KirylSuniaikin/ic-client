import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { useImagePreloader } from "./useImagePreloader";

// jsdom's Image never issues a request and exposes no decode(), so the hook would sit unsettled
// forever. Swap in a stub that records every instance, letting each test fire onload/onerror by
// hand and exercise the timeout path deterministically.
type StubImage = {
    src: string;
    onload: (() => void) | null;
    onerror: (() => void) | null;
};

let created: StubImage[];
let originalImage: typeof Image;

function fireLoad(index: number): void {
    act(() => {
        created[index].onload?.();
    });
}

function fireError(index: number): void {
    act(() => {
        created[index].onerror?.();
    });
}

beforeEach(() => {
    created = [];
    originalImage = global.Image;
    jest.useFakeTimers();
    // The stub deliberately omits decode() so the hook takes its onload-only branch.
    global.Image = function ImageStub(this: StubImage) {
        this.src = "";
        this.onload = null;
        this.onerror = null;
        created.push(this);
    } as unknown as typeof Image;
});

afterEach(() => {
    global.Image = originalImage;
    jest.useRealTimers();
});

describe("useImagePreloader", () => {
    it("is ready immediately when there is nothing to preload", () => {
        const { result } = renderHook(() => useImagePreloader([]));

        expect(result.current).toBe(true);
        expect(created).toHaveLength(0);
    });

    it("requests every url exactly once", () => {
        renderHook(() => useImagePreloader(["/a.webp", "/b.webp"]));

        expect(created.map(i => i.src)).toEqual(["/a.webp", "/b.webp"]);
    });

    it("stays unready until the last image has settled", () => {
        const { result } = renderHook(() => useImagePreloader(["/a.webp", "/b.webp"]));
        expect(result.current).toBe(false);

        fireLoad(0);
        expect(result.current).toBe(false);

        fireLoad(1);
        expect(result.current).toBe(true);
    });

    it("treats a failed image as settled so one broken photo cannot hold the loader", () => {
        const { result } = renderHook(() => useImagePreloader(["/broken.webp"]));

        fireError(0);

        expect(result.current).toBe(true);
    });

    it("releases on the timeout even if no image ever loads", () => {
        const { result } = renderHook(() => useImagePreloader(["/slow.webp"], 2500));
        expect(result.current).toBe(false);

        act(() => {
            jest.advanceTimersByTime(2500);
        });

        expect(result.current).toBe(true);
    });

    it("does not release before the timeout elapses", () => {
        const { result } = renderHook(() => useImagePreloader(["/slow.webp"], 2500));

        act(() => {
            jest.advanceTimersByTime(2499);
        });

        expect(result.current).toBe(false);
    });

    it("detaches handlers on unmount so a late response cannot update state", () => {
        const { unmount } = renderHook(() => useImagePreloader(["/a.webp"]));
        const img = created[0];

        unmount();

        expect(img.onload).toBeNull();
        expect(img.onerror).toBeNull();
    });

    it("does not restart when the caller passes a new array with the same urls", () => {
        const { rerender, result } = renderHook(({ urls }) => useImagePreloader(urls), {
            initialProps: { urls: ["/a.webp"] },
        });
        fireLoad(0);
        expect(result.current).toBe(true);

        // Same contents, new identity — what an unmemoized caller produces on every render.
        rerender({ urls: ["/a.webp"] });

        expect(created).toHaveLength(1);
        expect(result.current).toBe(true);
    });

    it("preloads again when the url list actually changes", () => {
        const { rerender } = renderHook(({ urls }) => useImagePreloader(urls), {
            initialProps: { urls: ["/a.webp"] },
        });
        fireLoad(0);

        rerender({ urls: ["/b.webp"] });

        expect(created.map(i => i.src)).toEqual(["/a.webp", "/b.webp"]);
    });
});
