import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { usePreciseCountdown } from "./usePreciseCountdown";

describe("usePreciseCountdown", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Align to a second boundary so `next = stepMs - (t % stepMs)` is
        // always exactly stepMs on the first timer arm, giving deterministic tests.
        jest.setSystemTime(0);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("initial return value", () => {
        it("returns endTs minus the current timestamp", () => {
            const { result } = renderHook(() => usePreciseCountdown(30_000));

            expect(result.current).toBe(30_000);
        });

        it("returns a number type", () => {
            const { result } = renderHook(() => usePreciseCountdown(60_000));

            expect(typeof result.current).toBe("number");
        });
    });

    describe("default stepMs = 1000", () => {
        it("does not tick before 1000ms elapses", () => {
            const { result } = renderHook(() => usePreciseCountdown(30_000));

            act(() => {
                jest.advanceTimersByTime(999);
            });

            expect(result.current).toBe(30_000);
        });

        it("ticks after 1000ms and decrements by 1000", () => {
            const { result } = renderHook(() => usePreciseCountdown(30_000));

            act(() => {
                jest.advanceTimersByTime(1000);
            });

            expect(result.current).toBe(29_000);
        });

        it("ticks three times in 3000ms — decrements by 3000 total", () => {
            const { result } = renderHook(() => usePreciseCountdown(30_000));

            act(() => {
                jest.advanceTimersByTime(3000);
            });

            expect(result.current).toBe(27_000);
        });
    });

    describe("explicit stepMs parameter", () => {
        it("ticks at 500ms when stepMs=500", () => {
            const { result } = renderHook(() => usePreciseCountdown(30_000, 500));

            act(() => {
                jest.advanceTimersByTime(500);
            });

            expect(result.current).toBe(29_500);
        });

        it("ticks twice in 1000ms when stepMs=500", () => {
            const { result } = renderHook(() => usePreciseCountdown(30_000, 500));

            act(() => {
                jest.advanceTimersByTime(1000);
            });

            expect(result.current).toBe(29_000);
        });

        it("does not tick at 500ms when stepMs=1000 (default)", () => {
            const { result } = renderHook(() => usePreciseCountdown(30_000, 1000));

            act(() => {
                jest.advanceTimersByTime(500);
            });

            expect(result.current).toBe(30_000);
        });
    });

    describe("cleanup on unmount", () => {
        it("calls clearTimeout when unmounted — no leaked timer", () => {
            const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

            const { unmount } = renderHook(() => usePreciseCountdown(30_000));

            unmount();

            expect(clearTimeoutSpy).toHaveBeenCalled();
            clearTimeoutSpy.mockRestore();
        });
    });
});
