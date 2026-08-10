import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { useTripleClick } from "./useTripleClick";

// useTripleClick's returned handler never reads the event object (see useTripleClick.ts) — it
// only needs a click to have happened, not any of its properties. Casting an empty object avoids
// constructing a real React.MouseEvent purely to satisfy the parameter type.
const FAKE_EVENT = {} as MouseEvent;

describe("useTripleClick", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("fires onTrigger once when 3 clicks land inside the window", () => {
        const onTrigger = jest.fn<void, []>();
        const { result } = renderHook(() => useTripleClick(onTrigger, 600));

        result.current(FAKE_EVENT);
        jest.setSystemTime(200);
        result.current(FAKE_EVENT);
        jest.setSystemTime(400);
        result.current(FAKE_EVENT);

        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it("does not fire when 3 clicks straddle the window", () => {
        const onTrigger = jest.fn<void, []>();
        const { result } = renderHook(() => useTripleClick(onTrigger, 600));

        result.current(FAKE_EVENT);
        jest.setSystemTime(200);
        result.current(FAKE_EVENT);
        // > 600ms after the first click — the first click has aged out by the time the third lands,
        // so only two clicks (2nd and 3rd) are within the window and it must not fire.
        jest.setSystemTime(700);
        result.current(FAKE_EVENT);

        expect(onTrigger).not.toHaveBeenCalled();
    });

    it("resets the window after a fire, so the next 3 clicks fire independently", () => {
        const onTrigger = jest.fn<void, []>();
        const { result } = renderHook(() => useTripleClick(onTrigger, 600));

        result.current(FAKE_EVENT);
        jest.setSystemTime(100);
        result.current(FAKE_EVENT);
        jest.setSystemTime(200);
        result.current(FAKE_EVENT);
        expect(onTrigger).toHaveBeenCalledTimes(1);

        jest.setSystemTime(300);
        result.current(FAKE_EVENT);
        jest.setSystemTime(400);
        result.current(FAKE_EVENT);
        jest.setSystemTime(500);
        result.current(FAKE_EVENT);

        expect(onTrigger).toHaveBeenCalledTimes(2);
    });

    it("uses a default window when none is provided", () => {
        const onTrigger = jest.fn<void, []>();
        const { result } = renderHook(() => useTripleClick(onTrigger));

        result.current(FAKE_EVENT);
        jest.setSystemTime(590);
        result.current(FAKE_EVENT);
        jest.setSystemTime(599);
        result.current(FAKE_EVENT);

        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it("only counts 2 clicks as not enough to fire", () => {
        const onTrigger = jest.fn<void, []>();
        const { result } = renderHook(() => useTripleClick(onTrigger, 600));

        result.current(FAKE_EVENT);
        jest.setSystemTime(100);
        result.current(FAKE_EVENT);

        expect(onTrigger).not.toHaveBeenCalled();
    });
});
