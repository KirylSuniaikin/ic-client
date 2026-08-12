// This is a .test.ts file driving a small .tsx test harness component defined inline below via
// React.createElement (no JSX) so the file can stay a plain .ts, matching this hook's own
// DOM-glue-only nature — the harness itself is intentionally minimal, per task-spec-ST5.md §11
// ("render a small local test harness ... rather than the full TaskBoardPanel").
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { useCardDrag } from "./useCardDrag";
import type { UseCardDragOptions } from "./useCardDrag";
import type { TaskCard, TaskCardStatus } from "../types";

// jsdom 16 (this project's test environment) implements `MouseEvent` but has no `PointerEvent`
// class at all. `@testing-library/dom`'s fireEvent.pointerDown/Move/Up/Cancel look up
// `window.PointerEvent` and silently fall back to constructing a bare `Event` when it's missing —
// and a bare `Event` does not carry `button`/`clientX`/`clientY`/`pointerId` at all (React's
// SyntheticEvent copies each of these straight off the native event with no default when absent),
// so the hook under test would never see real values and every gesture below would look like a
// no-op. Polyfilling a minimal `PointerEvent`, backed by jsdom's real `MouseEvent` (which DOES
// honor clientX/clientY/button from its init dict), is what lets these DOM-level pointer gestures
// actually reach the hook.
class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
    }
}

if (typeof window.PointerEvent === "undefined") {
    // This minimal polyfill only implements the fields this file actually drives
    // (button/clientX/clientY via MouseEvent, plus pointerId) rather than the full PointerEvent
    // spec surface (pressure/tiltX/twist/etc.) — acceptable because it exists solely to make
    // jsdom's missing Pointer Events support usable for `fireEvent.pointerX` in this test file.
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

type DropInput = { cardId: number; targetStatus: TaskCardStatus; targetIndex: number };

function makeCard(overrides: Partial<TaskCard> = {}): TaskCard {
    return {
        id: 1,
        title: "Card",
        description: null,
        priority: "GREEN",
        status: "BACKLOG",
        position: 0,
        assigneeId: 7,
        createdAt: "2026-08-12T10:00:00",
        updatedAt: "2026-08-12T10:00:00",
        ...overrides,
    };
}

type RectLike = { top: number; bottom: number; left: number; right: number };

let rectTable: Record<string, RectLike>;

function Harness(props: {
    cards: TaskCard[];
    onDrop: UseCardDragOptions["onDrop"];
    onCardClick: (card: TaskCard) => void;
}): JSX.Element {
    const { cards, onDrop, onCardClick } = props;
    const { getDragHandlers } = useCardDrag({ onDrop });
    const statuses: TaskCardStatus[] = ["BACKLOG", "DOING", "DONE"];

    return React.createElement(
        "div",
        null,
        statuses.map(status =>
            React.createElement(
                "div",
                { key: status, "data-column-status": status, "data-testid": `column-${status}` },
                cards
                    .filter(card => card.status === status)
                    .map(card => {
                        const handlers = getDragHandlers(card, onCardClick);
                        return React.createElement(
                            "div",
                            {
                                key: card.id,
                                "data-card-id": card.id,
                                "data-testid": `card-${card.id}`,
                                style: handlers.style,
                                onPointerDown: handlers.onPointerDown,
                                onPointerMove: handlers.onPointerMove,
                                onPointerUp: handlers.onPointerUp,
                                onPointerCancel: handlers.onPointerCancel,
                                onClick: handlers.onClick,
                            },
                            card.title
                        );
                    })
            )
        )
    );
}

beforeEach(() => {
    rectTable = {
        BACKLOG: { top: 0, bottom: 1000, left: 0, right: 300 },
        DOING: { top: 0, bottom: 1000, left: 310, right: 610 },
        DONE: { top: 0, bottom: 1000, left: 620, right: 920 },
        "1": { top: 0, bottom: 100, left: 0, right: 300 },
        "2": { top: 100, bottom: 200, left: 0, right: 300 },
        "3": { top: 0, bottom: 100, left: 310, right: 610 },
    };

    jest.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
        this: Element
    ): DOMRect {
        const key = this.getAttribute("data-column-status") ?? this.getAttribute("data-card-id");
        const rect = key !== null ? rectTable[key] : undefined;
        const top = rect?.top ?? 0;
        const bottom = rect?.bottom ?? 0;
        const left = rect?.left ?? 0;
        const right = rect?.right ?? 0;
        return {
            top,
            bottom,
            left,
            right,
            width: right - left,
            height: bottom - top,
            x: left,
            y: top,
            toJSON: () => ({}),
        } as DOMRect;
    });

    // jsdom does not implement pointer capture at all — calling the real, absent method would throw.
    Element.prototype.setPointerCapture = jest.fn<void, [number]>();
    Element.prototype.releasePointerCapture = jest.fn<void, [number]>();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("useCardDrag", () => {
    it("drag within a column reorders and calls onDrop with the same targetStatus", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG" }),
            makeCard({ id: 2, status: "BACKLOG" }),
        ];
        const onDrop = jest.fn<void, [DropInput]>();
        const onCardClick = jest.fn<void, [TaskCard]>();

        render(React.createElement(Harness, { cards, onDrop, onCardClick }));
        const card1 = screen.getByTestId("card-1");

        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: 50, clientY: 250 });
        fireEvent.pointerUp(card1, { pointerId: 1, clientX: 50, clientY: 250 });

        expect(onDrop).toHaveBeenCalledWith({ cardId: 1, targetStatus: "BACKLOG", targetIndex: 1 });
    });

    it("drag across columns calls onDrop with the new targetStatus", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG" }),
            makeCard({ id: 3, status: "DOING" }),
        ];
        const onDrop = jest.fn<void, [DropInput]>();
        const onCardClick = jest.fn<void, [TaskCard]>();

        render(React.createElement(Harness, { cards, onDrop, onCardClick }));
        const card1 = screen.getByTestId("card-1");

        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: 400, clientY: 10 });
        fireEvent.pointerUp(card1, { pointerId: 1, clientX: 400, clientY: 10 });

        expect(onDrop).toHaveBeenCalledWith({ cardId: 1, targetStatus: "DOING", targetIndex: 0 });
    });

    it("a drop released outside every column calls neither onDrop nor mutates anything", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG" }),
            makeCard({ id: 2, status: "BACKLOG" }),
        ];
        const onDrop = jest.fn<void, [DropInput]>();
        const onCardClick = jest.fn<void, [TaskCard]>();

        render(React.createElement(Harness, { cards, onDrop, onCardClick }));
        const card1 = screen.getByTestId("card-1");

        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: -500, clientY: -500 });
        fireEvent.pointerUp(card1, { pointerId: 1, clientX: -500, clientY: -500 });

        expect(onDrop).not.toHaveBeenCalled();
        // Both cards remain rendered, untouched, in their original DOM positions.
        expect(screen.getByTestId("card-1")).toBeTruthy();
        expect(screen.getByTestId("card-2")).toBeTruthy();
    });

    it("a pointer gesture under the movement threshold still fires the card's click callback", () => {
        const cards = [makeCard({ id: 1, status: "BACKLOG" })];
        const onDrop = jest.fn<void, [DropInput]>();
        const onCardClick = jest.fn<void, [TaskCard]>();

        render(React.createElement(Harness, { cards, onDrop, onCardClick }));
        const card1 = screen.getByTestId("card-1");

        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: 52, clientY: 52 });
        fireEvent.pointerUp(card1, { pointerId: 1, clientX: 52, clientY: 52 });
        fireEvent.click(card1);

        expect(onDrop).not.toHaveBeenCalled();
        expect(onCardClick).toHaveBeenCalledTimes(1);
        expect(onCardClick).toHaveBeenCalledWith(cards[0]);
    });

    it("a pointer gesture over the threshold does not fire the click callback even when pointerup lands back on the same card", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG" }),
            makeCard({ id: 2, status: "BACKLOG" }),
        ];
        const onDrop = jest.fn<void, [DropInput]>();
        const onCardClick = jest.fn<void, [TaskCard]>();

        render(React.createElement(Harness, { cards, onDrop, onCardClick }));
        const card1 = screen.getByTestId("card-1");

        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: 50, clientY: 250 });
        fireEvent.pointerUp(card1, { pointerId: 1, clientX: 50, clientY: 50 });
        fireEvent.click(card1);

        expect(onCardClick).not.toHaveBeenCalled();
    });

    it("does not swallow the next genuine tap after a touch-style drag that produces no trailing click (review-feedback-ST5.md Issue 1)", () => {
        const cards = [makeCard({ id: 1, status: "BACKLOG" })];
        const onDrop = jest.fn<void, [DropInput]>();
        const onCardClick = jest.fn<void, [TaskCard]>();

        render(React.createElement(Harness, { cards, onDrop, onCardClick }));
        const card1 = screen.getByTestId("card-1");

        // A real over-threshold touch drag: on a touch device the browser's tap heuristic never
        // fires a trailing `click` after this, unlike a mouse — deliberately no fireEvent.click here.
        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: 50, clientY: 250 });
        fireEvent.pointerUp(card1, { pointerId: 1, clientX: 50, clientY: 250 });

        expect(onCardClick).not.toHaveBeenCalled();

        // The next, completely unrelated gesture on the same card is a genuine tap. `pointerdown`
        // must clear the stale suppression flag left by the drag above, or this tap would be
        // swallowed and the description popup would never open.
        fireEvent.pointerDown(card1, { pointerId: 2, clientX: 60, clientY: 60, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 2, clientX: 61, clientY: 61 });
        fireEvent.pointerUp(card1, { pointerId: 2, clientX: 61, clientY: 61 });
        fireEvent.click(card1);

        expect(onCardClick).toHaveBeenCalledTimes(1);
        expect(onCardClick).toHaveBeenCalledWith(cards[0]);
    });

    it("clears drag state even when releasePointerCapture throws, so a later drag still works (review-feedback-ST5.md Issue 3)", () => {
        const cards = [
            makeCard({ id: 1, status: "BACKLOG" }),
            makeCard({ id: 2, status: "BACKLOG" }),
        ];
        const onDrop = jest.fn<void, [DropInput]>();
        const onCardClick = jest.fn<void, [TaskCard]>();

        // Reachable on a real device via the pointercancel path (OS gesture take-over, or the
        // capturing element already detached) — releasePointerCapture is spec'd to throw once the
        // pointerId is no longer an active pointer.
        Element.prototype.releasePointerCapture = jest.fn<void, [number]>().mockImplementation(() => {
            throw new DOMException("InvalidPointerId", "NotFoundError");
        });

        render(React.createElement(Harness, { cards, onDrop, onCardClick }));
        const card1 = screen.getByTestId("card-1");

        // First gesture: a real drag interrupted by pointercancel, where releasing capture throws.
        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: 50, clientY: 250 });
        fireEvent.pointerCancel(card1, { pointerId: 1 });

        expect(onDrop).not.toHaveBeenCalled();

        // A completely independent, later drag must still be possible. If the thrown exception had
        // left dragStateRef non-null, onPointerDown's re-entry guard would silently refuse this one.
        fireEvent.pointerDown(card1, { pointerId: 1, clientX: 50, clientY: 50, button: 0 });
        fireEvent.pointerMove(card1, { pointerId: 1, clientX: 50, clientY: 250 });
        fireEvent.pointerUp(card1, { pointerId: 1, clientX: 50, clientY: 250 });

        expect(onDrop).toHaveBeenCalledWith({ cardId: 1, targetStatus: "BACKLOG", targetIndex: 1 });
    });
});
