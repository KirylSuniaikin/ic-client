import React, { useCallback, useEffect, useRef, useState } from "react";
import { resolveDropTarget } from "../dragOrdering";
import type { ColumnGeometry, Rect } from "../dragOrdering";
import type { TaskCard, TaskCardStatus } from "../types";
import { logger } from "../../../../shared/utils/logger";

const DEFAULT_DRAG_THRESHOLD_PX = 8;
const DEFAULT_LONG_PRESS_MS = 250;

// While dragging, a pointer this close to the scroller's edge scrolls the board towards it —
// the only way to reach an off-screen column on a phone, where one column fills the viewport.
const EDGE_SCROLL_ZONE_PX = 72;
const EDGE_SCROLL_STEP_PX = 18;
const EDGE_SCROLL_INTERVAL_MS = 16;

// Marks the horizontally-scrollable board container that edge auto-scroll drives.
export const BOARD_SCROLLER_SELECTOR = "[data-board-scroller]";

export interface UseCardDragOptions {
    onDrop: (input: { cardId: number; targetStatus: TaskCardStatus; targetIndex: number }) => void;
    dragThresholdPx?: number; // default 8
    longPressMs?: number; // default 250; touch only
    containerDocument?: Document; // defaults to `document`; test-only override
}

export interface CardDragHandlers {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
    onClick: (event: React.MouseEvent<HTMLElement>) => void; // replaces the card's own onClick wiring
    style: React.CSSProperties; // transform/zIndex/opacity/touchAction only while this card is the active drag
    isDragging: boolean;
}

export interface UseCardDragResult {
    getDragHandlers: (card: TaskCard, onCardClick: (card: TaskCard) => void) => CardDragHandlers;
}

interface DragState {
    pointerId: number;
    cardId: number;
    sourceStatus: TaskCardStatus;
    startX: number;
    startY: number;
    dragging: boolean;
    // A long press lifts the card without moving it. If the finger is then released in place, the
    // gesture is still a tap — it must open the card rather than report a move it never made.
    moved: boolean;
    target: HTMLElement;
    isTouch: boolean;
    // Board scroll offset when the card was lifted. The card is a child of the scrolling content,
    // so without compensating for scroll it slides out from under the finger the moment edge
    // auto-scroll kicks in — which looks exactly like "the card won't come with me".
    startScrollLeft: number;
}

interface ActiveDragVisual {
    cardId: number;
    dx: number;
    dy: number;
}

function toRect(domRect: DOMRect): Rect {
    return { top: domRect.top, bottom: domRect.bottom, left: domRect.left, right: domRect.right };
}

// A `pointerdown` that originates on an interactive control nested inside the card (the
// three-dots menu's `IconButton`, which MUI always renders as a native `<button>`) must
// never be allowed to start a drag candidate. Per Pointer Events Level 3, `setPointerCapture` on
// the card would otherwise retarget the trailing `click` to the card, so the control's own
// `onClick`/`stopPropagation` may never run on a real browser — see review-feedback-ST5.md
// Issue 2. `target instanceof Element` narrows the DOM `EventTarget` union without a cast.
//
// That alone misses the menu the button OPENS: MUI's `Menu` (and its `Modal` backdrop) is
// rendered via `ReactDOM` portal into `document.body`, so it is a React-tree descendant of the
// card (React dispatches synthetic events along the FIBER tree) while being a real-DOM sibling of
// it, outside `document.body`'s card subtree. Its `MenuItem`s (`<li role="menuitem">`) and the
// backdrop (`<div class="MuiBackdrop-root">`) therefore still bubble into this card's
// `onPointerDown` and would still take pointer capture, reopening the same click-retargeting bug
// one step later in the gesture — see review-feedback-ST5.md iteration 2 Issue 1. Guarding by
// real DOM containment (rather than matching portal-specific tags/roles/classes, which would be
// fragile to a MUI version bump) catches every portalled surface — menu items, the menu's
// paper/list, the backdrop, and any future portalled child — in one condition, while still
// allowing every genuine in-card grab, since everything actually rendered inside the card IS a
// DOM descendant of it.
function isInteractiveTarget(event: React.PointerEvent<HTMLElement>): boolean {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    if (target.closest("button") !== null) return true;
    return !event.currentTarget.contains(target);
}

// DOM glue: reads live geometry off the already-rendered DOM structure
// (`[data-column-status]` columns, `[data-card-id]` cards). Intentionally not part of the pure
// `dragOrdering.ts` module — see task-spec-ST5.md §6.4.
function readColumnGeometry(containerDocument: Document): ColumnGeometry[] {
    const columnElements = Array.from(containerDocument.querySelectorAll<HTMLElement>("[data-column-status]"));
    return columnElements.map(columnEl => {
        // DOM attributes are always `string | null`; cast is safe because this attribute is only
        // ever written by TaskColumn with a literal TaskCardStatus value (see TaskColumn.tsx).
        const status = columnEl.getAttribute("data-column-status") as TaskCardStatus;
        const cardElements = Array.from(columnEl.querySelectorAll<HTMLElement>("[data-card-id]"));
        const cardRects = cardElements.map(cardEl => ({
            id: Number(cardEl.getAttribute("data-card-id")),
            rect: toRect(cardEl.getBoundingClientRect()),
        }));
        return { status, rect: toRect(columnEl.getBoundingClientRect()), cardRects };
    });
}

export function useCardDrag(options: UseCardDragOptions): UseCardDragResult {
    const {
        onDrop,
        dragThresholdPx = DEFAULT_DRAG_THRESHOLD_PX,
        longPressMs = DEFAULT_LONG_PRESS_MS,
        containerDocument = document,
    } = options;

    // Only one drag can be active at a time, so a single mutable slot (not per-card) tracks it.
    // Kept as a ref, not state, because the pointerdown->threshold bookkeeping must not trigger
    // re-renders on every pixel of sub-threshold jitter.
    const dragStateRef = useRef<DragState | null>(null);

    // The cardId of the gesture that JUST finished dragging, so the subsequent native `click`
    // event on that same card can be told apart from a genuine tap. Cleared as soon as read.
    const justDraggedCardIdRef = useRef<number | null>(null);

    // Last pointer position, so the drag visual can be recomputed by the auto-scroll ticker while
    // the finger is held perfectly still at the board's edge.
    const lastPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const edgeScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const edgeScrollDirectionRef = useRef<-1 | 0 | 1>(0);

    // Drives the live transform/zIndex/opacity of whichever card is actively being dragged —
    // this one DOES need to be state, since it must repaint on every pointermove.
    const [activeDrag, setActiveDrag] = useState<ActiveDragVisual | null>(null);

    // Touch scrolling is NOT disabled up front. A card that permanently declares
    // `touch-action: none` makes the whole board unscrollable on a phone, since the cards cover
    // the column. Instead the page scrolls normally until a long-press promotes the gesture to a
    // drag, at which point this non-passive listener suppresses scrolling for the rest of it.
    // `touch-action` cannot do that job: it is latched when the gesture starts, so flipping it
    // mid-gesture has no effect on the in-flight touch.
    const blockTouchScrollRef = useRef<((event: TouchEvent) => void) | null>(null);

    const stopBlockingTouchScroll = useCallback((): void => {
        if (blockTouchScrollRef.current) {
            containerDocument.removeEventListener("touchmove", blockTouchScrollRef.current);
            blockTouchScrollRef.current = null;
        }
    }, [containerDocument]);

    const startBlockingTouchScroll = useCallback((): void => {
        if (blockTouchScrollRef.current) return;
        const handler = (event: TouchEvent): void => {
            if (event.cancelable) event.preventDefault();
        };
        blockTouchScrollRef.current = handler;
        containerDocument.addEventListener("touchmove", handler, { passive: false });
    }, [containerDocument]);

    const applyDragVisual = useCallback((): void => {
        const state = dragStateRef.current;
        if (!state || !state.dragging) return;
        const scroller = containerDocument.querySelector<HTMLElement>(BOARD_SCROLLER_SELECTOR);
        const scrolled = scroller ? scroller.scrollLeft - state.startScrollLeft : 0;
        setActiveDrag({
            cardId: state.cardId,
            dx: lastPointRef.current.x - state.startX + scrolled,
            dy: lastPointRef.current.y - state.startY,
        });
    }, [containerDocument]);

    const stopEdgeScroll = useCallback((): void => {
        edgeScrollDirectionRef.current = 0;
        if (edgeScrollTimerRef.current !== null) {
            clearInterval(edgeScrollTimerRef.current);
            edgeScrollTimerRef.current = null;
        }
        const scroller = containerDocument.querySelector<HTMLElement>(BOARD_SCROLLER_SELECTOR);
        if (scroller) scroller.style.scrollSnapType = "";
    }, [containerDocument]);

    const startEdgeScroll = useCallback((): void => {
        if (edgeScrollTimerRef.current !== null) return;
        // Scroll snapping fights an in-progress auto-scroll: each programmatic nudge is pulled back
        // to the nearest column start, so the board never actually reaches the next column while a
        // card is held at the edge. Suspend it for the duration of the drag and restore it after.
        const scroller = containerDocument.querySelector<HTMLElement>(BOARD_SCROLLER_SELECTOR);
        if (scroller) scroller.style.scrollSnapType = "none";
        edgeScrollTimerRef.current = setInterval(() => {
            const direction = edgeScrollDirectionRef.current;
            if (direction === 0) return;
            const target = containerDocument.querySelector<HTMLElement>(BOARD_SCROLLER_SELECTOR);
            if (!target) return;
            target.scrollLeft += direction * EDGE_SCROLL_STEP_PX;
            applyDragVisual();
        }, EDGE_SCROLL_INTERVAL_MS);
    }, [containerDocument, applyDragVisual]);

    const cancelLongPress = useCallback((): void => {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    // A gesture in flight when the board unmounts would otherwise leave the document-level
    // touchmove blocker and the auto-scroll interval running forever.
    useEffect(() => {
        return (): void => {
            cancelLongPress();
            stopEdgeScroll();
            stopBlockingTouchScroll();
        };
    }, [cancelLongPress, stopEdgeScroll, stopBlockingTouchScroll]);

    const getDragHandlers = useCallback(
        (card: TaskCard, onCardClick: (card: TaskCard) => void): CardDragHandlers => {
            const beginDragging = (state: DragState): void => {
                const scroller = containerDocument.querySelector<HTMLElement>(BOARD_SCROLLER_SELECTOR);
                state.startScrollLeft = scroller ? scroller.scrollLeft : 0;
                state.dragging = true;
                if (state.isTouch) startBlockingTouchScroll();
                startEdgeScroll();
                applyDragVisual();
            };

            const onPointerDown = (event: React.PointerEvent<HTMLElement>): void => {
                // A new gesture is starting: any suppression flag left behind by a PREVIOUS drag on
                // this (or any) card is now stale. On touch, a real drag produces no trailing `click`
                // at all, so without this the flag would otherwise survive to swallow the very next,
                // unrelated tap — see review-feedback-ST5.md Issue 1. Clearing it here, unconditionally
                // and before any early return below, scopes the flag to "at most until the next
                // gesture begins" instead of "until some click eventually happens".
                justDraggedCardIdRef.current = null;

                if (event.button !== 0) return; // ignore non-primary mouse button
                if (isInteractiveTarget(event)) return; // let interactive controls AND portalled surfaces they open (e.g. the three-dots menu button, its MenuItems, the modal backdrop) handle their own click — never start a drag candidate or take capture for them, see Issue 2 / iteration-2 Issue 1
                if (dragStateRef.current !== null) return; // a drag is already tracked (e.g. multi-touch)

                const target = event.currentTarget;
                const state: DragState = {
                    pointerId: event.pointerId,
                    cardId: card.id,
                    sourceStatus: card.status,
                    startX: event.clientX,
                    startY: event.clientY,
                    dragging: false,
                    moved: false,
                    target,
                    isTouch: event.pointerType === "touch",
                    startScrollLeft: 0,
                };
                dragStateRef.current = state;
                lastPointRef.current = { x: event.clientX, y: event.clientY };
                try {
                    target.setPointerCapture(event.pointerId);
                } catch (err) {
                    // Non-fatal: a rejected capture must not leave dragStateRef stuck, or
                    // onPointerDown's re-entry guard would refuse every future drag — Issue 3.
                    dragStateRef.current = null;
                    logger.warn("setPointerCapture failed:", err);
                    return;
                }

                // Touch lifts the card on a long press instead of on movement, so that an ordinary
                // swipe over a card still scrolls the board. A mouse keeps the movement threshold:
                // there is no scroll gesture to disambiguate from.
                if (state.isTouch) {
                    longPressTimerRef.current = setTimeout(() => {
                        longPressTimerRef.current = null;
                        const current = dragStateRef.current;
                        if (current === state && !current.dragging) beginDragging(current);
                    }, longPressMs);
                }
            };

            const updateEdgeScrollDirection = (clientX: number): void => {
                const scroller = containerDocument.querySelector<HTMLElement>(BOARD_SCROLLER_SELECTOR);
                if (!scroller) {
                    edgeScrollDirectionRef.current = 0;
                    return;
                }
                const rect = scroller.getBoundingClientRect();
                if (clientX > rect.right - EDGE_SCROLL_ZONE_PX) edgeScrollDirectionRef.current = 1;
                else if (clientX < rect.left + EDGE_SCROLL_ZONE_PX) edgeScrollDirectionRef.current = -1;
                else edgeScrollDirectionRef.current = 0;
            };

            const onPointerMove = (event: React.PointerEvent<HTMLElement>): void => {
                const state = dragStateRef.current;
                if (!state || state.pointerId !== event.pointerId) return;

                const dx = event.clientX - state.startX;
                const dy = event.clientY - state.startY;

                if (!state.dragging) {
                    const distance = Math.hypot(dx, dy);
                    if (distance < dragThresholdPx) return;

                    if (state.isTouch) {
                        // Moved before the long press completed: this is a scroll, not a drag.
                        // Abandon the candidate and hand the gesture back to the browser — nothing
                        // has blocked scrolling yet, so the board scrolls as the user expects.
                        cancelLongPress();
                        dragStateRef.current = null;
                        try {
                            state.target.releasePointerCapture(event.pointerId);
                        } catch (err) {
                            logger.warn("releasePointerCapture failed (pointer already inactive):", err);
                        }
                        return;
                    }

                    lastPointRef.current = { x: event.clientX, y: event.clientY };
                    beginDragging(state);
                }

                // Safe to preventDefault: for touch the document-level non-passive blocker installed
                // at lift time already owns the gesture; for mouse there is no scroll to cancel.
                event.preventDefault();
                state.moved = true;
                lastPointRef.current = { x: event.clientX, y: event.clientY };
                updateEdgeScrollDirection(event.clientX);
                applyDragVisual();
            };

            const finishGesture = (event: React.PointerEvent<HTMLElement>): DragState | null => {
                const state = dragStateRef.current;
                if (!state || state.pointerId !== event.pointerId) return null;

                cancelLongPress();
                stopEdgeScroll();
                stopBlockingTouchScroll();

                // Clear the tracked state BEFORE attempting to release capture, and independently of
                // whether that release succeeds. `releasePointerCapture` is specified to throw once the
                // pointer is no longer active (reachable via `pointercancel`, or a card that unmounts
                // mid-drag), and `onPointerDown`'s re-entry guard refuses every new drag while this ref
                // is non-null — a thrown release must never be allowed to wedge dragging board-wide
                // until reload. See review-feedback-ST5.md Issue 3.
                dragStateRef.current = null;
                try {
                    state.target.releasePointerCapture(event.pointerId);
                } catch (err) {
                    logger.warn("releasePointerCapture failed (pointer already inactive):", err);
                }
                return state;
            };

            const onPointerUp = (event: React.PointerEvent<HTMLElement>): void => {
                const state = finishGesture(event);
                if (!state) return;

                if (!state.dragging || !state.moved) {
                    // A tap — including a long press released without moving. Leave the browser's own
                    // subsequent `click` event to fire onClick normally, and report no move.
                    setActiveDrag(null);
                    return;
                }

                justDraggedCardIdRef.current = state.cardId;
                setActiveDrag(null);

                const columns = readColumnGeometry(containerDocument);
                const point = { x: event.clientX, y: event.clientY };
                const dropTarget = resolveDropTarget(columns, point, state.cardId);
                if (dropTarget) {
                    onDrop({ cardId: state.cardId, targetStatus: dropTarget.status, targetIndex: dropTarget.index });
                }
            };

            const onPointerCancel = (event: React.PointerEvent<HTMLElement>): void => {
                finishGesture(event);
                setActiveDrag(null);
            };

            const onClick = (event: React.MouseEvent<HTMLElement>): void => {
                if (justDraggedCardIdRef.current === card.id) {
                    justDraggedCardIdRef.current = null;
                    return; // a real drag just completed on this card — swallow the trailing click
                }
                onCardClick(card);
            };

            const isActiveDragCard = activeDrag !== null && activeDrag.cardId === card.id;
            const style: React.CSSProperties = isActiveDragCard
                ? {
                      touchAction: "none",
                      transform: `translate(${activeDrag.dx}px, ${activeDrag.dy}px) rotate(2deg) scale(1.02)`,
                      zIndex: 1000,
                      opacity: 0.92,
                      cursor: "grabbing",
                  }
                : {};

            return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick, style, isDragging: isActiveDragCard };
        },
        [
            activeDrag,
            containerDocument,
            dragThresholdPx,
            longPressMs,
            onDrop,
            applyDragVisual,
            cancelLongPress,
            startBlockingTouchScroll,
            stopBlockingTouchScroll,
            startEdgeScroll,
            stopEdgeScroll,
        ]
    );

    return { getDragHandlers };
}
