import {jest, describe, it, expect, beforeEach, afterEach} from "@jest/globals";
import {act, renderHook} from "@testing-library/react";

import {RETURN_DELAY_SECONDS, useReturnCountdown} from "./useReturnCountdown";

describe("useReturnCountdown", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("starts at the full number of seconds", () => {
        const {result} = renderHook(() => useReturnCountdown(10, jest.fn()));

        expect(result.current).toBe(10);
    });

    it("counts down one second at a time", () => {
        const {result} = renderHook(() => useReturnCountdown(10, jest.fn()));

        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(result.current).toBe(7);
    });

    it("does not call onElapsed before the delay is up", () => {
        const onElapsed = jest.fn();
        renderHook(() => useReturnCountdown(10, onElapsed));

        act(() => {
            jest.advanceTimersByTime(9999);
        });

        expect(onElapsed).not.toHaveBeenCalled();
    });

    it("calls onElapsed once the delay is up", () => {
        const onElapsed = jest.fn();
        renderHook(() => useReturnCountdown(10, onElapsed));

        act(() => {
            jest.advanceTimersByTime(10_000);
        });

        expect(onElapsed).toHaveBeenCalledTimes(1);
    });

    /**
     * Every caller passes an inline arrow, so the callback's identity changes on every render. If
     * the timeout depended on it the effect would re-arm each time and the hand-off would never
     * arrive.
     */
    it("does not restart when the callback identity changes on a re-render", () => {
        const onElapsed = jest.fn();
        const {rerender} = renderHook(() => useReturnCountdown(10, () => onElapsed()));

        act(() => {
            jest.advanceTimersByTime(5000);
        });
        rerender();
        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(onElapsed).toHaveBeenCalledTimes(1);
    });

    it("never fires after unmount", () => {
        const onElapsed = jest.fn();
        const {unmount} = renderHook(() => useReturnCountdown(10, onElapsed));

        unmount();
        act(() => {
            jest.advanceTimersByTime(20_000);
        });

        expect(onElapsed).not.toHaveBeenCalled();
    });

    it("agrees with the mobile screen on how long the wait is", () => {
        expect(RETURN_DELAY_SECONDS).toBe(5);
    });
});
