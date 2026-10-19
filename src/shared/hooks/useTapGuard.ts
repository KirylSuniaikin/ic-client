import { useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

/*
 * Why the menu needs this: on iPhone the touch that stops a fling can come through as a click on
 * whatever card is under the finger, so customers scrolling the menu found item popups opening on
 * their own. Every menu scroll happens inside an overflow container — <body> itself is the page's
 * scroller (public/index.css) and each category row scrolls sideways — which is where WebKit is
 * least reliable about swallowing that touch. The browser cannot be told to drop it, so the click
 * handler has to recognise it: a click is a stray when its press travelled, or when something
 * around the tapped element was scrolling while the finger came down.
 *
 * One set of window listeners serves every guarded element. They listen in the capture phase
 * because scroll events do not bubble (capture is the only way to hear a nested scroller from the
 * window) and so no component's stopPropagation can hide a press from the guard.
 */

/** Finger travel past which a press is a swipe rather than a tap — about iOS's own tap slop. */
const TAP_MOVE_TOLERANCE_PX = 10;

/**
 * How long before the finger came down a scroll still disqualifies the tap. A touch that stops a
 * fling lands while scroll events are still arriving a frame or two apart, but a deliberate tap
 * comes after the customer has seen the row stop, and visual reaction time alone is ~200 ms. So
 * 150 ms catches the first with room for late event delivery and never reaches the second.
 */
const SCROLL_SETTLE_MS = 150;

/** iOS fires the click at touchend, so a click this soon after a release belongs to that press. */
const CLICK_AFTER_RELEASE_MS = 1000;

/**
 * For a click that arrives with no press of its own. iOS can deliver the click of a fling-stopping
 * touch without any touch or pointer events, so there is no "finger came down" to measure from and
 * the window runs back from the click instead — long enough to cover a finger held still to stop
 * the scroll. Real taps, mouse clicks and keyboard activation never take this path.
 */
const UNTRACKED_CLICK_SCROLL_MS = 1000;

interface Press {
    pointerId: number;
    pointerType: string;
    downAt: number;
    x: number;
    y: number;
    moved: boolean;
    cancelled: boolean;
    upAt: number | null;
}

let press: Press | null = null;
// Keyed by the element (or document) that scrolled, so a scroll somewhere unrelated to the tapped
// element never costs the customer a tap.
let lastScrollAt = new WeakMap<object, number>();
let subscribers = 0;

const CAPTURE_PASSIVE: AddEventListenerOptions = { capture: true, passive: true };

function handlePointerDown(event: PointerEvent): void {
    press = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        downAt: performance.now(),
        x: event.clientX,
        y: event.clientY,
        moved: false,
        cancelled: false,
        upAt: null,
    };
}

function trackMove(event: PointerEvent): void {
    if (press === null || press.upAt !== null || event.pointerId !== press.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_MOVE_TOLERANCE_PX) {
        press.moved = true;
    }
}

function handlePointerUp(event: PointerEvent): void {
    trackMove(event);
    if (press !== null && event.pointerId === press.pointerId) press.upAt = performance.now();
}

// The browser cancels a press when it takes the gesture over for scrolling.
function handlePointerCancel(event: PointerEvent): void {
    if (press !== null && event.pointerId === press.pointerId) press.cancelled = true;
}

function handleScroll(event: Event): void {
    // A viewport scroll is fired at the document; only a synthetic dispatch ever targets window.
    const scroller = event.target === window ? document : event.target;
    if (scroller !== null) lastScrollAt.set(scroller, performance.now());
}

function subscribe(): () => void {
    if (subscribers === 0) {
        window.addEventListener("pointerdown", handlePointerDown, CAPTURE_PASSIVE);
        window.addEventListener("pointermove", trackMove, CAPTURE_PASSIVE);
        window.addEventListener("pointerup", handlePointerUp, CAPTURE_PASSIVE);
        window.addEventListener("pointercancel", handlePointerCancel, CAPTURE_PASSIVE);
        window.addEventListener("scroll", handleScroll, CAPTURE_PASSIVE);
    }
    subscribers += 1;

    return () => {
        subscribers -= 1;
        if (subscribers > 0) return;
        window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
        window.removeEventListener("pointermove", trackMove, { capture: true });
        window.removeEventListener("pointerup", handlePointerUp, { capture: true });
        window.removeEventListener("pointercancel", handlePointerCancel, { capture: true });
        window.removeEventListener("scroll", handleScroll, { capture: true });
        press = null;
        lastScrollAt = new WeakMap();
    };
}

/** Whether the element, or anything it scrolls inside, scrolled at or after `since`. */
function scrolledAroundSince(element: Node, since: number): boolean {
    for (let node: Node | null = element; node !== null; node = node.parentNode) {
        const scrolledAt = lastScrollAt.get(node);
        if (scrolledAt !== undefined && scrolledAt >= since) return true;
    }
    return false;
}

function isStrayTap(event: ReactMouseEvent<Element>): boolean {
    // Enter/Space on a focused control and element.click() report detail 0 — never a scroll.
    if (event.detail === 0) return false;

    const clickAt = performance.now();
    const current = press;
    const ownPress =
        current !== null &&
        !current.cancelled &&
        current.upAt !== null &&
        clickAt - current.upAt <= CLICK_AFTER_RELEASE_MS
            ? current
            : null;

    if (ownPress === null) return scrolledAroundSince(event.currentTarget, clickAt - UNTRACKED_CLICK_SCROLL_MS);
    // A mouse is pointed at its target: a click there is meant even while the page is still moving.
    if (ownPress.pointerType === "mouse") return false;
    return ownPress.moved || scrolledAroundSince(event.currentTarget, ownPress.downAt - SCROLL_SETTLE_MS);
}

type ClickHandler<T extends Element> = (event: ReactMouseEvent<T>) => void;

/** Wraps a click handler so the click a scroll leaves behind never reaches it. */
export type GuardTap = <T extends Element>(handler: ClickHandler<T>) => ClickHandler<T>;

function guardTap<T extends Element>(handler: ClickHandler<T>): ClickHandler<T> {
    return (event) => {
        if (isStrayTap(event)) return;
        handler(event);
    };
}

/**
 * For tappables that sit on (or over) scrolling content and open something: wrap their onClick
 * with the returned function. Mouse clicks, keyboard activation and taps made once the content has
 * settled pass straight through.
 */
export function useTapGuard(): GuardTap {
    useEffect(subscribe, []);
    return guardTap;
}
