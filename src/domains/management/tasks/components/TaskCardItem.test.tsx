import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskCardItem from "./TaskCardItem";
import { useCardDrag } from "../hooks/useCardDrag";
import type { TaskCard, TaskCardPriority } from "../types";

// TaskCardItem's own concern is whether it decides to mount the thumb (card.hasImage), not the
// thumb's own fetch/objectURL/revoke plumbing — that already has its own TaskCardImageThumb.test.tsx.
jest.mock("./TaskCardImageThumb", () => ({
    __esModule: true,
    TaskCardImageThumb: ({ taskCardId }: { taskCardId: number }): JSX.Element => (
        <div data-testid={`task-image-thumb-${taskCardId}`} />
    ),
}));

const TODAY = "2026-08-19";

// jsdom 16 (this project's test environment) has no `PointerEvent` class, so
// `@testing-library/dom`'s fireEvent.pointerDown/Up falls back to a bare `Event` that carries no
// `button`/`clientX`/`clientY`/`pointerId` — mirrors the identical polyfill in useCardDrag.test.ts,
// needed here only for the one test below that drives real pointer gestures through the hook.
class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
    }
}

if (typeof window.PointerEvent === "undefined") {
    // This minimal polyfill only implements the fields this file actually drives, per the identical
    // shim in useCardDrag.test.ts — acceptable because it exists solely to make jsdom's missing
    // Pointer Events support usable for `fireEvent.pointerX` in this test file.
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

function makeCard(overrides: Partial<TaskCard> = {}): TaskCard {
    return {
        id: 1,
        title: "Restock mozzarella",
        description: null,
        priority: "GREEN",
        status: "BACKLOG",
        position: 0,
        assigneeId: 7,
        createdAt: "2026-08-12T10:00:00",
        updatedAt: "2026-08-12T10:00:00",
        deadline: null,
        hasImage: false,
        ...overrides,
    };
}

describe("TaskCardItem", () => {
    beforeEach(() => {
        // jsdom does not implement pointer capture at all — calling the real, absent method would throw.
        Element.prototype.setPointerCapture = jest.fn<void, [number]>();
        Element.prototype.releasePointerCapture = jest.fn<void, [number]>();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("always renders the title", () => {
        render(<TaskCardItem card={makeCard()} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />);

        expect(screen.getByText("Restock mozzarella")).toBeTruthy();
    });

    it("renders the description block when description is present", () => {
        render(
            <TaskCardItem
                card={makeCard({ description: "Buy more cheese" })}
                onClick={jest.fn()}
                onChangePriority={jest.fn()}
                today={TODAY}
            />
        );

        expect(screen.getByText("Buy more cheese")).toBeTruthy();
    });

    it("omits the description block when description is null", () => {
        render(
            <TaskCardItem card={makeCard({ description: null })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />
        );

        expect(screen.queryByTestId("task-card-description-1")).toBeNull();
    });

    it.each([
        ["GREEN", "#32a852"],
        ["YELLOW", "#e4b11b"],
        ["RED", "#e44b4c"],
    ] as [TaskCardPriority, string][])("renders the %s priority as the card's left edge color", (priority, expected) => {
        render(<TaskCardItem card={makeCard({ priority })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />);

        const card = screen.getByTestId("task-card-1");
        // jsdom echoes the hex back verbatim rather than normalising it, so compare case-insensitively.
        expect(window.getComputedStyle(card).borderLeftColor.toLowerCase()).toBe(expected);
    });

    it("clicking the card body calls onClick with the card", () => {
        const onClick = jest.fn();
        const card = makeCard();
        render(<TaskCardItem card={card} onClick={onClick} onChangePriority={jest.fn()} today={TODAY} />);

        fireEvent.click(screen.getByText("Restock mozzarella"));

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith(card);
    });

    it("clicking the three-dots icon does not call onClick", () => {
        const onClick = jest.fn();
        render(<TaskCardItem card={makeCard()} onClick={onClick} onChangePriority={jest.fn()} today={TODAY} />);

        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));

        expect(onClick).not.toHaveBeenCalled();
    });

    it("with no getDragHandlers prop supplied, clicking the card body is byte-identical to ST4's click behavior", () => {
        const onClick = jest.fn();
        const card = makeCard();
        render(<TaskCardItem card={card} onClick={onClick} onChangePriority={jest.fn()} today={TODAY} />);

        const cardEl = screen.getByTestId("task-card-1");
        // MUI's Paper always emits its own `--Paper-shadow` custom property inline, so the whole
        // `style` attribute is never null — assert the drag-specific wiring itself is absent
        // instead (no `touch-action: none`, no `transform`), which is what actually distinguishes
        // "drag seam unused" from "drag seam wired".
        const styleAttr = cardEl.getAttribute("style") ?? "";
        expect(styleAttr).not.toContain("touch-action");
        expect(styleAttr).not.toContain("transform");

        fireEvent.click(screen.getByText("Restock mozzarella"));

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith(card);
    });

    it("a tap on the three-dots menu button opens the priority menu, not the drawer, with real drag handlers wired (review-feedback-ST5.md Issue 2)", () => {
        const onClick = jest.fn();
        const onChangePriority = jest.fn();
        const onDrop = jest.fn();
        const card = makeCard();

        // A local, typed reference to the capture mock (shadowing the describe-level beforeEach
        // one) so the assertion below needs no `as` cast to read call history.
        const setPointerCaptureMock = jest.fn<void, [number]>();
        Element.prototype.setPointerCapture = setPointerCaptureMock;

        function Wrapper(): JSX.Element {
            const { getDragHandlers } = useCardDrag({ onDrop });
            return (
                <TaskCardItem
                    card={card}
                    onClick={onClick}
                    onChangePriority={onChangePriority}
                    getDragHandlers={getDragHandlers}
                    today={TODAY}
                />
            );
        }

        render(<Wrapper />);
        const menuButton = screen.getByTestId("task-card-menu-button-1");

        // Full gesture: pointerdown -> pointerup -> click, exactly what a real tap on the button
        // dispatches.
        fireEvent.pointerDown(menuButton, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
        fireEvent.pointerUp(menuButton, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
        fireEvent.click(menuButton);

        // jsdom does not implement the browser's click-retargeting-under-capture behaviour, so the
        // decisive, environment-independent proof is that pointerdown on the button never took
        // pointer capture on the card in the first place — which is what would let Pointer Events
        // L3 (Chromium) retarget the trailing click away from the button on a real device.
        expect(setPointerCaptureMock).not.toHaveBeenCalled();
        expect(screen.getByText("Green")).toBeTruthy();
        expect(screen.getByText("Yellow")).toBeTruthy();
        expect(screen.getByText("Red")).toBeTruthy();
        expect(onClick).not.toHaveBeenCalled();
    });

    it("a tap on a priority option inside the portalled menu changes priority and does not open the drawer (review-feedback-ST5.md iteration 2 Issue 1)", () => {
        const onClick = jest.fn();
        const onChangePriority = jest.fn();
        const onDrop = jest.fn();
        const card = makeCard();

        const setPointerCaptureMock = jest.fn<void, [number]>();
        Element.prototype.setPointerCapture = setPointerCaptureMock;

        function Wrapper(): JSX.Element {
            const { getDragHandlers } = useCardDrag({ onDrop });
            return (
                <TaskCardItem
                    card={card}
                    onClick={onClick}
                    onChangePriority={onChangePriority}
                    getDragHandlers={getDragHandlers}
                    today={TODAY}
                />
            );
        }

        render(<Wrapper />);
        // Open the menu the same way a real tap does: MUI's `IconButton` opens it on `click`.
        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));

        // MUI's `Menu` is portalled to `document.body` but stays a REACT descendant of the card, so
        // this drives the exact real-device sequence: pointerdown -> pointerup -> click, landing on
        // a `MenuItem` (`role="menuitem"`) rather than the three-dots button this time.
        const greenOption = screen.getByRole("menuitem", { name: "Green" });
        fireEvent.pointerDown(greenOption, { pointerId: 3, clientX: 15, clientY: 15, button: 0 });
        fireEvent.pointerUp(greenOption, { pointerId: 3, clientX: 15, clientY: 15, button: 0 });
        fireEvent.click(greenOption);

        // Decisive, environment-independent proof (jsdom does not implement the browser's
        // click-retargeting-under-capture behaviour): pointerdown on the menu item must never take
        // pointer capture on the card, or a real device would retarget the trailing click away from
        // the `MenuItem` and onto the card.
        expect(setPointerCaptureMock).not.toHaveBeenCalled();
        expect(onChangePriority).toHaveBeenCalledWith(card.id, "GREEN");
        expect(onClick).not.toHaveBeenCalled();
    });

    it("a tap on the menu's backdrop does not take pointer capture on the card or open the drawer (review-feedback-ST5.md iteration 2 Issue 1)", () => {
        const onClick = jest.fn();
        const onChangePriority = jest.fn();
        const onDrop = jest.fn();
        const card = makeCard();

        const setPointerCaptureMock = jest.fn<void, [number]>();
        Element.prototype.setPointerCapture = setPointerCaptureMock;

        function Wrapper(): JSX.Element {
            const { getDragHandlers } = useCardDrag({ onDrop });
            return (
                <TaskCardItem
                    card={card}
                    onClick={onClick}
                    onChangePriority={onChangePriority}
                    getDragHandlers={getDragHandlers}
                    today={TODAY}
                />
            );
        }

        render(<Wrapper />);
        fireEvent.click(screen.getByTestId("task-card-menu-button-1"));
        expect(screen.getByText("Green")).toBeTruthy();

        const backdrop = document.querySelector<HTMLElement>(".MuiBackdrop-root");
        if (!backdrop) throw new Error("expected the Menu's Modal backdrop to be in the document");

        fireEvent.pointerDown(backdrop, { pointerId: 4, clientX: 900, clientY: 900, button: 0 });
        fireEvent.pointerUp(backdrop, { pointerId: 4, clientX: 900, clientY: 900, button: 0 });
        fireEvent.click(backdrop);

        // Menu dismissal on backdrop tap is MUI Modal's own internal behaviour, not something
        // the drag hook is responsible for, and jsdom does not reliably drive it via fireEvent —
        // asserting it here would be testing MUI, not the fix. What matters is that the tap never
        // reached the card underneath.
        expect(setPointerCaptureMock).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
        expect(onChangePriority).not.toHaveBeenCalled();
    });

    it("renders the deadline as DD.MM.YYYY when the card has one", () => {
        render(
            <TaskCardItem
                card={makeCard({ deadline: "2026-08-25" })}
                onClick={jest.fn()}
                onChangePriority={jest.fn()}
                today={TODAY}
            />
        );

        expect(screen.getByTestId("task-card-deadline-1").textContent).toContain("25.08.2026");
    });

    it("omits the deadline line when the card has none", () => {
        render(<TaskCardItem card={makeCard({ deadline: null })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />);

        expect(screen.queryByTestId("task-card-deadline-1")).toBeNull();
    });

    it("paints the overdue background only when the deadline is strictly before today", () => {
        render(
            <TaskCardItem
                card={makeCard({ deadline: "2026-08-18" })}
                onClick={jest.fn()}
                onChangePriority={jest.fn()}
                today={TODAY}
            />
        );

        const card = screen.getByTestId("task-card-1");
        expect(window.getComputedStyle(card).backgroundColor).toBe("rgb(253, 236, 236)");
    });

    it("does not paint the overdue background when the deadline is today", () => {
        render(
            <TaskCardItem card={makeCard({ deadline: TODAY })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />
        );

        const card = screen.getByTestId("task-card-1");
        expect(window.getComputedStyle(card).backgroundColor).toBe("rgb(255, 255, 255)");
    });

    it("renders the photo thumb only when the card has an image", () => {
        const { rerender } = render(
            <TaskCardItem card={makeCard({ hasImage: false })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />
        );
        expect(screen.queryByTestId("task-image-thumb-1")).toBeNull();

        rerender(
            <TaskCardItem card={makeCard({ hasImage: true })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />
        );
        expect(screen.getByTestId("task-image-thumb-1")).toBeTruthy();
    });

    describe("compact layout", () => {
        // The title shares the menu's row only when the header would otherwise be empty. Asserted
        // through DOM ancestry rather than styles: jsdom does not resolve the cascade here, so a
        // spacing assertion would pass whatever the layout actually did.
        function titleSharesRowWithMenu(): boolean {
            const menuButton = screen.getByTestId("task-card-menu-button-1");
            const headerRow = menuButton.parentElement?.parentElement ?? null;
            const title = screen.getByText("Restock mozzarella");
            return headerRow !== null && headerRow.contains(title);
        }

        it("lifts the title beside the menu when there is no deadline and no photo", () => {
            render(
                <TaskCardItem
                    card={makeCard({ deadline: null, hasImage: false })}
                    onClick={jest.fn()}
                    onChangePriority={jest.fn()}
                    today={TODAY}
                />
            );

            expect(titleSharesRowWithMenu()).toBe(true);
        });

        it("keeps the title below the header row when a deadline is present", () => {
            render(
                <TaskCardItem
                    card={makeCard({ deadline: "2026-08-25", hasImage: false })}
                    onClick={jest.fn()}
                    onChangePriority={jest.fn()}
                    today={TODAY}
                />
            );

            expect(titleSharesRowWithMenu()).toBe(false);
            expect(screen.getByTestId("task-card-deadline-1")).toBeTruthy();
        });

        it("keeps the title below the header row when a photo is present", () => {
            render(
                <TaskCardItem
                    card={makeCard({ deadline: null, hasImage: true })}
                    onClick={jest.fn()}
                    onChangePriority={jest.fn()}
                    today={TODAY}
                />
            );

            expect(titleSharesRowWithMenu()).toBe(false);
        });

        it("renders the title exactly once in either layout", () => {
            const { rerender } = render(
                <TaskCardItem card={makeCard({ deadline: null, hasImage: false })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />
            );
            expect(screen.getAllByText("Restock mozzarella")).toHaveLength(1);

            rerender(
                <TaskCardItem card={makeCard({ deadline: "2026-08-25", hasImage: true })} onClick={jest.fn()} onChangePriority={jest.fn()} today={TODAY} />
            );
            expect(screen.getAllByText("Restock mozzarella")).toHaveLength(1);
        });
    });
});
