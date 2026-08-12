import React, { useCallback, useRef, useState } from "react";
import { resolveDropTarget } from "../dragOrdering";
import type { ColumnGeometry, Rect } from "../dragOrdering";
import type { TaskCard, TaskCardStatus } from "../types";
import { logger } from "../../../../shared/utils/logger";

const DEFAULT_DRAG_THRESHOLD_PX = 8;

export interface UseCardDragOptions {
    onDrop: (input: { cardId: number; targetStatus: TaskCardStatus; targetIndex: number }) => void;
    dragThresholdPx?: number; // default 8
    containerDocument?: Document; // defaults to `document`; test-only override
}

export interface CardDragHandlers {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
    onClick: (event: React.MouseEvent<HTMLElement>) => void; // replaces the card's own onClick wiring
    style: React.CSSProperties; // touchAction: "none" always; transform/zIndex/opacity only while this card is the active drag
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
    target: HTMLElement;
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
// three-dots priority menu's `IconButton`, which MUI always renders as a native `<button>`) must
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

// DOM glue: reads live geometry off the already-rendered ST4 DOM structure
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
    const { onDrop, dragThresholdPx = DEFAULT_DRAG_THRESHOLD_PX, containerDocument = document } = options;

    // Only one drag can be active at a time, so a single mutable slot (not per-card) tracks it.
    // Kept as a ref, not state, because the pointerdown->threshold bookkeeping must not trigger
    // re-renders on every pixel of sub-threshold jitter.
    const dragStateRef = useRef<DragState | null>(null);

    // The cardId of the gesture that JUST finished dragging, so the subsequent native `click`
    // event on that same card can be told apart from a genuine tap. Cleared as soon as read.
    const justDraggedCardIdRef = useRef<number | null>(null);

    // Drives the live transform/zIndex/opacity of whichever card is actively being dragged —
    // this one DOES need to be state, since it must repaint on every pointermove.
    const [activeDrag, setActiveDrag] = useState<ActiveDragVisual | null>(null);

    const getDragHandlers = useCallback(
        (card: TaskCard, onCardClick: (card: TaskCard) => void): CardDragHandlers => {
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
                dragStateRef.current = {
                    pointerId: event.pointerId,
                    cardId: card.id,
                    sourceStatus: card.status,
                    startX: event.clientX,
                    startY: event.clientY,
                    dragging: false,
                    target,
                };
                try {
                    target.setPointerCapture(event.pointerId);
                } catch (err) {
                    // Non-fatal: a rejected capture must not leave dragStateRef stuck, or
                    // onPointerDown's re-entry guard would refuse every future drag — Issue 3.
                    dragStateRef.current = null;
                    logger.warn("setPointerCapture failed:", err);
                }
            };

            const onPointerMove = (event: React.PointerEvent<HTMLElement>): void => {
                const state = dragStateRef.current;
                if (!state || state.pointerId !== event.pointerId) return;

                const dx = event.clientX - state.startX;
                const dy = event.clientY - state.startY;

                if (!state.dragging) {
                    const distance = Math.hypot(dx, dy);
                    if (distance < dragThresholdPx) return;
                    state.dragging = true;
                }

                // Safe to preventDefault here specifically because `touch-action: none` (via
                // `style`, applied unconditionally below) already stops the browser from starting
                // its own scroll gesture on this element before this handler ever runs.
                event.preventDefault();
                setActiveDrag({ cardId: state.cardId, dx, dy });
            };

            const finishGesture = (event: React.PointerEvent<HTMLElement>): DragState | null => {
                const state = dragStateRef.current;
                if (!state || state.pointerId !== event.pointerId) return null;

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

                if (!state.dragging) {
                    // A tap: leave the browser's own subsequent `click` event to fire onClick normally.
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
            const style: React.CSSProperties = {
                touchAction: "none",
                ...(isActiveDragCard
                    ? {
                          transform: `translate(${activeDrag.dx}px, ${activeDrag.dy}px)`,
                          zIndex: 1000,
                          opacity: 0.85,
                      }
                    : {}),
            };

            return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick, style };
        },
        [activeDrag, containerDocument, dragThresholdPx, onDrop]
    );

    return { getDragHandlers };
}
