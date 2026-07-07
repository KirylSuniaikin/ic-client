import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import type { RefObject } from "react";
import { useScrolledAboveViewport } from "./useScrolledAboveViewport";

// Drives the hook with a real element whose getBoundingClientRect().bottom we control, so both the
// on-screen (bottom >= 0) and scrolled-away (bottom < 0) paths can be exercised deterministically
// (jsdom otherwise reports 0 for every rect).
function makeControllableRef(initialBottom: number): {
    ref: RefObject<HTMLDivElement>;
    setBottom: (bottom: number) => void;
} {
    const el = document.createElement("div");
    let bottom = initialBottom;
    jest.spyOn(el, "getBoundingClientRect").mockImplementation(
        () =>
            ({ top: 0, left: 0, right: 0, bottom, width: 0, height: 0, x: 0, y: 0, toJSON: () => undefined } as DOMRect)
    );
    return { ref: { current: el }, setBottom: (b: number): void => { bottom = b; } };
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe("useScrolledAboveViewport", () => {
    it("returns false while the element's bottom edge is still on screen", () => {
        const { ref } = makeControllableRef(500);

        const { result } = renderHook(() => useScrolledAboveViewport(ref));

        expect(result.current).toBe(false);
    });

    it("returns true when the element has already scrolled above the viewport on mount", () => {
        const { ref } = makeControllableRef(-10);

        const { result } = renderHook(() => useScrolledAboveViewport(ref));

        expect(result.current).toBe(true);
    });

    it("flips to true on scroll once the element's bottom passes above the viewport top", () => {
        const { ref, setBottom } = makeControllableRef(120);

        const { result } = renderHook(() => useScrolledAboveViewport(ref));
        expect(result.current).toBe(false);

        setBottom(-5);
        act(() => {
            window.dispatchEvent(new Event("scroll"));
        });

        expect(result.current).toBe(true);
    });

    it("flips back to false when scrolled back so the element is on screen again", () => {
        const { ref, setBottom } = makeControllableRef(-5);

        const { result } = renderHook(() => useScrolledAboveViewport(ref));
        expect(result.current).toBe(true);

        setBottom(80);
        act(() => {
            window.dispatchEvent(new Event("scroll"));
        });

        expect(result.current).toBe(false);
    });
});
