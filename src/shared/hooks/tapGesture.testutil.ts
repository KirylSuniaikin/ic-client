import { jest } from "@jest/globals";
import { act, fireEvent } from "@testing-library/react";

/*
 * Gestures for useTapGuard tests, played as the browser dispatches them: a pointer press, then the
 * click it turns into.
 *
 * jsdom 16 has no PointerEvent, and @testing-library/dom silently falls back to a bare Event that
 * carries no pointerType/pointerId/clientX — so every press would look like an unknown pointer
 * standing still. installPointerEvent() supplies a minimal one backed by jsdom's MouseEvent, the
 * same stand-in useCardDrag.test.ts uses.
 *
 * Named `.testutil.ts` so CRA's `*.test.*` testMatch does not collect it as an empty suite.
 */

class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
        this.pointerType = params.pointerType ?? "";
    }
}

let installed = false;

/**
 * Moves the clock the guard reads (performance.now()) under jest's modern fake timers, so every
 * gap between a scroll and a tap is exact rather than whatever the machine happened to take.
 */
export function elapse(ms: number): void {
    act(() => {
        jest.advanceTimersByTime(ms);
    });
}

/** Call from beforeAll; pair with removePointerEvent() in afterAll. */
export function installPointerEvent(): void {
    if (typeof window.PointerEvent !== "undefined") return;
    // The cast is the polyfill itself: the stand-in implements only the fields the guard reads,
    // not the whole PointerEvent surface (pressure, tilt, …) the DOM type declares.
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
    installed = true;
}

export function removePointerEvent(): void {
    if (!installed) return;
    Reflect.deleteProperty(window, "PointerEvent");
    installed = false;
}

const START = { clientX: 100, clientY: 100 };

interface PressOptions {
    pointerType?: "touch" | "mouse";
    /** Horizontal finger travel between the press and the release. */
    travelPx?: number;
}

/**
 * A full tap: pointerdown → (pointermove) → pointerup → click. The click carries `detail: 1`, as
 * every click from a finger or a mouse button does — keyboard activation is the one with 0.
 */
export function tap(target: Element, { pointerType = "touch", travelPx = 0 }: PressOptions = {}): void {
    const end = { clientX: START.clientX + travelPx, clientY: START.clientY };
    fireEvent.pointerDown(target, { pointerId: 1, pointerType, button: 0, ...START });
    if (travelPx !== 0) fireEvent.pointerMove(target, { pointerId: 1, pointerType, ...end });
    fireEvent.pointerUp(target, { pointerId: 1, pointerType, button: 0, ...end });
    fireEvent.click(target, { detail: 1, ...end });
}

/** What a scroll the browser took over leaves behind: a press it cancelled, then no click. */
export function swipe(target: Element): void {
    fireEvent.pointerDown(target, { pointerId: 1, pointerType: "touch", button: 0, ...START });
    fireEvent.pointerCancel(target, { pointerId: 1, pointerType: "touch" });
}

/**
 * A click with no press of its own — what iOS can deliver for the touch that stops a fling, whose
 * touch (and therefore pointer) events never fire.
 */
export function clickWithoutPress(target: Element): void {
    fireEvent.click(target, { detail: 1, ...START });
}
